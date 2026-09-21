import { describe, expect, it } from "vitest";
import {
  DomainError,
  assertRollbackAllowed,
  assessRootCause,
  remediationOptions,
  selectRemediation
} from "@/lib/domain";

const rootCause = assessRootCause({
  currentTimeoutMs: 800,
  previousTimeoutMs: 5000,
  observedDownstreamLatencyMs: 1437,
  incidentStartedAfterDeployment: true,
  timeoutErrorCount: 2
});

describe("remediation rules", () => {
  it("recommends a controlled rollback for confirmed regression", () => {
    const rollback = remediationOptions(rootCause).find((item) => item.action === "ROLLBACK_RELEASE");
    expect(rollback).toMatchObject({ recommended: true, risk: "MEDIUM" });
  });

  it("accepts rollback selection after regression confirmation", () => {
    expect(selectRemediation("REGRESSION_CONFIRMED", rootCause, "ROLLBACK_RELEASE")).toBe(
      "ROLLBACK_RELEASE"
    );
  });

  it("rejects a valid but unsupported remediation for this evidence set", () => {
    try {
      selectRemediation("REGRESSION_CONFIRMED", rootCause, "CHANGE_PRODUCTION_DATA");
      throw new Error("Expected DomainError");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ code: "REMEDIATION_NOT_SUPPORTED" });
    }
  });

  it("rejects remediation before regression confirmation", () => {
    expect(() => selectRemediation("INVESTIGATING", rootCause, "ROLLBACK_RELEASE")).toThrow(
      DomainError
    );
  });

  it("allows rollback only after rollback remediation was selected", () => {
    expect(() => assertRollbackAllowed("REMEDIATION_SELECTED", "ROLLBACK_RELEASE")).not.toThrow();
    try {
      assertRollbackAllowed("REGRESSION_CONFIRMED", "ROLLBACK_RELEASE");
      throw new Error("Expected DomainError");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ code: "REMEDIATION_NOT_SELECTED" });
    }
  });
});
