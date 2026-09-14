import { createPendingValidationChecks } from "../domain/validation";

export const CANDIDATE_DISCLAIMER =
  "Independent candidate demonstrator created specifically for an application to the Application Support Associate role at Intesa Sanpaolo International Value Services. Built only from publicly available role/company context and synthetic data. It is not an Intesa Sanpaolo product, internal system or representation of its architecture.";

export const SCENARIO = {
  applicationId: "transaction-processing-service",
  incidentId: "APP-2047",
  transactionId: "TX-90842",
  requestId: "req_tx_8f31",
  recoveryRequestId: "req_tx_recovery",
  recoveryTransactionId: "TX-90843",
  serviceName: "Transaction Processing Service",
  environment: "synthetic-production",
  severity: "HIGH",
  previousRelease: {
    id: "release-2-7-4",
    version: "2.7.4",
    downstreamTimeoutMs: 5000,
    errorRatePct: 1.2,
    status: "STABLE" as const
  },
  currentRelease: {
    id: "release-2-8-0",
    version: "2.8.0",
    downstreamTimeoutMs: 800,
    errorRatePct: 14.8,
    status: "DEGRADED" as const
  },
  recoveredErrorRatePct: 1.1,
  validationErrorRateThresholdPct: 5,
  observedDownstreamLatencyMs: 1437,
  failureCode: "UPSTREAM_TIMEOUT",
  httpStatus: 504,
  requestSummary:
    "Synthetic transaction requests started failing shortly after the latest application release.",
  timeline: {
    previousReleaseCreatedAt: "2026-09-01T06:45:00.000Z",
    currentReleaseDeployedAt: "2026-09-02T07:30:00.000Z",
    requestStartedAt: "2026-09-02T07:32:10.000Z",
    requestFailedAt: "2026-09-02T07:32:11.437Z",
    incidentCreatedAt: "2026-09-02T07:32:20.000Z"
  }
} as const;

export interface SyntheticScenarioSeed {
  application: {
    id: string;
    name: string;
    environment: string;
    serviceHealth: "DEGRADED";
    activeReleaseVersion: string;
    syntheticErrorRate: number;
    createdAt: Date;
    updatedAt: Date;
  };
  releases: Array<{
    id: string;
    applicationId: string;
    version: string;
    status: "STABLE" | "DEGRADED";
    downstreamTimeoutMs: number;
    syntheticErrorRate: number;
    deployedAt: Date | null;
    createdAt: Date;
  }>;
  incident: {
    id: string;
    applicationId: string;
    title: string;
    severity: string;
    status: "OPEN";
    requestSummary: string;
    technicalSummary: null;
    closureTechnicalSummary: null;
    closureBusinessSummary: null;
    rootCauseCode: null;
    selectedRemediation: null;
    affectedRelease: string;
    recoveredRelease: null;
    createdAt: Date;
    updatedAt: Date;
  };
  logs: Array<{
    id: string;
    incidentId: string;
    timestamp: Date;
    level: "INFO" | "WARN" | "ERROR";
    requestId: string | null;
    service: string;
    message: string;
  }>;
  requests: Array<{
    id: string;
    incidentId: string;
    requestId: string;
    method: string;
    path: string;
    responseStatus: number;
    durationMs: number;
    releaseVersion: string;
    failureCode: string;
    createdAt: Date;
  }>;
  transactions: Array<{
    id: string;
    incidentId: string;
    requestId: string;
    status: "FAILED";
    applicationVersion: string;
    failureCode: string;
    createdAt: Date;
  }>;
  validationChecks: Array<{
    id: string;
    incidentId: string;
    key: string;
    label: string;
    required: true;
    status: "PENDING";
  }>;
  auditEvents: Array<{
    id: string;
    incidentId: string;
    type: string;
    actor: string;
    metadata: Record<string, string | number>;
    timestamp: Date;
  }>;
}

export function buildSyntheticScenarioSeed(): SyntheticScenarioSeed {
  const deployedAt = new Date(SCENARIO.timeline.currentReleaseDeployedAt);
  const failedAt = new Date(SCENARIO.timeline.requestFailedAt);
  const incidentCreatedAt = new Date(SCENARIO.timeline.incidentCreatedAt);

  return {
    application: {
      id: SCENARIO.applicationId,
      name: SCENARIO.serviceName,
      environment: SCENARIO.environment,
      serviceHealth: "DEGRADED",
      activeReleaseVersion: SCENARIO.currentRelease.version,
      syntheticErrorRate: SCENARIO.currentRelease.errorRatePct,
      createdAt: new Date(SCENARIO.timeline.previousReleaseCreatedAt),
      updatedAt: incidentCreatedAt
    },
    releases: [
      {
        id: SCENARIO.previousRelease.id,
        applicationId: SCENARIO.applicationId,
        version: SCENARIO.previousRelease.version,
        status: "STABLE",
        downstreamTimeoutMs: SCENARIO.previousRelease.downstreamTimeoutMs,
        syntheticErrorRate: SCENARIO.previousRelease.errorRatePct,
        deployedAt: new Date(SCENARIO.timeline.previousReleaseCreatedAt),
        createdAt: new Date(SCENARIO.timeline.previousReleaseCreatedAt)
      },
      {
        id: SCENARIO.currentRelease.id,
        applicationId: SCENARIO.applicationId,
        version: SCENARIO.currentRelease.version,
        status: "DEGRADED",
        downstreamTimeoutMs: SCENARIO.currentRelease.downstreamTimeoutMs,
        syntheticErrorRate: SCENARIO.currentRelease.errorRatePct,
        deployedAt,
        createdAt: deployedAt
      }
    ],
    incident: {
      id: SCENARIO.incidentId,
      applicationId: SCENARIO.applicationId,
      title: "Transaction processing degraded after release",
      severity: SCENARIO.severity,
      status: "OPEN",
      requestSummary: SCENARIO.requestSummary,
      technicalSummary: null,
      closureTechnicalSummary: null,
      closureBusinessSummary: null,
      rootCauseCode: null,
      selectedRemediation: null,
      affectedRelease: SCENARIO.currentRelease.version,
      recoveredRelease: null,
      createdAt: incidentCreatedAt,
      updatedAt: incidentCreatedAt
    },
    logs: [
      {
        id: "log-release-deployed",
        incidentId: SCENARIO.incidentId,
        timestamp: deployedAt,
        level: "INFO",
        requestId: null,
        service: SCENARIO.serviceName,
        message: `Release ${SCENARIO.currentRelease.version} deployment completed.`
      },
      {
        id: "log-request-started",
        incidentId: SCENARIO.incidentId,
        timestamp: new Date(SCENARIO.timeline.requestStartedAt),
        level: "INFO",
        requestId: SCENARIO.requestId,
        service: SCENARIO.serviceName,
        message: `POST /transactions/process started on release ${SCENARIO.currentRelease.version}.`
      },
      {
        id: "log-downstream-latency",
        incidentId: SCENARIO.incidentId,
        timestamp: failedAt,
        level: "WARN",
        requestId: SCENARIO.requestId,
        service: SCENARIO.serviceName,
        message: `Observed downstream latency ${SCENARIO.observedDownstreamLatencyMs}ms exceeds configured timeout ${SCENARIO.currentRelease.downstreamTimeoutMs}ms.`
      },
      {
        id: "log-upstream-timeout",
        incidentId: SCENARIO.incidentId,
        timestamp: failedAt,
        level: "ERROR",
        requestId: SCENARIO.requestId,
        service: SCENARIO.serviceName,
        message: `${SCENARIO.failureCode} · HTTP ${SCENARIO.httpStatus}.`
      },
      {
        id: "log-transaction-failed",
        incidentId: SCENARIO.incidentId,
        timestamp: failedAt,
        level: "ERROR",
        requestId: SCENARIO.requestId,
        service: SCENARIO.serviceName,
        message: `Synthetic transaction ${SCENARIO.transactionId} processing failed.`
      }
    ],
    requests: [
      {
        id: "api-request-failed-1",
        incidentId: SCENARIO.incidentId,
        requestId: SCENARIO.requestId,
        method: "POST",
        path: "/transactions/process",
        responseStatus: SCENARIO.httpStatus,
        durationMs: SCENARIO.observedDownstreamLatencyMs,
        releaseVersion: SCENARIO.currentRelease.version,
        failureCode: SCENARIO.failureCode,
        createdAt: failedAt
      }
    ],
    transactions: [
      {
        id: SCENARIO.transactionId,
        incidentId: SCENARIO.incidentId,
        requestId: SCENARIO.requestId,
        status: "FAILED",
        applicationVersion: SCENARIO.currentRelease.version,
        failureCode: SCENARIO.failureCode,
        createdAt: failedAt
      }
    ],
    validationChecks: createPendingValidationChecks().map((check) => ({
      id: `validation-${check.id}`,
      incidentId: SCENARIO.incidentId,
      key: check.id,
      label: check.label,
      required: true,
      status: "PENDING"
    })),
    auditEvents: [
      {
        id: "audit-release-deployed",
        incidentId: SCENARIO.incidentId,
        type: "RELEASE_DEPLOYED",
        actor: "Synthetic deployment pipeline",
        metadata: { releaseVersion: SCENARIO.currentRelease.version },
        timestamp: deployedAt
      },
      {
        id: "audit-incident-created",
        incidentId: SCENARIO.incidentId,
        type: "INCIDENT_CREATED",
        actor: "Synthetic monitoring",
        metadata: { severity: SCENARIO.severity },
        timestamp: incidentCreatedAt
      },
      {
        id: "audit-application-degraded",
        incidentId: SCENARIO.incidentId,
        type: "APPLICATION_DEGRADED",
        actor: "Synthetic monitoring",
        metadata: { errorRatePct: SCENARIO.currentRelease.errorRatePct },
        timestamp: new Date(incidentCreatedAt.getTime() + 1000)
      }
    ]
  };
}
