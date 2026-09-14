import { describe, expect, it } from "vitest";
import {
  guidedStepDefinition,
  guidedStepFromIncidentStatus,
  isGuidedSectionUnlocked,
  nextGuidedTargetAfterAction
} from "@/lib/ui/guided-workflow";

describe("guided workflow", () => {
  it("maps persisted incident states to the five-step walkthrough", () => {
    expect(guidedStepFromIncidentStatus("OPEN")).toBe(1);
    expect(guidedStepFromIncidentStatus("INVESTIGATING")).toBe(2);
    expect(guidedStepFromIncidentStatus("REGRESSION_CONFIRMED")).toBe(3);
    expect(guidedStepFromIncidentStatus("REMEDIATION_SELECTED")).toBe(3);
    expect(guidedStepFromIncidentStatus("READY_FOR_VALIDATION")).toBe(4);
    expect(guidedStepFromIncidentStatus("VALIDATED")).toBe(5);
    expect(guidedStepFromIncidentStatus("RESOLVED")).toBe(6);
  });

  it("unlocks sections progressively", () => {
    expect(isGuidedSectionUnlocked(1, 1)).toBe(true);
    expect(isGuidedSectionUnlocked(1, 2)).toBe(false);
    expect(isGuidedSectionUnlocked(3, 2)).toBe(true);
    expect(isGuidedSectionUnlocked(4, 5)).toBe(false);
    expect(isGuidedSectionUnlocked(6, 5)).toBe(true);
  });

  it("exposes one action definition per active guided step", () => {
    expect(guidedStepDefinition(1)?.actionLabel).toBe("START INVESTIGATION");
    expect(guidedStepDefinition(2)?.actionLabel).toBe("EVALUATE RELEASE EVIDENCE");
    expect(guidedStepDefinition(3)?.actionLabel).toBe("REVIEW REMEDIATION OPTIONS");
    expect(guidedStepDefinition(5)?.actionLabel).toBe("RESOLVE INCIDENT");
    expect(guidedStepDefinition(6)).toBeNull();
  });

  it("scrolls to the next unlocked evidence section", () => {
    expect(nextGuidedTargetAfterAction(1)).toBe("release-evidence");
    expect(nextGuidedTargetAfterAction(2)).toBe("root-cause-evidence");
    expect(nextGuidedTargetAfterAction(3)).toBe("rollback-recovery");
    expect(nextGuidedTargetAfterAction(4)).toBe("resolution");
    expect(nextGuidedTargetAfterAction(5)).toBe("audit");
  });
});
