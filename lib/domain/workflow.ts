import { DomainError } from "./errors";
import { transitionIncident } from "./incident-state";
import { completeRollback, startRollback, type ReleasePairState } from "./release-state";
import { assertRollbackAllowed, selectRemediation } from "./remediation";
import type {
  IncidentStatus,
  RemediationAction,
  RootCauseAssessment,
  ValidationCheck
} from "./types";
import { assertCanResolve } from "./validation";

export function startInvestigation(status: IncidentStatus): IncidentStatus {
  return transitionIncident(status, "INVESTIGATING");
}

export function confirmReleaseRegression(
  status: IncidentStatus,
  assessment: RootCauseAssessment
): IncidentStatus {
  if (status !== "INVESTIGATING") {
    throw new DomainError(
      "INVALID_INCIDENT_TRANSITION",
      "Release regression can be confirmed only while the incident is INVESTIGATING."
    );
  }
  if (assessment.code !== "RELEASE_TIMEOUT_REGRESSION" || assessment.confidence !== "HIGH") {
    throw new DomainError(
      "REGRESSION_NOT_CONFIRMED",
      "High-confidence release regression evidence is required before confirmation."
    );
  }
  return transitionIncident(status, "REGRESSION_CONFIRMED");
}

export function chooseRemediation(
  status: IncidentStatus,
  assessment: RootCauseAssessment,
  action: RemediationAction
): { status: IncidentStatus; action: RemediationAction } {
  const selectedAction = selectRemediation(status, assessment, action);
  return {
    status: transitionIncident(status, "REMEDIATION_SELECTED"),
    action: selectedAction
  };
}

export function beginRollback(
  status: IncidentStatus,
  selectedAction: RemediationAction | null,
  releases: ReleasePairState
): { status: IncidentStatus; releases: ReleasePairState } {
  assertRollbackAllowed(status, selectedAction);
  return {
    status: transitionIncident(status, "ROLLING_BACK"),
    releases: startRollback(releases)
  };
}

export function finishRollback(
  status: IncidentStatus,
  releases: ReleasePairState
): { status: IncidentStatus; releases: ReleasePairState } {
  if (status !== "ROLLING_BACK") {
    throw new DomainError(
      "INVALID_INCIDENT_TRANSITION",
      "Rollback can finish only while the incident is ROLLING_BACK."
    );
  }
  return {
    status: transitionIncident(status, "READY_FOR_VALIDATION"),
    releases: completeRollback(releases)
  };
}

export function validateRecovery(
  status: IncidentStatus,
  checks: ValidationCheck[]
): IncidentStatus {
  if (status !== "READY_FOR_VALIDATION") {
    throw new DomainError(
      "INVALID_INCIDENT_TRANSITION",
      "Recovery validation can be completed only from READY_FOR_VALIDATION."
    );
  }
  assertCanResolve(checks);
  return transitionIncident(status, "VALIDATED");
}

export function resolveValidatedIncident(
  status: IncidentStatus,
  checks: ValidationCheck[]
): IncidentStatus {
  assertCanResolve(checks);
  return transitionIncident(status, "RESOLVED");
}
