"use client";

import { SCENARIO } from "@/lib/data/synthetic-scenario";
import {
  rollbackAfterState,
  rollbackBeforeState,
  rollbackRecoveryEvidence,
  rollbackRecoveryMode
} from "@/lib/ui/rollback-recovery";
import { useGuidedWorkflow } from "./guided-workflow-provider";

function StateRow({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "positive";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-200"
      : tone === "warning"
        ? "text-amber-200"
        : "text-slate-200";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 py-3 last:border-b-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`text-right font-mono text-xs font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}

function EvidenceItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2.5">
      <span
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${ok ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-slate-700 bg-slate-950 text-slate-500"}`}
      >
        {ok ? "✓" : "·"}
      </span>
      <span className="text-xs leading-5 text-slate-300">{label}</span>
    </div>
  );
}

export function RollbackRecovery() {
  const { incident, releases, requests, transactions, logs, audit } = useGuidedWorkflow();
  const input = { incident, releases, requests, transactions, logs, audit };
  const mode = rollbackRecoveryMode(input);
  const evidence = rollbackRecoveryEvidence(input);
  const before = rollbackBeforeState();
  const after = rollbackAfterState(input);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Controlled recovery gate
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {mode === "READY"
                ? "Decision recorded. Rollback is ready for explicit execution."
                : mode === "EXECUTING"
                  ? "Rollback is executing against the controlled release state."
                  : mode === "RECOVERED"
                    ? "Rollback completed. Recovery evidence is recorded."
                    : mode === "INCONSISTENT"
                      ? "Post-rollback state is incomplete or inconsistent."
                      : "Rollback remains locked until the supported remediation is recorded."}
            </h3>
          </div>
          <span
            className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${mode === "RECOVERED" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : mode === "READY" ? "border-sky-400/30 bg-sky-400/10 text-sky-200" : mode === "INCONSISTENT" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-slate-700 bg-slate-900 text-slate-300"}`}
          >
            {mode}
          </span>
        </div>
        <p className="mt-3 max-w-4xl text-xs leading-5 text-slate-400">
          The rollback action is a separate controlled command. It restores the known-good synthetic
          release, updates service state and records recovery evidence as one guided transition.
          Formal recovery validation remains a separate explicit action after this recovery state is
          complete.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.035] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-300">
                Before rollback
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                Degraded release remains active
              </p>
            </div>
            <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-200">
              Baseline
            </span>
          </div>
          <dl className="mt-4">
            <StateRow label="Active release" value={`v${before.release}`} tone="warning" />
            <StateRow label="Release status" value={before.releaseStatus} tone="warning" />
            <StateRow label="Service health" value={before.serviceHealth} tone="warning" />
            <StateRow
              label="Synthetic error rate"
              value={`${before.errorRatePct}%`}
              tone="warning"
            />
            <StateRow label="Downstream timeout" value={`${before.timeoutMs} ms`} />
          </dl>
        </article>

        <article
          className={`rounded-2xl border p-5 ${mode === "RECOVERED" ? "border-emerald-400/25 bg-emerald-400/[0.045]" : "border-slate-800 bg-slate-950/60"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${mode === "RECOVERED" ? "text-emerald-300" : "text-slate-400"}`}
              >
                After rollback
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {mode === "RECOVERED"
                  ? "Known-good release restored"
                  : "Awaiting controlled recovery"}
              </p>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${mode === "RECOVERED" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-400"}`}
            >
              {mode === "RECOVERED" ? "Persisted" : "Pending"}
            </span>
          </div>
          <dl className="mt-4">
            <StateRow
              label="Active release"
              value={mode === "RECOVERED" ? `v${after.release}` : "PENDING"}
              tone={mode === "RECOVERED" ? "positive" : "neutral"}
            />
            <StateRow
              label="Restored release status"
              value={mode === "RECOVERED" ? String(after.releaseStatus) : "PENDING"}
              tone={mode === "RECOVERED" ? "positive" : "neutral"}
            />
            <StateRow
              label="Affected release status"
              value={mode === "RECOVERED" ? String(after.affectedReleaseStatus) : "PENDING"}
            />
            <StateRow
              label="Service health"
              value={mode === "RECOVERED" ? String(after.serviceHealth) : "PENDING"}
              tone={mode === "RECOVERED" ? "positive" : "neutral"}
            />
            <StateRow
              label="Synthetic error rate"
              value={
                mode === "RECOVERED" && after.errorRatePct !== null
                  ? `${after.errorRatePct}%`
                  : "PENDING"
              }
              tone={mode === "RECOVERED" ? "positive" : "neutral"}
            />
            <StateRow
              label="Downstream timeout"
              value={
                mode === "RECOVERED" && after.timeoutMs !== null
                  ? `${after.timeoutMs} ms`
                  : "PENDING"
              }
            />
          </dl>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Persisted recovery evidence
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <EvidenceItem
              ok={evidence.rollbackStarted}
              label="ROLLBACK_STARTED audit event recorded"
            />
            <EvidenceItem
              ok={evidence.rollbackCompleted}
              label="ROLLBACK_COMPLETED audit event recorded"
            />
            <EvidenceItem
              ok={evidence.affectedReleaseRolledBack}
              label={`v${SCENARIO.currentRelease.version} recorded as ROLLED_BACK`}
            />
            <EvidenceItem
              ok={evidence.previousReleaseActive}
              label={`v${SCENARIO.previousRelease.version} restored as active release`}
            />
            <EvidenceItem
              ok={evidence.recoveryRequestSucceeded}
              label={`${SCENARIO.recoveryRequestId} returned HTTP 200`}
            />
            <EvidenceItem
              ok={evidence.recoveryTransactionSucceeded}
              label={`${SCENARIO.recoveryTransactionId} completed successfully`}
            />
          </div>
        </article>

        <aside className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.045] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            Boundary
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-100">
            Recovery observed ≠ incident validated.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Even after the service returns to the synthetic healthy state, the four canonical
            validation checks remain a separate gate and must be evaluated from the recorded
            recovery evidence before closure.
          </p>
        </aside>
      </div>
    </div>
  );
}
