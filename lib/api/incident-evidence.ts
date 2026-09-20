import type {
  IncidentStatus,
  ReleaseStatus,
  RootCauseEvidence,
  ValidationCheck,
  ValidationCheckId,
  ValidationStatus
} from "@/lib/domain/types";
import type { ReleasePairState } from "@/lib/domain/release-state";

export interface ReleaseEvidenceRecord {
  version: string;
  status: ReleaseStatus;
  downstreamTimeoutMs: number;
  deployedAt: Date | null;
}

export interface IncidentEvidenceRecord {
  status: IncidentStatus;
  affectedRelease: string;
  createdAt: Date;
}

export interface TimeoutLogRecord {
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  timestamp: Date;
}

export function buildRootCauseEvidence(input: {
  incident: IncidentEvidenceRecord;
  currentRelease: ReleaseEvidenceRecord;
  previousRelease: ReleaseEvidenceRecord;
  observedDownstreamLatencyMs: number;
  logs: TimeoutLogRecord[];
}): RootCauseEvidence {
  const timeoutErrorCount = input.logs.filter(
    (log) => log.level === "ERROR" && log.message.includes("UPSTREAM_TIMEOUT")
  ).length;

  return {
    currentTimeoutMs: input.currentRelease.downstreamTimeoutMs,
    previousTimeoutMs: input.previousRelease.downstreamTimeoutMs,
    observedDownstreamLatencyMs: input.observedDownstreamLatencyMs,
    incidentStartedAfterDeployment:
      input.currentRelease.deployedAt !== null &&
      input.incident.createdAt.getTime() > input.currentRelease.deployedAt.getTime(),
    timeoutErrorCount
  };
}

export function buildReleasePairState(input: {
  applicationActiveReleaseVersion: string;
  currentRelease: ReleaseEvidenceRecord;
  previousRelease: ReleaseEvidenceRecord;
}): ReleasePairState {
  return {
    currentReleaseStatus: input.currentRelease.status,
    previousReleaseStatus: input.previousRelease.status,
    activeRelease:
      input.applicationActiveReleaseVersion === input.currentRelease.version
        ? "CURRENT"
        : "PREVIOUS"
  };
}

export interface ValidationEvidence {
  stableReleaseRestored: boolean;
  errorRateBelowThreshold: boolean;
  syntheticTransactionSucceeded: boolean;
  noNewTimeoutErrors: boolean;
}

const VALIDATION_LABELS: Record<ValidationCheckId, string> = {
  "stable-release": "Previous stable release restored",
  "error-rate": "Error rate returned below threshold",
  "synthetic-transaction": "New synthetic transaction completed successfully",
  "timeout-errors": "No new timeout errors detected"
};

export function validationChecksFromEvidence(evidence: ValidationEvidence): ValidationCheck[] {
  const statuses: Record<ValidationCheckId, ValidationStatus> = {
    "stable-release": evidence.stableReleaseRestored ? "PASS" : "FAIL",
    "error-rate": evidence.errorRateBelowThreshold ? "PASS" : "FAIL",
    "synthetic-transaction": evidence.syntheticTransactionSucceeded ? "PASS" : "FAIL",
    "timeout-errors": evidence.noNewTimeoutErrors ? "PASS" : "FAIL"
  };

  return (Object.keys(statuses) as ValidationCheckId[]).map((id) => ({
    id,
    label: VALIDATION_LABELS[id],
    required: true,
    status: statuses[id]
  }));
}
