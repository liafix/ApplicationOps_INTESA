"use client";

import { GUIDED_STEPS } from "@/lib/ui/guided-workflow";
import { useGuidedWorkflow } from "./guided-workflow-provider";

export function WorkflowPreview() {
  const { step } = useGuidedWorkflow();
  return (
    <ol
      className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible"
      aria-label="ApplicationOps five-step workflow"
    >
      {GUIDED_STEPS.map((item) => {
        const isCurrent = step === item.step;
        const isComplete = step > item.step;
        return (
          <li
            key={item.step}
            aria-current={isCurrent ? "step" : undefined}
            className={`relative min-w-[220px] rounded-xl border p-3 transition lg:min-w-0 ${
              isCurrent
                ? "border-sky-400/40 bg-sky-400/[0.08]"
                : isComplete
                  ? "border-emerald-400/25 bg-emerald-400/[0.05]"
                  : "border-slate-800 bg-slate-950/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[11px] font-bold ${
                  isCurrent
                    ? "border-sky-300/50 bg-sky-200 text-slate-950"
                    : isComplete
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                      : "border-slate-700 bg-slate-900 text-slate-400"
                }`}
              >
                {isComplete ? "✓" : item.step}
              </span>
              <strong className="text-sm text-slate-100">{item.shortTitle}</strong>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">{item.description}</p>
          </li>
        );
      })}
    </ol>
  );
}
