import type { IncidentStatus } from "@/lib/domain/types";

export type GuidedStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface GuidedStepDefinition {
  step: Exclude<GuidedStep, 6>;
  title: string;
  shortTitle: string;
  description: string;
  actionLabel: string;
  targetId: string;
}

export const GUIDED_STEPS: readonly GuidedStepDefinition[] = [
  {
    step: 1,
    title: "Investigate the incident",
    shortTitle: "Investigate",
    description: "Take ownership and inspect the incident context before forming a conclusion.",
    actionLabel: "START INVESTIGATION",
    targetId: "incident"
  },
  {
    step: 2,
    title: "Compare the release evidence",
    shortTitle: "Compare",
    description: "Review the release change together with correlated request and log evidence.",
    actionLabel: "EVALUATE RELEASE EVIDENCE",
    targetId: "release-evidence"
  },
  {
    step: 3,
    title: "Choose a remediation action",
    shortTitle: "Decide",
    description:
      "Compare the available responses against the confirmed evidence before any recovery action is executed.",
    actionLabel: "REVIEW REMEDIATION OPTIONS",
    targetId: "remediation"
  },
  {
    step: 4,
    title: "Validate the recovery",
    shortTitle: "Validate",
    description: "Run the required recovery checks before allowing incident closure.",
    actionLabel: "RUN VALIDATION",
    targetId: "validation"
  },
  {
    step: 5,
    title: "Resolve the incident",
    shortTitle: "Resolve",
    description: "Close the incident only after all required validation checks have passed.",
    actionLabel: "RESOLVE INCIDENT",
    targetId: "resolution"
  }
] as const;

export function guidedStepFromIncidentStatus(status: IncidentStatus): GuidedStep {
  switch (status) {
    case "OPEN":
      return 1;
    case "INVESTIGATING":
      return 2;
    case "REGRESSION_CONFIRMED":
    case "REMEDIATION_SELECTED":
      return 3;
    case "ROLLING_BACK":
    case "READY_FOR_VALIDATION":
      return 4;
    case "VALIDATED":
      return 5;
    case "RESOLVED":
      return 6;
  }
}

export function isGuidedSectionUnlocked(
  currentStep: GuidedStep,
  requiredStep: Exclude<GuidedStep, 6>
) {
  return currentStep >= requiredStep;
}

export function guidedStepDefinition(step: GuidedStep): GuidedStepDefinition | null {
  if (step === 6) return null;
  return GUIDED_STEPS[step - 1] ?? null;
}

export function nextGuidedTargetAfterAction(stepBeforeAction: Exclude<GuidedStep, 6>): string {
  switch (stepBeforeAction) {
    case 1:
      return "release-evidence";
    case 2:
      return "root-cause-evidence";
    case 3:
      return "rollback-recovery";
    case 4:
      return "resolution";
    case 5:
      return "audit";
  }
}
