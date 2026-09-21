import { SCENARIO } from "@/lib/data/synthetic-scenario";
import type { IncidentStatus, ReleaseStatus } from "@/lib/domain/types";

export type RollbackRecoveryMode = "LOCKED" | "READY" | "EXECUTING" | "RECOVERED" | "INCONSISTENT";

export interface RollbackRecoveryInput {
  incident: {
    status: IncidentStatus;
    selectedRemediation: string | null;
    recoveredRelease: string | null;
    application: {
      serviceHealth: string;
      activeReleaseVersion: string;
      syntheticErrorRate: number;
    };
  } | null;
  releases: {
    previous: {
      version: string;
      status: ReleaseStatus;
      downstreamTimeoutMs: number;
      syntheticErrorRate: number;
    };
    current: {
      version: string;
      status: ReleaseStatus;
      downstreamTimeoutMs: number;
      syntheticErrorRate: number;
    };
    activeReleaseVersion: string;
  } | null;
  requests: Array<{
    requestId: string;
    responseStatus: number;
    releaseVersion: string;
    failureCode: string | null;
  }>;
  transactions: Array<{
    id: string;
    requestId: string;
    status: "FAILED" | "SUCCEEDED";
    applicationVersion: string;
    failureCode: string | null;
  }>;
  logs: Array<{
    level: "INFO" | "WARN" | "ERROR";
    requestId: string | null;
    message: string;
  }>;
  audit: Array<{ type: string }>;
}

export interface RollbackRecoveryEvidence {
  decisionPersisted: boolean;
  rollbackStarted: boolean;
  rollbackCompleted: boolean;
  affectedReleaseRolledBack: boolean;
  previousReleaseStable: boolean;
  previousReleaseActive: boolean;
  serviceHealthy: boolean;
  errorRateRecovered: boolean;
  incidentRecoveryPersisted: boolean;
  recoveryRequestSucceeded: boolean;
  recoveryTransactionSucceeded: boolean;
  recoveryLogPresent: boolean;
}

const POST_ROLLBACK_STATES: readonly IncidentStatus[] = ["READY_FOR_VALIDATION", "VALIDATED", "RESOLVED"];

export function rollbackRecoveryEvidence(input: RollbackRecoveryInput): RollbackRecoveryEvidence {
  const incident = input.incident;
  const releases = input.releases;
  const recoveryRequest = input.requests.find((request) => request.requestId === SCENARIO.recoveryRequestId);
  const recoveryTransaction = input.transactions.find(
    (transaction) => transaction.id === SCENARIO.recoveryTransactionId && transaction.requestId === SCENARIO.recoveryRequestId
  );
  const recoveryLog = input.logs.find(
    (log) =>
      log.requestId === SCENARIO.recoveryRequestId &&
      log.level === "INFO" &&
      log.message.includes(SCENARIO.recoveryTransactionId) &&
      log.message.includes(SCENARIO.previousRelease.version)
  );

  return {
    decisionPersisted: incident?.selectedRemediation === "ROLLBACK_RELEASE",
    rollbackStarted: input.audit.some((event) => event.type === "ROLLBACK_STARTED"),
    rollbackCompleted: input.audit.some((event) => event.type === "ROLLBACK_COMPLETED"),
    affectedReleaseRolledBack:
      releases?.current.version === SCENARIO.currentRelease.version && releases.current.status === "ROLLED_BACK",
    previousReleaseStable:
      releases?.previous.version === SCENARIO.previousRelease.version && releases.previous.status === "STABLE",
    previousReleaseActive:
      releases?.activeReleaseVersion === SCENARIO.previousRelease.version &&
      incident?.application.activeReleaseVersion === SCENARIO.previousRelease.version,
    serviceHealthy: incident?.application.serviceHealth === "HEALTHY",
    errorRateRecovered: incident?.application.syntheticErrorRate === SCENARIO.recoveredErrorRatePct,
    incidentRecoveryPersisted: incident?.recoveredRelease === SCENARIO.previousRelease.version,
    recoveryRequestSucceeded:
      recoveryRequest?.responseStatus === 200 &&
      recoveryRequest.releaseVersion === SCENARIO.previousRelease.version &&
      recoveryRequest.failureCode === null,
    recoveryTransactionSucceeded:
      recoveryTransaction?.status === "SUCCEEDED" &&
      recoveryTransaction.applicationVersion === SCENARIO.previousRelease.version &&
      recoveryTransaction.failureCode === null,
    recoveryLogPresent: Boolean(recoveryLog)
  };
}

export function rollbackRecoveryMode(input: RollbackRecoveryInput): RollbackRecoveryMode {
  const incident = input.incident;
  if (!incident) return "LOCKED";

  const evidence = rollbackRecoveryEvidence(input);

  if (incident.status === "REMEDIATION_SELECTED" && evidence.decisionPersisted) {
    return "READY";
  }

  if (incident.status === "ROLLING_BACK" && evidence.decisionPersisted) {
    return "EXECUTING";
  }

  if (POST_ROLLBACK_STATES.includes(incident.status)) {
    const complete = Object.values(evidence).every(Boolean);
    return complete ? "RECOVERED" : "INCONSISTENT";
  }

  return "LOCKED";
}

export function rollbackBeforeState() {
  return {
    release: SCENARIO.currentRelease.version,
    releaseStatus: SCENARIO.currentRelease.status,
    serviceHealth: "DEGRADED" as const,
    errorRatePct: SCENARIO.currentRelease.errorRatePct,
    timeoutMs: SCENARIO.currentRelease.downstreamTimeoutMs
  };
}

export function rollbackAfterState(input: RollbackRecoveryInput) {
  const incident = input.incident;
  const releases = input.releases;
  return {
    release: incident?.application.activeReleaseVersion ?? "PENDING",
    releaseStatus: releases?.previous.status ?? null,
    affectedReleaseStatus: releases?.current.status ?? null,
    serviceHealth: incident?.application.serviceHealth ?? "PENDING",
    errorRatePct: incident?.application.syntheticErrorRate ?? null,
    timeoutMs:
      releases?.activeReleaseVersion === releases?.previous.version
        ? releases?.previous.downstreamTimeoutMs ?? null
        : null
  };
}
