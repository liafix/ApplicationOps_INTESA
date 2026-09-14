import { describe, expect, it } from "vitest";
import { DomainError, assessRootCause } from "@/lib/domain";

const evidence = {
  currentTimeoutMs: 800,
  previousTimeoutMs: 5000,
  observedDownstreamLatencyMs: 1437,
  incidentStartedAfterDeployment: true,
  timeoutErrorCount: 2
};

describe("root cause engine", () => {
  it("detects the deterministic timeout regression", () => {
    expect(assessRootCause(evidence)).toMatchObject({
      code: "RELEASE_TIMEOUT_REGRESSION",
      confidence: "HIGH"
    });
  });

  it("returns insufficient evidence without timeout errors", () => {
    expect(assessRootCause({ ...evidence, timeoutErrorCount: 0 })).toMatchObject({
      code: "INSUFFICIENT_EVIDENCE",
      confidence: "LOW"
    });
  });

  it("rejects impossible numeric evidence instead of classifying it", () => {
    expect(() => assessRootCause({ ...evidence, currentTimeoutMs: -1 })).toThrow(DomainError);
    expect(() => assessRootCause({ ...evidence, timeoutErrorCount: 1.5 })).toThrow(DomainError);
  });
});
