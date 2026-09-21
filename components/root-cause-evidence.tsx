"use client";

import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { rootCauseDisclosureState } from "@/lib/ui/release-evidence";
import { useGuidedWorkflow } from "@/components/guided-workflow-provider";

function SignalRow({ label, value, interpretation }: { label: string; value: string; interpretation: string }) {
  return (
    <div className="grid gap-2 border-b border-slate-800/80 py-3 last:border-b-0 sm:grid-cols-[170px_170px_1fr] sm:items-center">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <span className="font-mono text-xs text-slate-100">{value}</span>
      <span className="text-xs leading-5 text-slate-400">{interpretation}</span>
    </div>
  );
}

export function RootCauseEvidence() {
  const { incident } = useGuidedWorkflow();
  const status = incident?.status ?? "OPEN";
  const disclosure = rootCauseDisclosureState(status, incident?.rootCauseCode);

  if (disclosure === "LOCKED") return null;

  const confirmed = disclosure === "CONFIRMED";

  return (
    <section id="root-cause-evidence" className={`rounded-2xl border p-5 sm:p-6 ${confirmed ? "border-emerald-400/25 bg-emerald-400/[0.045]" : "border-amber-400/20 bg-amber-400/[0.04]"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${confirmed ? "text-emerald-300" : "text-amber-300"}`}>
            {confirmed ? "Root-cause decision · recorded" : "Root-cause checkpoint · hypothesis"}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {confirmed ? "The guarded evidence engine confirmed the regression." : "The signals line up, but correlation is not yet a conclusion."}
          </h3>
        </div>
        <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${confirmed ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
          {confirmed ? "CONFIRMED" : "HYPOTHESIS OPEN"}
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/55 px-4">
        <SignalRow
          label="Release timing"
          value="deploy → incident"
          interpretation="The incident begins after the new release, which supports investigation but does not prove causation."
        />
        <SignalRow
          label="Timeout change"
          value={`${SCENARIO.previousRelease.downstreamTimeoutMs} → ${SCENARIO.currentRelease.downstreamTimeoutMs} ms`}
          interpretation="The active release introduced a materially lower downstream timeout than the known stable baseline."
        />
        <SignalRow
          label="Observed latency"
          value={`${SCENARIO.observedDownstreamLatencyMs} ms`}
          interpretation={`The observed latency is above the new ${SCENARIO.currentRelease.downstreamTimeoutMs} ms timeout and below the previous ${SCENARIO.previousRelease.downstreamTimeoutMs} ms timeout.`}
        />
      </div>

      {confirmed ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.42fr_0.58fr]">
          <div className="rounded-xl border border-emerald-400/20 bg-slate-950/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Recorded root-cause code</p>
            <p className="mt-2 break-words font-mono text-sm font-semibold text-emerald-200">{incident?.rootCauseCode}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Why it was confirmed</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {incident?.technicalSummary ?? "The guarded assessment confirmed the release regression from the available synthetic evidence."}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.045] p-4">
          <p className="text-xs font-semibold text-sky-200">Investigation rule</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            Do not label the release as the root cause from timing or configuration alone. Review the diagnostics below, then use the guided evidence-evaluation action. The conclusion is revealed only after the guarded evaluation succeeds.
          </p>
        </div>
      )}
    </section>
  );
}
