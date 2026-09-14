import { DomainError } from "./errors";
import type { ValidationCheck, ValidationCheckId } from "./types";

export const REQUIRED_VALIDATION_DEFINITIONS = [
  { id: "stable-release", label: "Previous stable release restored" },
  { id: "error-rate", label: "Error rate returned below threshold" },
  { id: "synthetic-transaction", label: "New synthetic transaction completed successfully" },
  { id: "timeout-errors", label: "No new timeout errors detected" }
] as const satisfies ReadonlyArray<{ id: ValidationCheckId; label: string }>;

export function createPendingValidationChecks(): ValidationCheck[] {
  return REQUIRED_VALIDATION_DEFINITIONS.map((definition) => ({
    ...definition,
    required: true,
    status: "PENDING"
  }));
}

export function allRequiredValidationPassed(checks: ValidationCheck[]): boolean {
  const seen = new Set<ValidationCheckId>();

  for (const check of checks) {
    if (seen.has(check.id)) return false;
    seen.add(check.id);
  }

  const canonicalChecksPass = REQUIRED_VALIDATION_DEFINITIONS.every((definition) => {
    const check = checks.find((candidate) => candidate.id === definition.id);
    return check?.required === true && check.status === "PASS";
  });

  if (!canonicalChecksPass) return false;

  return checks.filter((check) => check.required).every((check) => check.status === "PASS");
}

export function assertCanResolve(checks: ValidationCheck[]): void {
  if (!allRequiredValidationPassed(checks)) {
    throw new DomainError(
      "VALIDATION_REQUIRED",
      "All canonical and additional required recovery checks must exist exactly once and pass before resolving the incident."
    );
  }
}
