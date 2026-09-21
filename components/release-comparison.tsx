import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { formatDuration, millisecondsBetween } from "@/lib/ui/release-evidence";

function EvidenceLabel({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
      {children}
    </span>
  );
}

export function ReleaseComparison() {
  const deploymentToIncidentMs = millisecondsBetween(
    SCENARIO.timeline.currentReleaseDeployedAt,
    SCENARIO.timeline.incidentCreatedAt
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-200">Previous release</span>
            <EvidenceLabel>known stable baseline</EvidenceLabel>
          </div>
          <p className="mt-5 font-mono text-2xl font-semibold text-white">v{SCENARIO.previousRelease.version}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Downstream timeout</dt>
              <dd className="font-mono text-slate-200">{SCENARIO.previousRelease.downstreamTimeoutMs} ms</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Synthetic error rate</dt>
              <dd className="font-mono text-slate-200">{SCENARIO.previousRelease.errorRatePct}%</dd>
            </div>
          </dl>
        </article>

        <div className="hidden place-items-center px-1 text-slate-500 lg:grid" aria-hidden="true">→</div>

        <article className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-200">Current release</span>
            <EvidenceLabel>active during incident</EvidenceLabel>
          </div>
          <p className="mt-5 font-mono text-2xl font-semibold text-white">v{SCENARIO.currentRelease.version}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Downstream timeout</dt>
              <dd className="font-mono text-slate-200">{SCENARIO.currentRelease.downstreamTimeoutMs} ms</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Synthetic error rate</dt>
              <dd className="font-mono text-slate-200">{SCENARIO.currentRelease.errorRatePct}%</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#060a10]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Configuration delta</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">Observed change</span>
          </div>
          <pre className="overflow-x-auto p-4 text-xs leading-7"><code><span className="text-slate-400">- downstream_timeout_ms: {SCENARIO.previousRelease.downstreamTimeoutMs}</span>{"\n"}<span className="text-sky-300">+ downstream_timeout_ms: {SCENARIO.currentRelease.downstreamTimeoutMs}</span></code></pre>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Timing signal</p>
            <p className="mt-2 text-sm font-semibold text-white">Incident opened {formatDuration(deploymentToIncidentMs)} after deployment.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Runtime signal</p>
            <p className="mt-2 text-sm font-semibold text-white">Observed latency: {SCENARIO.observedDownstreamLatencyMs} ms.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Question to answer</p>
            <p className="mt-2 text-sm font-semibold text-white">Does the evidence support a release-level regression?</p>
          </div>
        </div>
      </div>
    </div>
  );
}
