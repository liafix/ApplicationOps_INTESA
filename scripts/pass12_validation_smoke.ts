import { SCENARIO } from "../lib/data/synthetic-scenario";
import { createPendingValidationChecks } from "../lib/domain/validation";
import { deriveRecoveryValidationEvidence, recoveryEvidencePassCount } from "../lib/evidence/recovery-validation";
import { recoveryValidationView } from "../lib/ui/recovery-validation";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const rollbackAt = "2026-09-03T09:00:00.000Z";
const recoveryAt = "2026-09-03T09:00:01.000Z";

function baseInput(status: "READY_FOR_VALIDATION" | "VALIDATED" = "READY_FOR_VALIDATION"): import("../lib/ui/recovery-validation").RecoveryValidationViewInput {
  return {
    incident: {
      status,
      recoveredRelease: SCENARIO.previousRelease.version,
      application: {
        serviceHealth: "HEALTHY",
        activeReleaseVersion: SCENARIO.previousRelease.version,
        syntheticErrorRate: SCENARIO.recoveredErrorRatePct
      }
    },
    releases: {
      previous: { version: SCENARIO.previousRelease.version, status: "STABLE" as const },
      current: { version: SCENARIO.currentRelease.version, status: "ROLLED_BACK" as const },
      activeReleaseVersion: SCENARIO.previousRelease.version
    },
    requests: [{
      requestId: SCENARIO.recoveryRequestId,
      responseStatus: 200,
      releaseVersion: SCENARIO.previousRelease.version,
      failureCode: null,
      createdAt: recoveryAt
    }],
    transactions: [{
      id: SCENARIO.recoveryTransactionId,
      requestId: SCENARIO.recoveryRequestId,
      status: "SUCCEEDED" as const,
      applicationVersion: SCENARIO.previousRelease.version,
      failureCode: null,
      createdAt: recoveryAt
    }],
    logs: [{
      timestamp: recoveryAt,
      level: "INFO" as const,
      requestId: SCENARIO.recoveryRequestId,
      message: `Synthetic recovery transaction ${SCENARIO.recoveryTransactionId} completed successfully.`
    }],
    audit: [{ type: "ROLLBACK_COMPLETED", timestamp: rollbackAt }],
    validation: createPendingValidationChecks().map((check) => ({
      id: `validation-${check.id}`,
      key: check.id,
      label: check.label,
      required: check.required,
      status: check.status
    }))
  };
}

const ready = baseInput();
const evidence = deriveRecoveryValidationEvidence(ready);
assert(recoveryEvidencePassCount(evidence) === 4, "4/4 recovery evidence conditions derive from persisted state");
const readyView = recoveryValidationView(ready);
assert(readyView.mode === "READY", "READY_FOR_VALIDATION + complete evidence + pending checks exposes READY gate");
assert(readyView.persistedPassCount === 0, "evidence readiness does not manufacture persisted PASS statuses");

const validated = baseInput("VALIDATED");
validated.validation = validated.validation.map((check) => ({ ...check, status: "PASS" as const }));
validated.audit.push(
  { type: "VALIDATION_STARTED", timestamp: "2026-09-03T09:00:02.000Z" },
  { type: "VALIDATION_PASSED", timestamp: "2026-09-03T09:00:02.001Z" }
);
const validatedView = recoveryValidationView(validated);
assert(validatedView.mode === "VALIDATED", "VALIDATED requires 4/4 persisted PASS plus validation audit evidence");
assert(validatedView.persistedPassCount === 4, "persisted validation gate reports 4/4 PASS");

const tampered = baseInput();
tampered.requests[0].responseStatus = 500;
assert(recoveryValidationView(tampered).mode === "BLOCKED", "tampered recovery request blocks validation readiness");

const timeoutRegression = baseInput();
timeoutRegression.logs.push({
  timestamp: "2026-09-03T09:00:03.000Z",
  level: "ERROR",
  requestId: "req_after_rollback",
  message: `${SCENARIO.failureCode} after rollback`
});
assert(recoveryValidationView(timeoutRegression).mode === "BLOCKED", "new timeout ERROR after rollback blocks validation readiness");

const missingAudit = baseInput("VALIDATED");
missingAudit.validation = missingAudit.validation.map((check) => ({ ...check, status: "PASS" as const }));
assert(recoveryValidationView(missingAudit).mode === "INCONSISTENT", "validated state without validation audits fails closed");

console.log("PASS12_RECOVERY_VALIDATION_SMOKE_PASS");
