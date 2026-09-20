import { DomainError } from "./errors";
import type { IncidentStatus, RemediationAction, RootCauseAssessment } from "./types";

export interface RemediationRecommendation {
  action: RemediationAction;
  recommended: boolean;
  risk: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
}

export function remediationOptions(rootCause: RootCauseAssessment): RemediationRecommendation[] {
  const confirmed =
    rootCause.code === "RELEASE_TIMEOUT_REGRESSION" && rootCause.confidence === "HIGH";

  return [
    {
      action: "RETRY_FAILED_TRANSACTIONS",
      recommended: false,
      risk: "MEDIUM",
      explanation: "Retrying does not remove the release-level timeout regression."
    },
    {
      action: "CHANGE_PRODUCTION_DATA",
      recommended: false,
      risk: "HIGH",
      explanation: "The evidence points to configuration, not incorrect transaction data."
    },
    {
      action: "ROLLBACK_RELEASE",
      recommended: confirmed,
      risk: "MEDIUM",
      explanation: confirmed
        ? "Rollback is a controlled reversible action that restores the previously stable configuration for this evidence set."
        : "Rollback should not be executed until the release regression is confirmed."
    },
    {
      action: "ESCALATE_WITHOUT_ACTION",
      recommended: false,
      risk: "LOW",
      explanation:
        "Escalation remains a safe fallback when evidence is insufficient or rollback authority is unavailable, but it does not restore service by itself."
    }
  ];
}

export function selectRemediation(
  status: IncidentStatus,
  rootCause: RootCauseAssessment,
  action: RemediationAction
): RemediationAction {
  if (status !== "REGRESSION_CONFIRMED") {
    throw new DomainError(
      "REGRESSION_NOT_CONFIRMED",
      "Remediation cannot be selected before the release regression is confirmed."
    );
  }

  if (rootCause.code !== "RELEASE_TIMEOUT_REGRESSION" || rootCause.confidence !== "HIGH") {
    throw new DomainError(
      "REGRESSION_NOT_CONFIRMED",
      "High-confidence release regression evidence is required before remediation."
    );
  }

  if (action !== "ROLLBACK_RELEASE") {
    throw new DomainError(
      "REMEDIATION_NOT_SUPPORTED",
      `${action} is a valid option but is not the supported successful remediation for this deterministic evidence set.`
    );
  }

  return action;
}

export function assertRollbackAllowed(
  status: IncidentStatus,
  action: RemediationAction | null
): void {
  if (status !== "REMEDIATION_SELECTED") {
    throw new DomainError(
      "REMEDIATION_NOT_SELECTED",
      "Rollback requires the incident to be in REMEDIATION_SELECTED state."
    );
  }
  if (action !== "ROLLBACK_RELEASE") {
    throw new DomainError("ROLLBACK_NOT_SELECTED", "Rollback release must be selected first.");
  }
}
