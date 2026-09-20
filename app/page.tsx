import { CandidateDisclaimer } from "@/components/candidate-disclaimer";
import { PresentationModeBanner } from "@/components/presentation-mode-banner";
import { MetricCard } from "@/components/metric-card";
import { SectionHeading } from "@/components/section-heading";
import { WorkflowPreview } from "@/components/workflow-preview";
import { GuidedController } from "@/components/guided-controller";
import { GuidedNav } from "@/components/guided-nav";
import { GuidedWorkflowProvider } from "@/components/guided-workflow-provider";
import { ProgressiveGate } from "@/components/progressive-gate";
import { ReleaseComparison } from "@/components/release-comparison";
import { RootCauseEvidence } from "@/components/root-cause-evidence";
import { DiagnosticCorrelation } from "@/components/diagnostic-correlation";
import { RemediationDecision } from "@/components/remediation-decision";
import { RollbackRecovery } from "@/components/rollback-recovery";
import { RecoveryValidation } from "@/components/recovery-validation";
import { ResolutionHandoff } from "@/components/resolution-handoff";
import {
  GuidedActiveReleaseValue,
  GuidedAuditTrail,
  GuidedErrorRateValue,
  GuidedGateMetric,
  GuidedIncidentMetricDetail,
  GuidedIncidentStatusPill,
  GuidedServiceHealthValue,
  GuidedStageCopy
} from "@/components/guided-status";
import { CANDIDATE_DISCLAIMER, SCENARIO } from "@/lib/data/synthetic-scenario";

function StatusPill({
  children,
  tone = "neutral"
}: {
  children: string;
  tone?: "neutral" | "danger" | "warning" | "positive" | "info";
}) {
  const tones = {
    neutral: "border-slate-700 bg-slate-900 text-slate-300",
    danger: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    positive: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    info: "border-sky-400/30 bg-sky-400/10 text-sky-200"
  } as const;

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default function HomePage() {
  return (
    <GuidedWorkflowProvider>
      <main className="min-h-screen pb-32">
        <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="flex flex-col gap-5 border-b border-slate-800/90 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-sky-400/25 bg-sky-400/10 font-mono text-sm font-bold text-sky-200">
                AO
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-white">ApplicationOps</p>
                <p className="text-xs text-slate-400">Release &amp; Incident Support Console</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info">Independent candidate demo</StatusPill>
              <StatusPill>Synthetic data only</StatusPill>
            </div>
          </header>

          <section className="grid gap-5 py-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-stretch lg:py-10">
            <div className="rounded-3xl border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.88),rgba(6,11,18,0.92))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.24)] sm:p-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">
                Application Support Associate · Candidate Demonstrator
              </p>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-4xl lg:text-[46px]">
                A release went wrong. Trace the evidence, choose the safest recovery, and prove the
                service is healthy.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-[15px]">
                A synthetic transaction-processing service became degraded immediately after release{" "}
                {SCENARIO.currentRelease.version}. ApplicationOps keeps the incident, release diff,
                logs, request data, remediation decision and recovery checks in one guided support
                workflow.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    What happened?
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-slate-100">
                    Error rate jumped after a new release.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Your goal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-slate-100">
                    Find the regression and recover safely.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Why it matters
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-slate-100">
                    Do not close an incident without evidence.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="#incident"
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Start with the incident ↓
                </a>
                <GuidedStageCopy />
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Incident snapshot
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">{SCENARIO.incidentId}</p>
                </div>
                <StatusPill tone="danger">{SCENARIO.severity}</StatusPill>
              </div>

              <dl className="mt-5 divide-y divide-slate-800 text-sm">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-slate-400">Service health</dt>
                  <dd className="font-semibold text-amber-300">
                    <GuidedServiceHealthValue />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-slate-400">Active release</dt>
                  <dd className="font-mono text-slate-200">
                    <GuidedActiveReleaseValue />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-slate-400">Synthetic error rate</dt>
                  <dd className="font-semibold text-rose-300">
                    <GuidedErrorRateValue />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-slate-400">Failure</dt>
                  <dd className="font-mono text-xs text-slate-300">{SCENARIO.failureCode}</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                <p className="text-xs font-semibold text-amber-200">Signal to investigate</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  The incident begins shortly after deployment, so release context is the first
                  evidence path to inspect.
                </p>
              </div>
            </aside>
          </section>

          <CandidateDisclaimer text={CANDIDATE_DISCLAIMER} />
          <PresentationModeBanner />

          <section className="mt-5 rounded-2xl border border-sky-400/25 bg-[linear-gradient(180deg,rgba(14,25,40,0.94),rgba(8,15,24,0.94))] p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">
                  Guided path · workflow preview
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Five checkpoints from alert to safe closure
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                The workflow keeps investigation evidence and recovery decisions in a clear
                sequence.
              </p>
            </div>
            <div className="mt-4">
              <WorkflowPreview />
            </div>
          </section>

          <GuidedNav />

          <section id="incident" className="scroll-mt-20 py-10">
            <SectionHeading
              eyebrow="Incident workspace"
              title="Start with the user-visible symptom, then translate it into technical evidence."
              description="The initial workspace establishes ownership, impact and the first investigation hypothesis without pretending to know any real Intesa internal system."
            />
            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-semibold text-sky-300">
                      {SCENARIO.incidentId}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      Transaction processing degraded after release
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <StatusPill tone="danger">HIGH</StatusPill>
                    <GuidedIncidentStatusPill />
                  </div>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                  {SCENARIO.requestSummary}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Affected service
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{SCENARIO.serviceName}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Environment
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-200">{SCENARIO.environment}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      Affected release
                    </p>
                    <p className="mt-1 font-mono text-sm text-slate-200">
                      v{SCENARIO.currentRelease.version}
                    </p>
                  </div>
                </div>
              </article>

              <aside className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Investigation hypothesis
                </p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-100">
                  The service degraded shortly after v{SCENARIO.currentRelease.version} was
                  deployed.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Next evidence to compare: release configuration, correlated request latency and
                  timeout errors.
                </p>
              </aside>
            </div>

            <div
              className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
              aria-label="Initial application metrics"
            >
              <MetricCard
                label="Active incident"
                value="1"
                detail={<GuidedIncidentMetricDetail />}
                tone="warning"
              />
              <MetricCard
                label="Service health"
                value={<GuidedServiceHealthValue />}
                detail={SCENARIO.serviceName}
                tone="warning"
              />
              <MetricCard
                label="Error rate"
                value={<GuidedErrorRateValue />}
                detail={`Previous stable: ${SCENARIO.previousRelease.errorRatePct}%`}
                tone="danger"
              />
              <MetricCard
                label="Recovery gate"
                value={<GuidedGateMetric />}
                detail="Validation required before closure"
              />
            </div>
          </section>

          <ProgressiveGate requiredStep={2}>
            <section id="release-evidence" className="scroll-mt-20 border-t border-slate-900 py-10">
              <SectionHeading
                eyebrow="Release comparison"
                title="Compare the change, then decide whether it is evidence or merely coincidence."
                description="Observable release facts stay separate from the root-cause decision. Configuration, timing and latency can strengthen a hypothesis, but the conclusion remains hidden until the guarded evaluation succeeds."
              />
              <ReleaseComparison />
              <div className="mt-4">
                <RootCauseEvidence />
              </div>
            </section>
          </ProgressiveGate>

          <ProgressiveGate requiredStep={2}>
            <section id="diagnostics" className="scroll-mt-20 border-t border-slate-900 py-10">
              <SectionHeading
                eyebrow="Diagnostics"
                title="Verify the release signal across logs, HTTP evidence and transaction state."
                description={`The synthetic request ${SCENARIO.requestId}, transaction ${SCENARIO.transactionId} and release v${SCENARIO.currentRelease.version} intentionally appear across each evidence panel.`}
              />
              <DiagnosticCorrelation />
            </section>
          </ProgressiveGate>

          <ProgressiveGate requiredStep={3}>
            <section id="remediation" className="scroll-mt-20 border-t border-slate-900 py-10">
              <SectionHeading
                eyebrow="Remediation decision"
                title="Evaluate the options before committing to a recovery action."
                description="Nothing is preselected. Compare risk, evidence fit and reversibility, then record only the remediation that the guarded workflow accepts for the confirmed regression."
              />
              <RemediationDecision />
            </section>
          </ProgressiveGate>

          <ProgressiveGate requiredStep={3}>
            <section
              id="rollback-recovery"
              className="scroll-mt-20 border-t border-slate-900 py-10"
            >
              <SectionHeading
                eyebrow="Controlled rollback & recovery"
                title="Execute the reversible action, then compare the controlled service state before and after."
                description="The rollback restores the known-good synthetic release and records recovery evidence as one controlled transition. Recovery is visible here, while formal validation remains a separate next-stage gate."
              />
              <RollbackRecovery />
            </section>
          </ProgressiveGate>

          <ProgressiveGate requiredStep={4}>
            <section id="validation" className="scroll-mt-20 border-t border-slate-900 py-10">
              <SectionHeading
                eyebrow="Recovery validation"
                title="Prove recovery with four explicit checks before allowing closure."
                description="The validation engine derives every check from the post-rollback evidence. Evidence readiness and the validation result remain separate until the explicit validation action succeeds."
              />
              <RecoveryValidation />
            </section>
          </ProgressiveGate>

          <ProgressiveGate requiredStep={5}>
            <section id="resolution" className="scroll-mt-20 border-t border-slate-900 py-10">
              <SectionHeading
                eyebrow="Resolution & handoff"
                title="Translate the technical recovery into a concise stakeholder update."
                description="This workspace is disclosed only after recovery validation passes, keeping technical recovery separate from confirmed incident closure."
              />
              <ResolutionHandoff />
            </section>
          </ProgressiveGate>

          <section id="audit" className="scroll-mt-20 border-t border-slate-900 py-10">
            <SectionHeading
              eyebrow="Audit trail"
              title="Keep the initial operational context visible for handoff and review."
              description="The initial pre-investigation events establish what happened before the support analyst takes ownership, preserving context for handoff and review."
            />
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
              <GuidedAuditTrail />
            </div>
          </section>

          <footer className="border-t border-slate-800 py-6 text-xs leading-5 text-slate-400">
            ApplicationOps · Independent candidate demonstrator · Synthetic data only · Not an
            Intesa Sanpaolo product or representation of its internal architecture.
          </footer>
        </div>
        <GuidedController />
      </main>
    </GuidedWorkflowProvider>
  );
}
