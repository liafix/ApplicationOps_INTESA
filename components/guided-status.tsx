"use client";

import { useGuidedWorkflow } from "./guided-workflow-provider";

const statusTone: Record<string, string> = {
  OPEN: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  INVESTIGATING: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  REGRESSION_CONFIRMED: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  REMEDIATION_SELECTED: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  ROLLING_BACK: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  READY_FOR_VALIDATION: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  VALIDATED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  RESOLVED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
};

export function GuidedIncidentStatusPill() {
  const { incident } = useGuidedWorkflow();
  const status = incident?.status ?? "OPEN";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusTone[status] ?? statusTone.OPEN}`}>{status}</span>;
}

export function GuidedStageCopy() {
  const { step } = useGuidedWorkflow();
  if (step === 6) return <span className="text-xs text-emerald-300">Walkthrough complete · incident safely resolved.</span>;
  return <span className="text-xs text-slate-400">Stage {step} of 5 · Follow the evidence in sequence.</span>;
}

export function GuidedGateMetric() {
  const { validation } = useGuidedWorkflow();
  const passed = validation.filter((check) => check.required && check.status === "PASS").length;
  return <>{passed} / 4</>;
}

export function GuidedValidationChecks() {
  const { validation } = useGuidedWorkflow();
  const checks = validation.length ? validation : [];
  if (!checks.length) {
    return <p className="text-sm text-slate-400">Validation state is loading from the active demo scenario.</p>;
  }
  return (
    <div className="space-y-2">
      {checks.map((check) => (
        <div key={check.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/45 px-4 py-3">
          <span className="text-sm text-slate-300">{check.label}</span>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${check.status === "PASS" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : check.status === "FAIL" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-slate-700 bg-slate-900 text-slate-300"}`}>
            {check.status}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GuidedResolutionState() {
  const { incident, validation } = useGuidedWorkflow();
  const passed = validation.filter((check) => check.required && check.status === "PASS").length;
  const status = incident?.status ?? "OPEN";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Resolution gate</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {status === "RESOLVED"
            ? "The incident has passed validation and is now resolved."
            : status === "VALIDATED"
              ? "Recovery validation is complete. Incident resolution remains a separate explicit action and has not been executed."
              : "Recovery validation must complete before incident resolution becomes available."}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Current technical state</p>
        <p className="mt-3 font-mono text-xs leading-6 text-slate-300">
          rootCause: {incident?.rootCauseCode ?? "PENDING"}<br />
          recoveredRelease: {incident?.recoveredRelease ?? "PENDING"}<br />
          validation: {passed}/4<br />
          incidentStatus: {status}
        </p>
      </div>
    </div>
  );
}

export function GuidedAuditTrail() {
  const { audit } = useGuidedWorkflow();
  if (!audit.length) return <p className="text-sm text-slate-400">Audit events are loading from the active demo scenario.</p>;
  return (
    <div className="space-y-1">
      {audit.map((event) => {
        const date = new Date(event.timestamp);
        const timestamp = Number.isNaN(date.getTime()) ? event.timestamp : date.toISOString().slice(11, 19);
        return (
          <div key={event.id} className="grid gap-2 border-b border-slate-800/80 py-3 last:border-b-0 sm:grid-cols-[110px_1fr_auto] sm:items-center">
            <span className="font-mono text-[11px] text-slate-400">{timestamp}</span>
            <span className="text-xs font-medium text-slate-300">{event.type}</span>
            <span className="text-[11px] text-slate-400">{event.actor}</span>
          </div>
        );
      })}
    </div>
  );
}

export function GuidedServiceHealthValue() {
  const { incident } = useGuidedWorkflow();
  const value = incident?.application.serviceHealth ?? "DEGRADED";
  return <>{value}</>;
}

export function GuidedActiveReleaseValue() {
  const { incident } = useGuidedWorkflow();
  return <>v{incident?.application.activeReleaseVersion ?? "2.8.0"}</>;
}

export function GuidedErrorRateValue() {
  const { incident } = useGuidedWorkflow();
  const value = incident?.application.syntheticErrorRate ?? 14.8;
  return <>{value}%</>;
}

export function GuidedIncidentMetricDetail() {
  const { incident } = useGuidedWorkflow();
  return <>{incident?.id ?? "APP-2047"} · {incident?.status ?? "OPEN"}</>;
}
