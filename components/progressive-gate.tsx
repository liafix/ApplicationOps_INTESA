"use client";

import type { ReactNode } from "react";
import { useGuidedWorkflow } from "./guided-workflow-provider";
import { isGuidedSectionUnlocked, type GuidedStep } from "@/lib/ui/guided-workflow";

export function ProgressiveGate({
  requiredStep,
  children
}: {
  requiredStep: Exclude<GuidedStep, 6>;
  children: ReactNode;
}) {
  const { step } = useGuidedWorkflow();
  if (!isGuidedSectionUnlocked(step, requiredStep)) return null;
  return <>{children}</>;
}
