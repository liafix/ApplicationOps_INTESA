"use client";

import { useMemo } from "react";

import { useGuidedWorkflow } from "./guided-workflow-provider";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import {
  buildDiagnosticCorrelation,
  type DiagnosticIntegrityCheck,
  type DiagnosticTrailItem
} from "@/lib/ui/diagnostic-correlation";

const statusTone = {
  COMPLETE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  PARTIAL: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  MISMATCH: "border-rose-400/30 bg-rose-400/10 text-rose-200"
} as const;

const trailTone = {
  neutral: "border-slate-700 bg-slate-900/55",
  warning: "border-amber-400/25 bg-amber-400/[0.05]",
  danger: "border-rose-400/25 bg-rose-400/[0.05]"
} as const;

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(11, 19);
}

function IntegrityRow({ check }: { check: DiagnosticIntegrityCheck }) {
  const tone =
    check.status === "PASS"
      ? "text-emerald-300"
      : check.status === "FAIL"
        ? "text-rose-300"
        : "text-amber-300";

  return (
    <div className="grid gap-1 border-b border-slate-800/80 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4">
      <div>
        <p className="text-xs font-medium text-slate-200">{check.label}</p>
        <p className="mt-1 font-mono text-[11px] leading-5 text-slate-400">{check.detail}</p>
      </div>
      <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>{check.status}</span>
    </div>
  );
}

function TrailItem({ item, index }: { item: DiagnosticTrailItem; index: number }) {
  return (
    <div className="relative grid gap-3 sm:grid-cols-[56px_1fr]">
      <div className="flex sm:flex-col sm:items-center">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-950 font-mono text-[11px] font-semibold text-slate-300">
          {index + 1}
        </div>
        {index < 4 ? <div className="ml-4 h-full min-h-6 w-px bg-slate-800 sm:ml-0 sm:mt-2" /> : null}
      </div>
      <div className={`rounded-2xl border p-4 ${trailTone[item.tone]}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.key}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{item.label}</p>
          </div>
          <span className="font-mono text-[11px] text-slate-400">{formatTime(item.timestamp)}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-300">{item.detail}</p>
        <p className="mt-3 font-mono text-[10px] text-sky-300">link: {item.correlation}</p>
      </div>
    </div>
  );
}

export function DiagnosticCorrelation() {
  const { logs, requests, transactions, hydrating } = useGuidedWorkflow();

  const correlation = useMemo(
    () =>
      buildDiagnosticCorrelation({
        logs,
        requests,
        transactions,
        expected: {
          requestId: SCENARIO.requestId,
          transactionId: SCENARIO.transactionId,
          releaseVersion: SCENARIO.currentRelease.version,
          failureCode: SCENARIO.failureCode,
          httpStatus: SCENARIO.httpStatus,
          observedLatencyMs: SCENARIO.observedDownstreamLatencyMs
        }
      }),
    [logs, requests, transactions]
  );

  if (hydrating && !logs.length && !requests.length && !transactions.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-400">
        Loading diagnostic evidence…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5" aria-label="Correlation summary">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Single evidence trail</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Follow one failure across release, request, logs and transaction state.</h3>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
              These records are joined by synthetic correlation identifiers. A complete trail strengthens the investigation context, but correlation alone does not independently establish causation.
            </p>
          </div>
          <span className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone[correlation.status]}`}>
            Evidence {correlation.status}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#080d14] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Request ID</p>
            <p className="mt-1 font-mono text-xs text-sky-300">{SCENARIO.requestId}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#080d14] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Transaction ID</p>
            <p className="mt-1 font-mono text-xs text-sky-300">{SCENARIO.transactionId}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#080d14] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Affected release</p>
            <p className="mt-1 font-mono text-xs text-sky-300">v{SCENARIO.currentRelease.version}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5" aria-label="Correlated event timeline">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Timeline</p>
              <h3 className="mt-1 text-sm font-semibold text-white">Persisted evidence in sequence</h3>
            </div>
            <span className="text-[11px] text-slate-400">5 checkpoints</span>
          </div>
          <div className="mt-4 space-y-3">
            {correlation.trail.map((item, index) => (
              <TrailItem key={item.key} item={item} index={index} />
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5" aria-label="Correlation integrity checks">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Correlation integrity</p>
          <h3 className="mt-1 text-sm font-semibold text-white">Do the recorded evidence items agree?</h3>
          <div className="mt-3">
            {correlation.checks.map((item) => (
              <IntegrityRow key={item.key} check={item} />
            ))}
          </div>
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Log Explorer</h3>
            <span className="font-mono text-[10px] text-sky-300">{SCENARIO.requestId}</span>
          </div>
          <div className="mt-4 space-y-2">
            {correlation.correlatedLogs.length ? (
              correlation.correlatedLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-800/80 bg-[#080d14] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-mono text-[10px] font-semibold ${log.level === "ERROR" ? "text-rose-300" : log.level === "WARN" ? "text-amber-300" : "text-slate-400"}`}>
                      {log.level}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{formatTime(log.timestamp)}</span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-5 text-slate-300">{log.message}</p>
                </div>
              ))
            ) : (
              <p className="text-xs leading-5 text-amber-300">No logs were found for the canonical request ID.</p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white">Request Inspector</h3>
          {correlation.request ? (
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <div><dt className="text-slate-500">route</dt><dd className="mt-1 text-slate-200">{correlation.request.method} {correlation.request.path}</dd></div>
              <div><dt className="text-slate-500">request-id</dt><dd className="mt-1 text-sky-300">{correlation.request.requestId}</dd></div>
              <div><dt className="text-slate-500">release</dt><dd className="mt-1 text-slate-200">v{correlation.request.releaseVersion}</dd></div>
              <div><dt className="text-slate-500">response</dt><dd className="mt-1 text-rose-300">HTTP {correlation.request.responseStatus} · {correlation.request.durationMs} ms</dd></div>
              <div><dt className="text-slate-500">failure</dt><dd className="mt-1 text-rose-300">{correlation.request.failureCode ?? "NONE"}</dd></div>
            </dl>
          ) : (
            <p className="mt-4 text-xs leading-5 text-amber-300">Persisted request evidence is missing.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white">Data Inspector</h3>
          <div className="mt-4 rounded-xl border border-slate-800 bg-[#080d14] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Read-only diagnostic lookup · illustrative</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-5 text-slate-400">{`SELECT "id", "status", "applicationVersion", "failureCode"\nFROM "SyntheticTransaction"\nWHERE "id" = '${SCENARIO.transactionId}';`}</pre>
          </div>
          {correlation.transaction ? (
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <div><dt className="text-slate-500">id</dt><dd className="mt-1 text-sky-300">{correlation.transaction.id}</dd></div>
              <div><dt className="text-slate-500">requestId</dt><dd className="mt-1 text-sky-300">{correlation.transaction.requestId}</dd></div>
              <div><dt className="text-slate-500">status</dt><dd className="mt-1 text-rose-300">{correlation.transaction.status}</dd></div>
              <div><dt className="text-slate-500">applicationVersion</dt><dd className="mt-1 text-slate-200">v{correlation.transaction.applicationVersion}</dd></div>
              <div><dt className="text-slate-500">failureCode</dt><dd className="mt-1 text-rose-300">{correlation.transaction.failureCode ?? "NONE"}</dd></div>
            </dl>
          ) : (
            <p className="mt-4 text-xs leading-5 text-amber-300">Persisted transaction evidence is missing.</p>
          )}
        </article>
      </div>
    </div>
  );
}
