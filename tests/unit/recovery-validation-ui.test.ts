import { describe, expect, it } from "vitest";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { createPendingValidationChecks } from "@/lib/domain/validation";
import { recoveryValidationView } from "@/lib/ui/recovery-validation";

function baseInput(status: "READY_FOR_VALIDATION" | "VALIDATED" = "READY_FOR_VALIDATION") {
  const rollbackAt = "2026-09-03T09:00:00.000Z";
  const after = "2026-09-03T09:00:01.000Z";
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
        message: "Recovery succeeded"
      }
    ],
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

describe("recovery validation view", () => {
  it("is READY when 4/4 persisted evidence conditions exist but checks are still pending", () => {
    const view = recoveryValidationView(baseInput());
    expect(view.mode).toBe("READY");
    expect(view.evidencePassCount).toBe(4);
    expect(view.persistedPassCount).toBe(0);
  });

  it("is BLOCKED when the recovery evidence is incomplete", () => {
    const input = baseInput();
    input.requests = [];
    expect(recoveryValidationView(input).mode).toBe("BLOCKED");
  });

  it("is VALIDATED only when exact canonical checks are PASS and both validation audits exist", () => {
    const input = baseInput("VALIDATED");
    input.validation = input.validation.map((check) => ({ ...check, status: "PASS" as const }));
    input.audit.push(
      { type: "VALIDATION_STARTED", timestamp: "2026-09-03T09:00:02.000Z" },
      { type: "VALIDATION_PASSED", timestamp: "2026-09-03T09:00:02.001Z" }
    );
    const view = recoveryValidationView(input);
    expect(view.mode).toBe("VALIDATED");
    expect(view.persistedPassCount).toBe(4);
  });

  it("fails closed when a validated incident is missing validation audit evidence", () => {
    const input = baseInput("VALIDATED");
    input.validation = input.validation.map((check) => ({ ...check, status: "PASS" as const }));
    expect(recoveryValidationView(input).mode).toBe("INCONSISTENT");
  });

  it("fails closed when a canonical validation check is missing", () => {
    const input = baseInput();
    input.validation = input.validation.slice(0, 3);
    expect(recoveryValidationView(input).mode).toBe("INCONSISTENT");
  });
});
