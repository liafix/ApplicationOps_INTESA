import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { allRequiredValidationPassed } from "@/lib/domain/validation";
import type { ValidationCheck } from "@/lib/domain/types";
import {
  deriveRecoveryValidationEvidence,
  recoveryEvidencePassCount,
  type RecoveryValidationInput
} from "./recovery-validation";

export interface ResolutionHandoffInput extends RecoveryValidationInput {
  incident:
    | (NonNullable<RecoveryValidationInput["incident"]> & {
        rootCauseCode: string | null;
        selectedRemediation: string | null;
        affectedRelease: string;
        technicalSummary: string | null;
        closureTechnicalSummary?: string | null;
        closureBusinessSummary?: string | null;
      })
    | null;
  validation: ValidationCheck[];
}

export interface ResolutionHandoffResult {
  ready: boolean;
  validationPassCount: number;
  technicalSummary: string | null;
  businessSummary: string | null;
  reasons: string[];
}

export function deriveResolutionHandoff(input: ResolutionHandoffInput): ResolutionHandoffResult {
  const evidence = deriveRecoveryValidationEvidence(input);
  const reasons: string[] = [];
  const incident = input.incident;

  if (!incident || (incident.status !== "VALIDATED" && incident.status !== "RESOLVED"))
    reasons.push("incident-not-validated");
  if (incident?.rootCauseCode !== "RELEASE_TIMEOUT_REGRESSION")
    reasons.push("root-cause-not-confirmed");
  if (incident?.selectedRemediation !== "ROLLBACK_RELEASE") reasons.push("rollback-not-selected");
  if (incident?.affectedRelease !== SCENARIO.currentRelease.version)
    reasons.push("affected-release-mismatch");
  if (incident?.recoveredRelease !== SCENARIO.previousRelease.version)
    reasons.push("recovered-release-mismatch");
  if (recoveryEvidencePassCount(evidence) !== 4) reasons.push("recovery-evidence-incomplete");
  if (!allRequiredValidationPassed(input.validation))
    reasons.push("persisted-validation-incomplete");
  if (!input.audit.some((event) => event.type === "VALIDATION_PASSED"))
    reasons.push("validation-audit-missing");

  if (reasons.length) {
    return {
      ready: false,
      validationPassCount: input.validation.filter((c) => c.required && c.status === "PASS").length,
      technicalSummary: null,
      businessSummary: null,
      reasons
    };
  }

  const technicalSummary = `Root cause ${incident!.rootCauseCode} affected release v${SCENARIO.currentRelease.version}: the configured downstream timeout was ${SCENARIO.currentRelease.downstreamTimeoutMs} ms while the correlated request observed ${SCENARIO.observedDownstreamLatencyMs} ms, resulting in ${SCENARIO.failureCode} / HTTP ${SCENARIO.httpStatus} for ${SCENARIO.requestId} and ${SCENARIO.transactionId}. A controlled rollback restored v${SCENARIO.previousRelease.version}; service health returned to HEALTHY, the synthetic error rate returned to ${SCENARIO.recoveredErrorRatePct}%, ${SCENARIO.recoveryRequestId} completed with HTTP 200 and ${SCENARIO.recoveryTransactionId} succeeded. Recovery validation passed 4/4.`;
  const businessSummary = `A release-level timeout regression caused elevated synthetic transaction failures. The service was restored to the previous stable release, recovery checks passed 4/4, and the incident was closed after validation. This candidate demonstrator uses synthetic data only.`;

  return { ready: true, validationPassCount: 4, technicalSummary, businessSummary, reasons: [] };
}
