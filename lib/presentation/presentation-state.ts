import { buildSyntheticScenarioSeed, SCENARIO } from "@/lib/data/synthetic-scenario";
import { assessRootCause } from "@/lib/domain/root-cause";
import type { IncidentStatus, ReleaseStatus, RemediationAction, ValidationStatus } from "@/lib/domain/types";
import { deriveRecoveryValidationEvidence, recoveryEvidencePassCount } from "@/lib/evidence/recovery-validation";
import { deriveResolutionHandoff } from "@/lib/evidence/resolution-handoff";

export type PresentationRuntimeMode = "presentation" | "server";

export interface PresentationIncidentView {
  id: string;
  status: IncidentStatus;
  rootCauseCode: string | null;
  technicalSummary: string | null;
  closureTechnicalSummary: string | null;
  closureBusinessSummary: string | null;
  selectedRemediation: string | null;
  affectedRelease: string;
  recoveredRelease: string | null;
  application: {
    serviceHealth: string;
    activeReleaseVersion: string;
    syntheticErrorRate: number;
  };
}

export interface PresentationReleaseView {
  id: string;
  version: string;
  status: ReleaseStatus;
  downstreamTimeoutMs: number;
  syntheticErrorRate: number;
  deployedAt: string | null;
}

export interface PresentationReleasesView {
  previous: PresentationReleaseView;
  current: PresentationReleaseView;
  activeReleaseVersion: string;
  diff: {
    downstreamTimeoutMs: { previous: number; current: number };
    syntheticErrorRate: { previous: number; current: number };
  };
}

export interface PresentationValidationView {
  id: string;
  key: string;
  label: string;
  required: boolean;
  status: ValidationStatus;
}

export interface PresentationAuditView {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
}

export interface PresentationDiagnosticLogView {
  id: string;
  incidentId: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  requestId: string | null;
  service: string;
  message: string;
}

export interface PresentationRequestView {
  id: string;
  incidentId: string;
  requestId: string;
  method: string;
  path: string;
  responseStatus: number;
  durationMs: number;
  releaseVersion: string;
  failureCode: string | null;
  createdAt: string;
}

export interface PresentationTransactionView {
  id: string;
  incidentId: string;
  requestId: string;
  status: "FAILED" | "SUCCEEDED";
  applicationVersion: string;
  failureCode: string | null;
  createdAt: string;
}

export interface PresentationState {
  incident: PresentationIncidentView;
  validation: PresentationValidationView[];
  releases: PresentationReleasesView;
  audit: PresentationAuditView[];
  logs: PresentationDiagnosticLogView[];
  requests: PresentationRequestView[];
  transactions: PresentationTransactionView[];
}

const T = {
  investigation: "2026-09-02T07:33:00.000Z",
  comparison: "2026-09-02T07:34:00.000Z",
  regression: "2026-09-02T07:34:01.000Z",
  remediation: "2026-09-02T07:35:00.000Z",
  rollbackStarted: "2026-09-02T07:36:00.000Z",
  rollbackCompleted: "2026-09-02T07:36:01.000Z",
  recovery: "2026-09-02T07:36:02.000Z",
  validationStarted: "2026-09-02T07:37:00.000Z",
  validationPassed: "2026-09-02T07:37:01.000Z",
  handoff: "2026-09-02T07:38:00.000Z",
  resolved: "2026-09-02T07:38:01.000Z"
} as const;

function audit(id: string, type: string, actor: string, timestamp: string): PresentationAuditView {
  return { id, type, actor, timestamp };
}

function cloneState(state: PresentationState): PresentationState {
  return {
    incident: {
      ...state.incident,
      application: { ...state.incident.application }
    },
    validation: state.validation.map((check) => ({ ...check })),
    releases: {
      ...state.releases,
      previous: { ...state.releases.previous },
      current: { ...state.releases.current },
      diff: {
        downstreamTimeoutMs: { ...state.releases.diff.downstreamTimeoutMs },
        syntheticErrorRate: { ...state.releases.diff.syntheticErrorRate }
      }
    },
    audit: state.audit.map((event) => ({ ...event })),
    logs: state.logs.map((log) => ({ ...log })),
    requests: state.requests.map((request) => ({ ...request })),
    transactions: state.transactions.map((transaction) => ({ ...transaction }))
  };
}

export function createPresentationState(): PresentationState {
  const seed = buildSyntheticScenarioSeed();
  const previous = seed.releases.find((release) => release.version === SCENARIO.previousRelease.version)!;
  const current = seed.releases.find((release) => release.version === SCENARIO.currentRelease.version)!;

  return {
    incident: {
      id: seed.incident.id,
      status: seed.incident.status,
      rootCauseCode: seed.incident.rootCauseCode,
      technicalSummary: seed.incident.technicalSummary,
      closureTechnicalSummary: seed.incident.closureTechnicalSummary,
      closureBusinessSummary: seed.incident.closureBusinessSummary,
      selectedRemediation: seed.incident.selectedRemediation,
      affectedRelease: seed.incident.affectedRelease,
      recoveredRelease: seed.incident.recoveredRelease,
      application: {
        serviceHealth: seed.application.serviceHealth,
        activeReleaseVersion: seed.application.activeReleaseVersion,
        syntheticErrorRate: seed.application.syntheticErrorRate
      }
    },
    validation: seed.validationChecks.map((check) => ({ ...check })),
    releases: {
      previous: {
        id: previous.id,
        version: previous.version,
        status: previous.status,
        downstreamTimeoutMs: previous.downstreamTimeoutMs,
        syntheticErrorRate: previous.syntheticErrorRate,
        deployedAt: previous.deployedAt?.toISOString() ?? null
      },
      current: {
        id: current.id,
        version: current.version,
        status: current.status,
        downstreamTimeoutMs: current.downstreamTimeoutMs,
        syntheticErrorRate: current.syntheticErrorRate,
        deployedAt: current.deployedAt?.toISOString() ?? null
      },
      activeReleaseVersion: seed.application.activeReleaseVersion,
      diff: {
        downstreamTimeoutMs: {
          previous: previous.downstreamTimeoutMs,
          current: current.downstreamTimeoutMs
        },
        syntheticErrorRate: {
          previous: previous.syntheticErrorRate,
          current: current.syntheticErrorRate
        }
      }
    },
    audit: seed.auditEvents.map((event) => ({
      id: event.id,
      type: event.type,
      actor: event.actor,
      timestamp: event.timestamp.toISOString()
    })),
    logs: seed.logs.map((log) => ({ ...log, timestamp: log.timestamp.toISOString() })),
    requests: seed.requests.map((request) => ({ ...request, createdAt: request.createdAt.toISOString() })),
    transactions: seed.transactions.map((transaction) => ({ ...transaction, createdAt: transaction.createdAt.toISOString() }))
  };
}

function requireStatus(state: PresentationState, expected: IncidentStatus, action: string) {
  if (state.incident.status !== expected) {
    throw new Error(`${action} requires ${expected}; current presentation state is ${state.incident.status}.`);
  }
}

export function presentationStartInvestigation(state: PresentationState): PresentationState {
  requireStatus(state, "OPEN", "Start investigation");
  const next = cloneState(state);
  next.incident.status = "INVESTIGATING";
  next.audit.push(audit("presentation-investigation-started", "INVESTIGATION_STARTED", "Candidate reviewer", T.investigation));
  return next;
}

export function presentationConfirmRegression(state: PresentationState): PresentationState {
  requireStatus(state, "INVESTIGATING", "Evaluate release evidence");
  const timeoutErrors = state.logs.filter((log) => log.level === "ERROR" && log.message.includes(SCENARIO.failureCode)).length;
  const assessment = assessRootCause({
    currentTimeoutMs: state.releases.current.downstreamTimeoutMs,
    previousTimeoutMs: state.releases.previous.downstreamTimeoutMs,
    observedDownstreamLatencyMs: SCENARIO.observedDownstreamLatencyMs,
    incidentStartedAfterDeployment: true,
    timeoutErrorCount: timeoutErrors
  });
  if (assessment.code !== "RELEASE_TIMEOUT_REGRESSION" || assessment.confidence !== "HIGH") {
    throw new Error("The synthetic presentation evidence did not confirm the expected release regression.");
  }

  const next = cloneState(state);
  next.incident.status = "REGRESSION_CONFIRMED";
  next.incident.rootCauseCode = assessment.code;
  next.incident.technicalSummary = assessment.explanation;
  next.audit.push(
    audit("presentation-release-comparison-reviewed", "RELEASE_COMPARISON_REVIEWED", "Candidate reviewer", T.comparison),
    audit("presentation-regression-confirmed", "RELEASE_REGRESSION_CONFIRMED", "ApplicationOps presentation engine", T.regression)
  );
  return next;
}

export function presentationRecordRemediation(state: PresentationState, action: RemediationAction): PresentationState {
  requireStatus(state, "REGRESSION_CONFIRMED", "Record remediation");
  if (state.incident.rootCauseCode !== "RELEASE_TIMEOUT_REGRESSION") {
    throw new Error("Remediation cannot be recorded before the release regression is confirmed.");
  }
  if (action !== "ROLLBACK_RELEASE") {
    throw new Error("This synthetic evidence set supports ROLLBACK_RELEASE as the successful remediation path.");
  }

  const next = cloneState(state);
  next.incident.status = "REMEDIATION_SELECTED";
  next.incident.selectedRemediation = action;
  next.audit.push(audit("presentation-remediation-selected", "REMEDIATION_SELECTED", "Candidate reviewer", T.remediation));
  return next;
}

export function presentationBeginRollback(state: PresentationState): PresentationState {
  requireStatus(state, "REMEDIATION_SELECTED", "Execute rollback");
  if (state.incident.selectedRemediation !== "ROLLBACK_RELEASE") {
    throw new Error("Controlled rollback requires the recorded rollback remediation decision.");
  }

  const next = cloneState(state);
  next.incident.status = "ROLLING_BACK";
  next.releases.current.status = "ROLLING_BACK";
  next.audit.push(audit("presentation-rollback-started", "ROLLBACK_STARTED", "ApplicationOps presentation engine", T.rollbackStarted));
  return next;
}

export function presentationCompleteRollback(state: PresentationState): PresentationState {
  requireStatus(state, "ROLLING_BACK", "Complete rollback");
  const next = cloneState(state);
  next.incident.status = "READY_FOR_VALIDATION";
  next.incident.recoveredRelease = SCENARIO.previousRelease.version;
  next.incident.application = {
    serviceHealth: "HEALTHY",
    activeReleaseVersion: SCENARIO.previousRelease.version,
    syntheticErrorRate: SCENARIO.recoveredErrorRatePct
  };
  next.releases.current.status = "ROLLED_BACK";
  next.releases.previous.status = "STABLE";
  next.releases.activeReleaseVersion = SCENARIO.previousRelease.version;

  if (!next.requests.some((request) => request.requestId === SCENARIO.recoveryRequestId)) {
    next.requests.push({
      id: "presentation-recovery-request",
      incidentId: SCENARIO.incidentId,
      requestId: SCENARIO.recoveryRequestId,
      method: "POST",
      path: "/transactions/process",
      responseStatus: 200,
      durationMs: 1210,
      releaseVersion: SCENARIO.previousRelease.version,
      failureCode: null,
      createdAt: T.recovery
    });
  }
  if (!next.transactions.some((transaction) => transaction.id === SCENARIO.recoveryTransactionId)) {
    next.transactions.push({
      id: SCENARIO.recoveryTransactionId,
      incidentId: SCENARIO.incidentId,
      requestId: SCENARIO.recoveryRequestId,
      status: "SUCCEEDED",
      applicationVersion: SCENARIO.previousRelease.version,
      failureCode: null,
      createdAt: T.recovery
    });
  }
  if (!next.logs.some((log) => log.id === "presentation-recovery-log")) {
    next.logs.push({
      id: "presentation-recovery-log",
      incidentId: SCENARIO.incidentId,
      timestamp: T.recovery,
      level: "INFO",
      requestId: SCENARIO.recoveryRequestId,
      service: SCENARIO.serviceName,
      message: `Synthetic recovery transaction ${SCENARIO.recoveryTransactionId} succeeded on release ${SCENARIO.previousRelease.version}.`
    });
  }
  next.audit.push(audit("presentation-rollback-completed", "ROLLBACK_COMPLETED", "ApplicationOps presentation engine", T.rollbackCompleted));
  return next;
}

export function presentationRunValidation(state: PresentationState): PresentationState {
  requireStatus(state, "READY_FOR_VALIDATION", "Run validation");
  const evidence = deriveRecoveryValidationEvidence(state);
  if (recoveryEvidencePassCount(evidence) !== 4) {
    throw new Error("Recovery validation requires all four synthetic evidence checks to pass.");
  }

  const next = cloneState(state);
  next.validation = next.validation.map((check) => ({ ...check, status: "PASS" }));
  next.incident.status = "VALIDATED";
  next.audit.push(
    audit("presentation-validation-started", "VALIDATION_STARTED", "ApplicationOps presentation engine", T.validationStarted),
    audit("presentation-validation-passed", "VALIDATION_PASSED", "ApplicationOps presentation engine", T.validationPassed)
  );
  return next;
}

export function presentationResolve(state: PresentationState): PresentationState {
  requireStatus(state, "VALIDATED", "Resolve incident");
  const handoff = deriveResolutionHandoff({
    incident: state.incident,
    releases: state.releases,
    requests: state.requests,
    transactions: state.transactions,
    logs: state.logs,
    audit: state.audit,
    validation: state.validation.map((check) => ({
      id: check.key as "stable-release" | "error-rate" | "synthetic-transaction" | "timeout-errors",
      label: check.label,
      required: check.required,
      status: check.status
    }))
  });
  if (!handoff.ready || !handoff.technicalSummary || !handoff.businessSummary) {
    throw new Error(`Resolution handoff is not ready: ${handoff.reasons.join(", ") || "unknown reason"}.`);
  }

  const next = cloneState(state);
  next.incident.status = "RESOLVED";
  next.incident.closureTechnicalSummary = handoff.technicalSummary;
  next.incident.closureBusinessSummary = handoff.businessSummary;
  next.audit.push(
    audit("presentation-resolution-handoff", "RESOLUTION_HANDOFF_CREATED", "ApplicationOps presentation engine", T.handoff),
    audit("presentation-incident-resolved", "INCIDENT_RESOLVED", "Candidate reviewer", T.resolved)
  );
  return next;
}
