import { describe, expect, it } from "vitest";
import {
  buildReleasePairState,
  buildRootCauseEvidence,
  validationChecksFromEvidence
} from "@/lib/api/incident-evidence";

const currentRelease = {
  version: "2.8.0",
  status: "DEGRADED" as const,
  downstreamTimeoutMs: 800,
  deployedAt: new Date("2026-09-02T07:30:00.000Z")
};

const previousRelease = {
  version: "2.7.4",
  status: "STABLE" as const,
  downstreamTimeoutMs: 5000,
  deployedAt: new Date("2026-09-01T06:45:00.000Z")
};

describe("PASS 3 evidence mapping", () => {
  it("builds root-cause evidence from persisted-style records", () => {
    const evidence = buildRootCauseEvidence({
      incident: {
        status: "INVESTIGATING",
        affectedRelease: "2.8.0",
        createdAt: new Date("2026-09-02T07:32:20.000Z")
      },
      currentRelease,
      previousRelease,
      observedDownstreamLatencyMs: 1437,
      logs: [
        {
          level: "ERROR",
          message: "UPSTREAM_TIMEOUT · HTTP 504.",
          timestamp: new Date("2026-09-02T07:32:11.437Z")
        }
      ]
    });

    expect(evidence).toEqual({
      currentTimeoutMs: 800,
      previousTimeoutMs: 5000,
      observedDownstreamLatencyMs: 1437,
      incidentStartedAfterDeployment: true,
      timeoutErrorCount: 1
    });
  });

  it("derives the guarded release pair from active release state", () => {
    expect(
      buildReleasePairState({
        applicationActiveReleaseVersion: "2.8.0",
        currentRelease,
        previousRelease
      })
    ).toEqual({
      currentReleaseStatus: "DEGRADED",
      previousReleaseStatus: "STABLE",
      activeRelease: "CURRENT"
    });
  });

  it("maps recovery evidence to the exact canonical four-check gate", () => {
    const checks = validationChecksFromEvidence({
      stableReleaseRestored: true,
      errorRateBelowThreshold: true,
      syntheticTransactionSucceeded: true,
      noNewTimeoutErrors: true
    });

    expect(checks).toHaveLength(4);
    expect(checks.every((check) => check.required && check.status === "PASS")).toBe(true);
    expect(checks.map((check) => check.id).sort()).toEqual(
      ["error-rate", "stable-release", "synthetic-transaction", "timeout-errors"].sort()
    );
  });

  it("fails individual checks instead of manufacturing a successful gate", () => {
    const checks = validationChecksFromEvidence({
      stableReleaseRestored: true,
      errorRateBelowThreshold: false,
      syntheticTransactionSucceeded: true,
      noNewTimeoutErrors: false
    });

    expect(checks.find((check) => check.id === "error-rate")?.status).toBe("FAIL");
    expect(checks.find((check) => check.id === "timeout-errors")?.status).toBe("FAIL");
  });
});
