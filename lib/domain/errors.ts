export type DomainErrorCode =
  | "INVALID_INCIDENT_TRANSITION"
  | "INVALID_RELEASE_TRANSITION"
  | "INVALID_EVIDENCE"
  | "REGRESSION_NOT_CONFIRMED"
  | "REMEDIATION_NOT_SUPPORTED"
  | "REMEDIATION_NOT_SELECTED"
  | "ROLLBACK_NOT_SELECTED"
  | "VALIDATION_REQUIRED";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}
