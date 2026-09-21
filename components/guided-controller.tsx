"use client";

import { guidedStepDefinition } from "@/lib/ui/guided-workflow";
import { useGuidedWorkflow } from "./guided-workflow-provider";

export function GuidedController() {
  const { runtimeMode, step, busy, hydrating, error, runPrimaryAction, resetDemo, incident } = useGuidedWorkflow();
  const presentation = runtimeMode === "presentation";
  const definition = guidedStepDefinition(step);
  const completed = step === 6;
  const decisionRecorded = step === 3 && incident?.status === "REMEDIATION_SELECTED" && incident.selectedRemediation === "ROLLBACK_RELEASE";
  const rollbackComplete = incident?.status === "READY_FOR_VALIDATION";
  const rollbackExecuting = incident?.status === "ROLLING_BACK";
  const validationComplete = incident?.status === "VALIDATED";

  const title = completed
    ? "Incident resolved with the validation gate satisfied."
    : validationComplete
      ? "Recovery validation passed. The incident is ready for explicit closure."
      : rollbackComplete
        ? "Recovery evidence is ready for explicit validation."
        : rollbackExecuting
          ? "Controlled rollback is executing."
          : decisionRecorded
            ? "Remediation decision recorded. Execute the rollback as a separate controlled action."
            : definition?.title;

  const description = completed
    ? "Reset the synthetic scenario to replay the walkthrough."
    : validationComplete
      ? presentation
        ? "Resolve only after the synthetic 4/4 validation gate has passed; the presentation engine will create both closure summaries from the browser evidence state."
        : "Resolve only after the persisted 4/4 validation gate has passed; the server will create both closure summaries atomically."
      : rollbackComplete
        ? presentation
          ? "Run the four deterministic checks against the synthetic post-rollback evidence before allowing closure."
          : "Run the four server-derived checks against the persisted post-rollback evidence before allowing closure."
        : rollbackExecuting
          ? presentation
            ? "The synthetic release and application state are being changed in the browser presentation engine."
            : "The persisted release and application state are being changed atomically."
          : decisionRecorded
            ? presentation
              ? "The presentation engine will restore the known-good synthetic release and write deterministic recovery evidence in browser state."
              : "The guarded backend will restore the known-good synthetic release and write recovery evidence in one transaction."
            : definition?.description;

  const actionLabel = busy
    ? "WORKING…"
    : completed
      ? "RESET DEMO ↻"
      : validationComplete
        ? "RESOLVE INCIDENT"
        : rollbackComplete
          ? "RUN RECOVERY VALIDATION"
          : rollbackExecuting
            ? "ROLLBACK IN PROGRESS"
            : decisionRecorded
              ? "EXECUTE CONTROLLED ROLLBACK"
              : definition?.actionLabel;

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-700/80 bg-slate-950/95 shadow-[0_-16px_50px_rgba(0,0,0,0.35)] backdrop-blur"
      aria-label="Guided workflow controller"
    >
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              {completed ? "Complete" : `Step ${step} of 5`}
            </span>
            <span className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${presentation ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200" : "border-sky-400/25 bg-sky-400/[0.06] text-sky-200"}`}>
              {presentation ? "Presentation mode" : "DB-backed mode"}
            </span>
            {incident?.status ? <span className="font-mono text-[11px] text-slate-400">{incident.status}</span> : null}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-white">{title}</p>
          <p className="mt-0.5 hidden max-w-3xl text-xs text-slate-400 sm:block">{description}</p>
          <div className="mt-1 min-h-4" aria-live="polite">
            {error ? <p className="text-xs text-rose-300">{error}</p> : hydrating ? <p className="text-xs text-slate-400">Loading database-backed workflow state…</p> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={completed ? () => void resetDemo() : () => void runPrimaryAction()}
          disabled={busy || hydrating || rollbackExecuting}
          className="shrink-0 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold tracking-[0.01em] text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          {actionLabel}
        </button>
      </div>
    </aside>
  );
}
