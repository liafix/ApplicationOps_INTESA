"use client";

import { useMemo, useState } from "react";

import type { RemediationAction } from "@/lib/domain/types";
import {
  REMEDIATION_OPTIONS,
  canRecordRemediationDecision,
  evidenceFitLabel,
  remediationDecisionMode,
  remediationOption
} from "@/lib/ui/remediation-decision";
import { useGuidedWorkflow } from "./guided-workflow-provider";

const riskTone = {
  LOW: "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200",
  MEDIUM: "border-amber-400/25 bg-amber-400/[0.06] text-amber-200",
  HIGH: "border-rose-400/25 bg-rose-400/[0.06] text-rose-200"
} as const;

const fitTone = {
  STRONG: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  WEAK: "border-amber-400/25 bg-amber-400/[0.06] text-amber-200",
  NO_EVIDENCE: "border-rose-400/25 bg-rose-400/[0.06] text-rose-200",
  FALLBACK: "border-slate-700 bg-slate-900 text-slate-300"
} as const;

export function RemediationDecision() {
  const { runtimeMode, incident, busy, submitRemediationDecision } = useGuidedWorkflow();
  const presentation = runtimeMode === "presentation";
  const [reviewedAction, setReviewedAction] = useState<RemediationAction | null>(null);

  const mode = remediationDecisionMode({
    status: incident?.status ?? "OPEN",
    rootCauseCode: incident?.rootCauseCode ?? null,
    selectedRemediation: incident?.selectedRemediation ?? null
  });

  const reviewed = useMemo(
    () => (reviewedAction ? remediationOption(reviewedAction) : null),
    [reviewedAction]
  );
  const canRecord = canRecordRemediationDecision({ mode, action: reviewedAction });

  if (mode === "LOCKED") {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Decision gate
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-200">
          Remediation stays locked until the root-cause decision is confirmed by the active demo
          engine.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Review the release and diagnostic evidence first. This prevents the recovery action from
          becoming a preselected answer.
        </p>
      </div>
    );
  }

  if (mode === "RECORDED") {
    const executed =
      incident?.status === "ROLLING_BACK" ||
      incident?.status === "READY_FOR_VALIDATION" ||
      incident?.status === "VALIDATED" ||
      incident?.status === "RESOLVED";
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
            Decision recorded
          </p>
          <p className="mt-2 text-xl font-semibold text-white">Rollback release</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {presentation ? "The presentation engine recorded " : "The guarded backend persisted "}
            <span className="font-mono text-sky-200">ROLLBACK_RELEASE</span> after the release
            regression was confirmed.{" "}
            {executed
              ? " The decision remains visible after execution for traceability."
              : " Recovery execution remains a separate controlled action."}
          </p>
        </div>
        <aside className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Why this decision fits
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The previous release is stable, the confirmed regression is release-level, and rollback
            is reversible for this synthetic scenario.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            {executed
              ? "Review the controlled rollback and recovery evidence in the next section."
              : "The rollback has not executed yet; use the guided controller when ready."}
          </p>
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Confirmed evidence checkpoint
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              Root cause: <span className="font-mono text-sky-200">RELEASE_TIMEOUT_REGRESSION</span>
            </p>
          </div>
          <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
            Nothing is preselected
          </span>
        </div>
        <p className="mt-3 max-w-4xl text-xs leading-5 text-slate-400">
          Select each option to inspect its risk and evidence fit. Only the action supported by the
          confirmed evidence can be recorded by the active workflow engine.
        </p>
      </div>

      <div
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        role="list"
        aria-label="Remediation options"
      >
        {REMEDIATION_OPTIONS.map((option) => {
          const active = reviewedAction === option.action;
          return (
            <button
              key={option.action}
              type="button"
              onClick={() => setReviewedAction(option.action)}
              aria-pressed={active}
              className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-950 ${active ? "border-sky-400/60 bg-sky-400/[0.08]" : "border-slate-800 bg-slate-950/60 hover:border-slate-700"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${riskTone[option.risk]}`}
                >
                  Risk {option.risk}
                </span>
                <span
                  className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${fitTone[option.evidenceFit]}`}
                >
                  {evidenceFitLabel(option.evidenceFit)}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-100">{option.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{option.reviewQuestion}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        {reviewed ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Decision review
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-white">{reviewed.title}</p>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${fitTone[reviewed.evidenceFit]}`}
                >
                  {evidenceFitLabel(reviewed.evidenceFit)}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                {reviewed.shortRationale}
              </p>
              {!reviewed.executableForScenario ? (
                <p className="mt-3 text-xs font-medium text-amber-200">
                  This option can be reviewed, but the guarded workflow will not accept it as the
                  successful remediation for this evidence set.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!canRecord || busy}
              onClick={() => reviewedAction && void submitRemediationDecision(reviewedAction)}
              className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {busy
                ? "RECORDING…"
                : canRecord
                  ? "RECORD REMEDIATION DECISION"
                  : "NOT SUPPORTED BY EVIDENCE"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Decision review
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-200">
              Choose an option above to evaluate it.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              The workflow intentionally starts with no remediation selected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
