export type IncidentStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "REGRESSION_CONFIRMED"
  | "REMEDIATION_SELECTED"
  | "ROLLING_BACK"
  | "READY_FOR_VALIDATION"
  | "VALIDATED"
  | "RESOLVED";

export type ReleaseStatus = "STABLE" | "DEPLOYED" | "DEGRADED" | "ROLLING_BACK" | "ROLLED_BACK";

export type RemediationAction =
  | "RETRY_FAILED_TRANSACTIONS"
  | "CHANGE_PRODUCTION_DATA"
  | "ROLLBACK_RELEASE"
  | "ESCALATE_WITHOUT_ACTION";

export type ValidationStatus = "PENDING" | "PASS" | "FAIL";

export type ValidationCheckId =
  | "stable-release"
  | "error-rate"
  | "synthetic-transaction"
  | "timeout-errors";

export interface ValidationCheck {
  id: ValidationCheckId;
  label: string;
  required: boolean;
  status: ValidationStatus;
}

export interface RootCauseEvidence {
  currentTimeoutMs: number;
  previousTimeoutMs: number;
  observedDownstreamLatencyMs: number;
  incidentStartedAfterDeployment: boolean;
  timeoutErrorCount: number;
}

export type RootCauseCode = "RELEASE_TIMEOUT_REGRESSION" | "INSUFFICIENT_EVIDENCE";

export interface RootCauseAssessment {
  code: RootCauseCode;
  confidence: "HIGH" | "LOW";
  explanation: string;
}
