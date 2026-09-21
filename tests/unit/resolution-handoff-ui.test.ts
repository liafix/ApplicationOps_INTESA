import { describe, expect, it } from "vitest";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { createPendingValidationChecks } from "@/lib/domain/validation";
import { resolutionHandoffView, type ResolutionHandoffViewInput } from "@/lib/ui/resolution-handoff";
import { deriveResolutionHandoff } from "@/lib/evidence/resolution-handoff";

function base(status: "VALIDATED" | "RESOLVED" = "VALIDATED"): ResolutionHandoffViewInput {
  const rollbackAt = "2026-09-03T09:00:00.000Z";
  const recoveryAt = "2026-09-03T09:00:01.000Z";
  return {
    incident: { status, recoveredRelease: SCENARIO.previousRelease.version, rootCauseCode: "RELEASE_TIMEOUT_REGRESSION", selectedRemediation: "ROLLBACK_RELEASE", affectedRelease: SCENARIO.currentRelease.version, technicalSummary: "Confirmed", closureTechnicalSummary: null, closureBusinessSummary: null, application: { serviceHealth: "HEALTHY", activeReleaseVersion: SCENARIO.previousRelease.version, syntheticErrorRate: SCENARIO.recoveredErrorRatePct } },
    releases: { previous: { version: SCENARIO.previousRelease.version, status: "STABLE" }, current: { version: SCENARIO.currentRelease.version, status: "ROLLED_BACK" }, activeReleaseVersion: SCENARIO.previousRelease.version },
    requests: [{ requestId: SCENARIO.recoveryRequestId, responseStatus: 200, releaseVersion: SCENARIO.previousRelease.version, failureCode: null, createdAt: recoveryAt }],
    transactions: [{ id: SCENARIO.recoveryTransactionId, requestId: SCENARIO.recoveryRequestId, status: "SUCCEEDED", applicationVersion: SCENARIO.previousRelease.version, failureCode: null, createdAt: recoveryAt }],
    logs: [{ timestamp: recoveryAt, level: "INFO", requestId: SCENARIO.recoveryRequestId, message: "Recovery succeeded" }],
    audit: [{ type: "ROLLBACK_COMPLETED", timestamp: rollbackAt }, { type: "VALIDATION_PASSED", timestamp: "2026-09-03T09:00:02.000Z" }],
    validation: createPendingValidationChecks().map((check) => ({ ...check, status: "PASS" as const }))
  };
}

describe("resolution handoff view", () => {
  it("is READY after validated evidence and before closure persistence", () => expect(resolutionHandoffView(base()).mode).toBe("READY"));
  it("is RESOLVED only with both summaries and both closure audit events", () => {
    const value = base("RESOLVED");
    const derived = deriveResolutionHandoff(value);
    value.incident!.closureTechnicalSummary = derived.technicalSummary;
    value.incident!.closureBusinessSummary = derived.businessSummary;
    value.audit.push({ type: "RESOLUTION_HANDOFF_CREATED", timestamp: "2026-09-03T09:00:03.000Z" }, { type: "INCIDENT_RESOLVED", timestamp: "2026-09-03T09:00:03.001Z" });
    expect(resolutionHandoffView(value).mode).toBe("RESOLVED");
  });
  it("fails closed when RESOLVED lacks persisted summaries", () => {
    const value = base("RESOLVED");
    value.audit.push({ type: "RESOLUTION_HANDOFF_CREATED", timestamp: "2026-09-03T09:00:03.000Z" }, { type: "INCIDENT_RESOLVED", timestamp: "2026-09-03T09:00:03.001Z" });
    expect(resolutionHandoffView(value).mode).toBe("INCONSISTENT");
  });
  it("fails closed when persisted closure text drifts from the deterministic evidence-derived handoff", () => {
    const value = base("RESOLVED");
    const derived = deriveResolutionHandoff(value);
    value.incident!.closureTechnicalSummary = (derived.technicalSummary ?? "") + " altered";
    value.incident!.closureBusinessSummary = derived.businessSummary;
    value.audit.push({ type: "RESOLUTION_HANDOFF_CREATED", timestamp: "2026-09-03T09:00:03.000Z" }, { type: "INCIDENT_RESOLVED", timestamp: "2026-09-03T09:00:03.001Z" });
    expect(resolutionHandoffView(value).mode).toBe("INCONSISTENT");
  });

});
