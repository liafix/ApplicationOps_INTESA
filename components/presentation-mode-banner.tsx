"use client";

import { useGuidedWorkflow } from "./guided-workflow-provider";

export function PresentationModeBanner() {
  const { runtimeMode } = useGuidedWorkflow();
  if (runtimeMode !== "presentation") return null;

  return (
    <aside
      aria-label="Recruiter presentation mode"
      className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.055] px-4 py-3 text-xs leading-5 text-slate-300 sm:px-5"
    >
      <span className="mr-2 font-semibold text-emerald-200">Recruiter Presentation Mode.</span>
      This live walkthrough uses deterministic synthetic state entirely in the browser, so it does not require PostgreSQL or access to any external bank system. The repository keeps the separate database-backed implementation and tests for technical review.
    </aside>
  );
}
