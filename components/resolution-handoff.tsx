"use client";

import { resolutionHandoffView } from "@/lib/ui/resolution-handoff";
import type { ValidationCheckId } from "@/lib/domain/types";
import { useGuidedWorkflow } from "./guided-workflow-provider";

export function ResolutionHandoff() {
  const { incident, releases, requests, transactions, logs, audit, validation } =
    useGuidedWorkflow();
  const view = resolutionHandoffView({
    incident,
    releases,
    requests,
    transactions,
    logs,
    audit,
    validation: validation.map((c) => ({
      id: c.key as ValidationCheckId,
      label: c.label,
      required: c.required,
      status: c.status
    }))
  });

  const tone =
    view.mode === "RESOLVED"
      ? "border-emerald-400/25 bg-emerald-400/[0.045]"
      : view.mode === "READY"
        ? "border-sky-400/25 bg-sky-400/[0.045]"
        : view.mode === "INCONSISTENT"
          ? "border-rose-400/25 bg-rose-400/[0.04]"
          : "border-slate-800 bg-slate-950/60";

  return (
    <div className="space-y-4">
      <section className={`rounded-2xl border p-5 ${tone}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Resolution gate
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {view.mode === "RESOLVED"
                ? "Incident resolved with a recorded closure handoff."
                : view.mode === "READY"
                  ? "Validated recovery is ready for explicit incident closure."
                  : view.mode === "INCONSISTENT"
                    ? "Closure state is inconsistent with the recorded evidence."
                    : "Resolution stays locked until validation passes."}
            </h3>
          </div>
          <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
            {view.mode}
          </span>
        </div>
        <p className="mt-3 max-w-4xl text-xs leading-5 text-slate-400">
          The closure engine derives both summaries from the recorded root-cause, rollback and 4/4
          validation evidence. The incident is marked resolved only after the explicit closure
          action succeeds.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
            Technical closure summary
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {incident?.closureTechnicalSummary ??
              "Generated and recorded only when the explicit RESOLVE INCIDENT action succeeds."}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Business-facing handoff
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {incident?.closureBusinessSummary ??
              "A concise stakeholder update becomes available only after the explicit resolution action succeeds."}
          </p>
        </article>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Closure evidence
        </p>
        <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <span>Validation: {view.validationPassCount}/4 PASS</span>
          <span>Handoff audit: {view.handoffAudit ? "present" : "pending"}</span>
          <span>Resolution audit: {view.resolvedAudit ? "present" : "pending"}</span>
        </div>
      </div>
    </div>
  );
}
