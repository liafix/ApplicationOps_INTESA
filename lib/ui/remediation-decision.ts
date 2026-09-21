import type { IncidentStatus, RemediationAction } from "@/lib/domain/types";

export type RemediationDecisionMode = "LOCKED" | "READY" | "RECORDED";
export type EvidenceFit = "STRONG" | "WEAK" | "NO_EVIDENCE" | "FALLBACK";

export interface RemediationOptionPresentation {
  action: RemediationAction;
  title: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  evidenceFit: EvidenceFit;
  shortRationale: string;
  reviewQuestion: string;
  executableForScenario: boolean;
}

export const REMEDIATION_OPTIONS: readonly RemediationOptionPresentation[] = [
  {
    action: "RETRY_FAILED_TRANSACTIONS",
    title: "Retry failed transactions",
    risk: "MEDIUM",
    evidenceFit: "WEAK",
    shortRationale: "A retry may reproduce the same timeout because it does not remove the confirmed release-level configuration regression.",
    reviewQuestion: "Would this remove the condition that caused the timeout?",
    executableForScenario: false
  },
  {
    action: "CHANGE_PRODUCTION_DATA",
    title: "Change production data",
    risk: "HIGH",
    evidenceFit: "NO_EVIDENCE",
    shortRationale: "The persisted evidence points to release configuration rather than incorrect transaction data, so a data change would add risk without addressing the observed cause.",
    reviewQuestion: "Is there evidence that transaction data is incorrect?",
    executableForScenario: false
  },
  {
    action: "ROLLBACK_RELEASE",
    title: "Rollback release",
    risk: "MEDIUM",
    evidenceFit: "STRONG",
    shortRationale: "The previous release is known stable, the regression is tied to the new release configuration and rollback is a controlled reversible response for this synthetic evidence set.",
    reviewQuestion: "Can we restore the last known-good release before attempting secondary recovery work?",
    executableForScenario: true
  },
  {
    action: "ESCALATE_WITHOUT_ACTION",
    title: "Escalate without action",
    risk: "LOW",
    evidenceFit: "FALLBACK",
    shortRationale: "Escalation is appropriate when authority or evidence is insufficient, but it does not itself restore the degraded service in this scenario.",
    reviewQuestion: "Is escalation necessary because a safe reversible action cannot be justified?",
    executableForScenario: false
  }
] as const;

export function remediationDecisionMode(input: {
  status: IncidentStatus;
  rootCauseCode: string | null;
  selectedRemediation: string | null;
}): RemediationDecisionMode {
  if (
    ["REMEDIATION_SELECTED", "ROLLING_BACK", "READY_FOR_VALIDATION", "VALIDATED", "RESOLVED"].includes(input.status) &&
    input.selectedRemediation === "ROLLBACK_RELEASE"
  ) {
    return "RECORDED";
  }

  if (
    input.status === "REGRESSION_CONFIRMED" &&
    input.rootCauseCode === "RELEASE_TIMEOUT_REGRESSION" &&
    input.selectedRemediation === null
  ) {
    return "READY";
  }

  return "LOCKED";
}

export function remediationOption(action: RemediationAction): RemediationOptionPresentation {
  const option = REMEDIATION_OPTIONS.find((item) => item.action === action);
  if (!option) {
    throw new Error(`Unknown remediation action: ${action}`);
  }
  return option;
}

export function canRecordRemediationDecision(input: {
  mode: RemediationDecisionMode;
  action: RemediationAction | null;
}): boolean {
  if (input.mode !== "READY" || input.action === null) return false;
  return remediationOption(input.action).executableForScenario;
}

export function evidenceFitLabel(fit: EvidenceFit): string {
  switch (fit) {
    case "STRONG":
      return "Strong evidence fit";
    case "WEAK":
      return "Weak evidence fit";
    case "NO_EVIDENCE":
      return "No supporting evidence";
    case "FALLBACK":
      return "Fallback path";
  }
}
