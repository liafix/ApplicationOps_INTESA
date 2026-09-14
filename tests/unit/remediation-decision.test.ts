import { describe, expect, it } from "vitest";

import {
  REMEDIATION_OPTIONS,
  canRecordRemediationDecision,
  evidenceFitLabel,
  remediationDecisionMode,
  remediationOption
} from "@/lib/ui/remediation-decision";

describe("remediation decision presentation", () => {
  it("starts locked before the persisted regression is confirmed", () => {
    expect(
      remediationDecisionMode({
        status: "INVESTIGATING",
        rootCauseCode: null,
        selectedRemediation: null
      })
    ).toBe("LOCKED");
  });

  it("becomes ready only for the persisted release timeout regression", () => {
    expect(
      remediationDecisionMode({
        status: "REGRESSION_CONFIRMED",
        rootCauseCode: "RELEASE_TIMEOUT_REGRESSION",
        selectedRemediation: null
      })
    ).toBe("READY");

    expect(
      remediationDecisionMode({
        status: "REGRESSION_CONFIRMED",
        rootCauseCode: "INSUFFICIENT_EVIDENCE",
        selectedRemediation: null
      })
    ).toBe("LOCKED");
  });

  it("presents all four response options without preselecting one", () => {
    expect(REMEDIATION_OPTIONS.map((option) => option.action)).toEqual([
      "RETRY_FAILED_TRANSACTIONS",
      "CHANGE_PRODUCTION_DATA",
      "ROLLBACK_RELEASE",
      "ESCALATE_WITHOUT_ACTION"
    ]);
  });

  it("marks rollback as the only executable option for this evidence set", () => {
    const rollback = remediationOption("ROLLBACK_RELEASE");
    expect(rollback).toMatchObject({ evidenceFit: "STRONG", risk: "MEDIUM", executableForScenario: true });

    for (const action of [
      "RETRY_FAILED_TRANSACTIONS",
      "CHANGE_PRODUCTION_DATA",
      "ESCALATE_WITHOUT_ACTION"
    ] as const) {
      expect(remediationOption(action).executableForScenario).toBe(false);
    }
  });

  it("records only a supported decision while the decision gate is ready", () => {
    expect(canRecordRemediationDecision({ mode: "READY", action: "ROLLBACK_RELEASE" })).toBe(true);
    expect(canRecordRemediationDecision({ mode: "READY", action: "CHANGE_PRODUCTION_DATA" })).toBe(false);
    expect(canRecordRemediationDecision({ mode: "LOCKED", action: "ROLLBACK_RELEASE" })).toBe(false);
  });

  it("keeps the recorded decision visible through rollback and recovery", () => {
    for (const status of ["REMEDIATION_SELECTED", "ROLLING_BACK", "READY_FOR_VALIDATION", "VALIDATED", "RESOLVED"] as const) {
      expect(
        remediationDecisionMode({
          status,
          rootCauseCode: "RELEASE_TIMEOUT_REGRESSION",
          selectedRemediation: "ROLLBACK_RELEASE"
        })
      ).toBe("RECORDED");
    }
  });

  it("uses neutral evidence-fit language rather than claiming universal safety", () => {
    expect(evidenceFitLabel("STRONG")).toBe("Strong evidence fit");
    expect(evidenceFitLabel("FALLBACK")).toBe("Fallback path");
  });
});
