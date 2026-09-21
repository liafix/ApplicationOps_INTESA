"use client";

import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { REQUIRED_VALIDATION_DEFINITIONS } from "@/lib/domain/validation";
import { recoveryValidationView } from "@/lib/ui/recovery-validation";
import { useGuidedWorkflow } from "./guided-workflow-provider";

function EvidenceStatus({ ok }: { ok: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
        ok
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-rose-400/30 bg-rose-400/10 text-rose-200"
      }`}
    >
      {ok ? "Evidence ready" : "Evidence gap"}
    </span>
  );
}

function PersistedStatus({ status }: { status: "PENDING" | "PASS" | "FAIL" }) {
  const tone =
    status === "PASS"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : status === "FAIL"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : "border-slate-700 bg-slate-900 text-slate-300";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone}`}>
      {status}
    </span>
  );
}

export function RecoveryValidation() {
  const { incident, releases, requests, transactions, logs, audit, validation } = useGuidedWorkflow();
  const view = recoveryValidationView({
    incident,
    releases,
    requests,
    transactions,
    logs,
    audit,
    validation
  });

  const evidenceByKey = {
    "stable-release": view.evidence.stableReleaseRestored,
    "error-rate": view.evidence.errorRateBelowThreshold,
    "synthetic-transaction": view.evidence.syntheticTransactionSucceeded,
    "timeout-errors": view.evidence.noNewTimeoutErrors
  } as const;

  const detailByKey = {
    "stable-release": `v${SCENARIO.previousRelease.version} active + STABLE, v${SCENARIO.currentRelease.version} ROLLED_BACK, service HEALTHY`,
    "error-rate": `${incident?.application.syntheticErrorRate ?? "—"}% < ${SCENARIO.validationErrorRateThresholdPct}% synthetic threshold`,
    "synthetic-transaction": `${SCENARIO.recoveryRequestId} → HTTP 200 and ${SCENARIO.recoveryTransactionId} → SUCCEEDED on v${SCENARIO.previousRelease.version}`,
    "timeout-errors": `${view.evidence.timeoutErrorsAfterRollback} new ${SCENARIO.failureCode} ERROR logs after rollback completion`
  } as const;

  const title =
    view.mode === "READY"
      ? "Recovery evidence is ready for an evidence-derived 4/4 validation run."
      : view.mode === "VALIDATED"
        ? "Validation passed. All four required checks are recorded."
        : view.mode === "BLOCKED"
          ? "Validation is blocked by incomplete recovery evidence."
          : view.mode === "INCONSISTENT"
            ? "Validation state is inconsistent with the recorded evidence."
            : "Validation remains locked until controlled rollback completes.";

  const tone =
    view.mode === "VALIDATED"
      ? "border-emerald-400/25 bg-emerald-400/[0.045]"
      : view.mode === "READY"
        ? "border-sky-400/25 bg-sky-400/[0.045]"
        : view.mode === "BLOCKED" || view.mode === "INCONSISTENT"
          ? "border-rose-400/25 bg-rose-400/[0.04]"
          : "border-slate-800 bg-slate-950/60";

  return (
    <div className="space-y-4">
      <section className={`rounded-2xl border p-5 ${tone}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Recovery validation gate</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
          </div>
          <span className="w-fit rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
            {view.mode}
          </span>
        </div>
        <p className="mt-3 max-w-4xl text-xs leading-5 text-slate-400">
          The validation action evaluates the recorded release, service, request, transaction and log evidence, then records the four canonical check results together with the VALIDATED incident transition and validation audit events.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_310px]">
        <div className="space-y-3">
          {REQUIRED_VALIDATION_DEFINITIONS.map((definition) => {
            const persisted = validation.find((check) => check.key === definition.id);
            const evidenceReady = evidenceByKey[definition.id];
            return (
              <article key={definition.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{definition.id}</p>
                    <h4 className="mt-1 text-sm font-semibold text-slate-100">{definition.label}</h4>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{detailByKey[definition.id]}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <EvidenceStatus ok={evidenceReady} />
                    <PersistedStatus status={persisted?.status ?? "PENDING"} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Evidence readiness</p>
            <p className="mt-2 text-3xl font-semibold text-white">{view.evidencePassCount} / 4</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Observed directly from the post-rollback evidence state. This is not yet the authoritative validation result.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Recorded validation</p>
            <p className={`mt-2 text-3xl font-semibold ${view.persistedPassCount === 4 ? "text-emerald-200" : "text-white"}`}>
              {view.persistedPassCount} / 4
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {view.mode === "VALIDATED"
                ? "VALIDATION_STARTED and VALIDATION_PASSED are both present in the audit trail."
                : "The four checks remain PENDING until the explicit validation command succeeds."}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.045] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Closure boundary</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">4/4 validated ≠ incident resolved.</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">A successful validation only unlocks the next workflow stage. Incident resolution remains a separate explicit action.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
