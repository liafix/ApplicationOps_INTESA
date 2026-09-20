import { describe, expect, it } from "vitest";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { createPendingValidationChecks } from "@/lib/domain/validation";
import {
  deriveResolutionHandoff,
  type ResolutionHandoffInput
} from "@/lib/evidence/resolution-handoff";

function input(status: "VALIDATED" | "RESOLVED" = "VALIDATED"): ResolutionHandoffInput {
  const rollbackAt = "2026-09-03T09:00:00.000Z";
  const recoveryAt = "2026-09-03T09:00:01.000Z";
  return {
    incident: {
      status,
      recoveredRelease: SCENARIO.previousRelease.version,
      rootCauseCode: "RELEASE_TIMEOUT_REGRESSION",
      selectedRemediation: "ROLLBACK_RELEASE",
      affectedRelease: SCENARIO.currentRelease.version,
      technicalSummary: "Confirmed release regression.",
      application: {
        serviceHealth: "HEALTHY",
        activeReleaseVersion: SCENARIO.previousRelease.version,
        syntheticErrorRate: SCENARIO.recoveredErrorRatePct
      }
    },
    releases: {
      previous: { version: SCENARIO.previousRelease.version, status: "STABLE" },
      current: { version: SCENARIO.currentRelease.version, status: "ROLLED_BACK" },
      activeReleaseVersion: SCENARIO.previousRelease.version
    },
    requests: [
      {
        requestId: SCENARIO.recoveryRequestId,
        responseStatus: 200,
        releaseVersion: SCENARIO.previousRelease.version,
        failureCode: null,
        createdAt: recoveryAt
      }
    ],
    transactions: [
      {
        id: SCENARIO.recoveryTransactionId,
        requestId: SCENARIO.recoveryRequestId,
        status: "SUCCEEDED",
        applicationVersion: SCENARIO.previousRelease.version,
        failureCode: null,
        createdAt: recoveryAt
      }
    ],
    logs: [
      {
        timestamp: recoveryAt,
        level: "INFO",
        requestId: SCENARIO.recoveryRequestId,
        message: "Recovery succeeded"
      }
    ],
    audit: [
      { type: "ROLLBACK_COMPLETED", timestamp: rollbackAt },
      { type: "VALIDATION_PASSED", timestamp: "2026-09-03T09:00:02.000Z" }
    ],
    validation: createPendingValidationChecks().map((check) => ({
      ...check,
      status: "PASS" as const
    }))
  };
}

describe("resolution handoff derivation", () => {
  it("creates technical and business summaries only from complete validated evidence", () => {
    const result = deriveResolutionHandoff(input());
    expect(result.ready).toBe(true);
    expect(result.technicalSummary).toContain("RELEASE_TIMEOUT_REGRESSION");
    expect(result.technicalSummary).toContain(SCENARIO.requestId);
    expect(result.businessSummary).toContain("previous stable release");
    expect(result.validationPassCount).toBe(4);
  });

  it("fails closed when service recovery drifts after validation", () => {
    const value = input();
    value.incident!.application.serviceHealth = "DEGRADED";
    const result = deriveResolutionHandoff(value);
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain("recovery-evidence-incomplete");
    expect(result.technicalSummary).toBeNull();
  });

  it("fails closed without persisted validation PASS state", () => {
    const value = input();
    value.validation[0].status = "PENDING";
    expect(deriveResolutionHandoff(value).ready).toBe(false);
  });
});
