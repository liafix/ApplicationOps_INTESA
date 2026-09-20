import { describe, expect, it } from "vitest";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import {
  rollbackRecoveryEvidence,
  rollbackRecoveryMode,
  type RollbackRecoveryInput
} from "@/lib/ui/rollback-recovery";

function input(
  status: NonNullable<RollbackRecoveryInput["incident"]>["status"]
): RollbackRecoveryInput {
  const recovered =
    status === "READY_FOR_VALIDATION" || status === "VALIDATED" || status === "RESOLVED";
  return {
    incident: {
      status,
      selectedRemediation: status === "REGRESSION_CONFIRMED" ? null : "ROLLBACK_RELEASE",
      recoveredRelease: recovered ? SCENARIO.previousRelease.version : null,
      application: {
        serviceHealth: recovered ? "HEALTHY" : "DEGRADED",
        activeReleaseVersion: recovered
          ? SCENARIO.previousRelease.version
          : SCENARIO.currentRelease.version,
        syntheticErrorRate: recovered
          ? SCENARIO.recoveredErrorRatePct
          : SCENARIO.currentRelease.errorRatePct
      }
    },
    releases: {
      previous: {
        version: SCENARIO.previousRelease.version,
        status: "STABLE",
        downstreamTimeoutMs: SCENARIO.previousRelease.downstreamTimeoutMs,
        syntheticErrorRate: SCENARIO.previousRelease.errorRatePct
      },
      current: {
        version: SCENARIO.currentRelease.version,
        status: recovered ? "ROLLED_BACK" : "DEGRADED",
        downstreamTimeoutMs: SCENARIO.currentRelease.downstreamTimeoutMs,
        syntheticErrorRate: SCENARIO.currentRelease.errorRatePct
      },
      activeReleaseVersion: recovered
        ? SCENARIO.previousRelease.version
        : SCENARIO.currentRelease.version
    },
    requests: recovered
      ? [
          {
            requestId: SCENARIO.recoveryRequestId,
            responseStatus: 200,
            releaseVersion: SCENARIO.previousRelease.version,
            failureCode: null
          }
        ]
      : [],
    transactions: recovered
      ? [
          {
            id: SCENARIO.recoveryTransactionId,
            requestId: SCENARIO.recoveryRequestId,
            status: "SUCCEEDED",
            applicationVersion: SCENARIO.previousRelease.version,
            failureCode: null
          }
        ]
      : [],
    logs: recovered
      ? [
          {
            level: "INFO",
            requestId: SCENARIO.recoveryRequestId,
            message: `Synthetic recovery transaction ${SCENARIO.recoveryTransactionId} completed successfully on release ${SCENARIO.previousRelease.version}.`
          }
        ]
      : [],
    audit: recovered ? [{ type: "ROLLBACK_STARTED" }, { type: "ROLLBACK_COMPLETED" }] : []
  };
}

describe("rollback recovery presentation", () => {
  it("is ready only after the rollback decision is persisted", () => {
    expect(rollbackRecoveryMode(input("REMEDIATION_SELECTED"))).toBe("READY");
    expect(rollbackRecoveryMode(input("REGRESSION_CONFIRMED"))).toBe("LOCKED");
  });

  it("requires complete persisted recovery evidence before showing recovered", () => {
    const recovered = input("READY_FOR_VALIDATION");
    expect(rollbackRecoveryMode(recovered)).toBe("RECOVERED");
    expect(Object.values(rollbackRecoveryEvidence(recovered)).every(Boolean)).toBe(true);
  });

  it("fails closed when one recovery evidence element is missing", () => {
    const broken = input("READY_FOR_VALIDATION");
    broken.requests = [];
    expect(rollbackRecoveryMode(broken)).toBe("INCONSISTENT");
  });

  it("does not treat recovery as validation", () => {
    const recovered = input("READY_FOR_VALIDATION");
    expect(recovered.incident?.status).toBe("READY_FOR_VALIDATION");
    expect(rollbackRecoveryMode(recovered)).toBe("RECOVERED");
  });
});
