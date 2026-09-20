import { describe, expect, it } from "vitest";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import {
  deriveRecoveryValidationEvidence,
  type RecoveryValidationInput
} from "@/lib/evidence/recovery-validation";

function completeInput(): RecoveryValidationInput {
  const rollbackAt = new Date("2026-09-03T09:00:00.000Z");
  const after = new Date(rollbackAt.getTime() + 1000);
  return {
    incident: {
      status: "READY_FOR_VALIDATION" as const,
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
    requests: [
      {
        requestId: SCENARIO.recoveryRequestId,
        responseStatus: 200,
        releaseVersion: SCENARIO.previousRelease.version,
        failureCode: null,
        createdAt: after
      }
    ],
    transactions: [
      {
        id: SCENARIO.recoveryTransactionId,
        requestId: SCENARIO.recoveryRequestId,
        status: "SUCCEEDED" as const,
        applicationVersion: SCENARIO.previousRelease.version,
        failureCode: null,
        createdAt: after
      }
    ],
    logs: [
      {
        timestamp: after,
        level: "INFO" as const,
        requestId: SCENARIO.recoveryRequestId,
        message: `Synthetic recovery transaction ${SCENARIO.recoveryTransactionId} completed successfully.`
      }
    ],
    audit: [{ type: "ROLLBACK_COMPLETED", timestamp: rollbackAt }]
  };
}

describe("persisted recovery validation evidence", () => {
  it("derives all four canonical conditions from the complete persisted recovery state", () => {
    const evidence = deriveRecoveryValidationEvidence(completeInput());
    expect(evidence.stableReleaseRestored).toBe(true);
    expect(evidence.errorRateBelowThreshold).toBe(true);
    expect(evidence.syntheticTransactionSucceeded).toBe(true);
    expect(evidence.noNewTimeoutErrors).toBe(true);
  });

  it("requires the exact persisted recovery request and transaction on the restored release", () => {
    const input = completeInput();
    input.requests[0].responseStatus = 500;
    expect(deriveRecoveryValidationEvidence(input).syntheticTransactionSucceeded).toBe(false);

    const second = completeInput();
    second.transactions[0].applicationVersion = SCENARIO.currentRelease.version;
    expect(deriveRecoveryValidationEvidence(second).syntheticTransactionSucceeded).toBe(false);
  });

  it("treats the error-rate threshold as strict and does not manufacture a pass", () => {
    const input = completeInput();
    input.incident!.application.syntheticErrorRate = SCENARIO.validationErrorRateThresholdPct;
    expect(deriveRecoveryValidationEvidence(input).errorRateBelowThreshold).toBe(false);
  });

  it("fails the stable-release check if any persisted release/application recovery invariant is broken", () => {
    const input = completeInput();
    input.incident!.application.serviceHealth = "DEGRADED";
    expect(deriveRecoveryValidationEvidence(input).stableReleaseRestored).toBe(false);
  });

  it("fails no-new-timeout-errors when a timeout error appears after rollback completion", () => {
    const input = completeInput();
    input.logs.push({
      timestamp: new Date("2026-09-03T09:00:02.000Z"),
      level: "ERROR",
      requestId: "req_after_rollback",
      message: `${SCENARIO.failureCode} · HTTP 504`
    });
    const evidence = deriveRecoveryValidationEvidence(input);
    expect(evidence.timeoutErrorsAfterRollback).toBe(1);
    expect(evidence.noNewTimeoutErrors).toBe(false);
  });

  it("does not allow post-rollback evidence without a persisted ROLLBACK_COMPLETED audit boundary", () => {
    const input = completeInput();
    input.audit = [];
    const evidence = deriveRecoveryValidationEvidence(input);
    expect(evidence.stableReleaseRestored).toBe(false);
    expect(evidence.syntheticTransactionSucceeded).toBe(false);
    expect(evidence.noNewTimeoutErrors).toBe(false);
  });
});
