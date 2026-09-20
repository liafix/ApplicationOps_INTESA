import { SCENARIO } from "@/lib/data/synthetic-scenario";
import type { IncidentStatus, ReleaseStatus } from "@/lib/domain/types";

export type TimeValue = Date | string | number;

export interface RecoveryValidationInput {
  incident: {
    status: IncidentStatus;
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
    };
    current: {
      version: string;
      status: ReleaseStatus;
    };
    activeReleaseVersion: string;
  } | null;
  requests: Array<{
    requestId: string;
    responseStatus: number;
    releaseVersion: string;
    failureCode: string | null;
    createdAt: TimeValue;
  }>;
  transactions: Array<{
    id: string;
    requestId: string;
    status: "FAILED" | "SUCCEEDED";
    applicationVersion: string;
    failureCode: string | null;
    createdAt: TimeValue;
  }>;
  logs: Array<{
    timestamp: TimeValue;
    level: "INFO" | "WARN" | "ERROR";
    requestId: string | null;
    message: string;
  }>;
  audit: Array<{
    type: string;
    timestamp: TimeValue;
  }>;
}

export interface RecoveryValidationEvidence {
  rollbackCompletedAt: number | null;
  stableReleaseRestored: boolean;
  errorRateBelowThreshold: boolean;
  syntheticTransactionSucceeded: boolean;
  noNewTimeoutErrors: boolean;
  recoveryRequestSucceeded: boolean;
  recoveryTransactionSucceeded: boolean;
  timeoutErrorsAfterRollback: number;
}

function timeMs(value: TimeValue): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function deriveRecoveryValidationEvidence(
  input: RecoveryValidationInput
): RecoveryValidationEvidence {
  const incident = input.incident;
  const releases = input.releases;
  const rollbackCompleted = input.audit
    .filter((event) => event.type === "ROLLBACK_COMPLETED")
    .map((event) => timeMs(event.timestamp))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const rollbackCompletedAt = rollbackCompleted ?? null;

  const recoveryRequest = input.requests.find(
    (request) =>
      request.requestId === SCENARIO.recoveryRequestId &&
      (rollbackCompletedAt === null || timeMs(request.createdAt) >= rollbackCompletedAt)
  );
  const recoveryTransaction = input.transactions.find(
    (transaction) =>
      transaction.id === SCENARIO.recoveryTransactionId &&
      transaction.requestId === SCENARIO.recoveryRequestId &&
      (rollbackCompletedAt === null || timeMs(transaction.createdAt) >= rollbackCompletedAt)
  );

  const recoveryRequestSucceeded =
    rollbackCompletedAt !== null &&
    recoveryRequest?.responseStatus === 200 &&
    recoveryRequest.releaseVersion === SCENARIO.previousRelease.version &&
    recoveryRequest.failureCode === null;

  const recoveryTransactionSucceeded =
    rollbackCompletedAt !== null &&
    recoveryTransaction?.status === "SUCCEEDED" &&
    recoveryTransaction.applicationVersion === SCENARIO.previousRelease.version &&
    recoveryTransaction.failureCode === null;

  const timeoutErrorsAfterRollback =
    rollbackCompletedAt === null
      ? 0
      : input.logs.filter(
          (log) =>
            timeMs(log.timestamp) > rollbackCompletedAt &&
            log.level === "ERROR" &&
            log.message.includes(SCENARIO.failureCode)
        ).length;

  const stableReleaseRestored =
    rollbackCompletedAt !== null &&
    incident?.recoveredRelease === SCENARIO.previousRelease.version &&
    incident.application.activeReleaseVersion === SCENARIO.previousRelease.version &&
    incident.application.serviceHealth === "HEALTHY" &&
    releases?.activeReleaseVersion === SCENARIO.previousRelease.version &&
    releases.previous.version === SCENARIO.previousRelease.version &&
    releases.previous.status === "STABLE" &&
    releases.current.version === SCENARIO.currentRelease.version &&
    releases.current.status === "ROLLED_BACK";

  const errorRateBelowThreshold =
    rollbackCompletedAt !== null &&
    Number.isFinite(incident?.application.syntheticErrorRate) &&
    (incident?.application.syntheticErrorRate ?? Number.POSITIVE_INFINITY) <
      SCENARIO.validationErrorRateThresholdPct;

  return {
    rollbackCompletedAt,
    stableReleaseRestored,
    errorRateBelowThreshold,
    syntheticTransactionSucceeded: recoveryRequestSucceeded && recoveryTransactionSucceeded,
    noNewTimeoutErrors: rollbackCompletedAt !== null && timeoutErrorsAfterRollback === 0,
    recoveryRequestSucceeded,
    recoveryTransactionSucceeded,
    timeoutErrorsAfterRollback
  };
}

export function recoveryEvidencePassCount(evidence: RecoveryValidationEvidence): number {
  return [
    evidence.stableReleaseRestored,
    evidence.errorRateBelowThreshold,
    evidence.syntheticTransactionSucceeded,
    evidence.noNewTimeoutErrors
  ].filter(Boolean).length;
}
