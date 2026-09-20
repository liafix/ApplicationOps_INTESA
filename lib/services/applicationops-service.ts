import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resetSyntheticScenario } from "@/lib/db/synthetic-scenario-store";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import {
  assessRootCause,
  beginRollback,
  chooseRemediation,
  confirmReleaseRegression,
  finishRollback,
  resolveValidatedIncident,
  startInvestigation,
  validateRecovery,
  type IncidentStatus,
  type ReleaseStatus,
  type RemediationAction,
  type ValidationCheck,
  type ValidationCheckId
} from "@/lib/domain";
import {
  buildReleasePairState,
  buildRootCauseEvidence,
  validationChecksFromEvidence
} from "@/lib/api/incident-evidence";
import { ApiError, PersistenceConflictError } from "@/lib/api/errors";
import { deriveRecoveryValidationEvidence } from "@/lib/evidence/recovery-validation";
import { deriveResolutionHandoff } from "@/lib/evidence/resolution-handoff";

const ACTOR = "Candidate walkthrough";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

function assertCanonicalIncidentId(id: string): void {
  if (id !== SCENARIO.incidentId) {
    throw new ApiError(
      404,
      "INCIDENT_NOT_FOUND",
      "The requested synthetic incident does not exist."
    );
  }
}

function auditId(type: string): string {
  return `audit-${type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}`;
}

async function appendAudit(
  tx: Tx,
  incidentId: string,
  type: string,
  metadata: Prisma.InputJsonValue | undefined,
  timestamp = new Date()
): Promise<void> {
  const latest = await tx.auditEvent.findFirst({
    where: { incidentId },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true }
  });
  const effectiveTimestamp =
    latest && timestamp.getTime() <= latest.timestamp.getTime()
      ? new Date(latest.timestamp.getTime() + 1)
      : timestamp;

  await tx.auditEvent.create({
    data: {
      id: auditId(type),
      incidentId,
      type,
      actor: ACTOR,
      metadata,
      timestamp: effectiveTimestamp
    }
  });
}

async function requireIncident(db: Db, id: string) {
  assertCanonicalIncidentId(id);
  const incident = await db.incident.findUnique({ where: { id } });
  if (!incident) {
    throw new ApiError(
      404,
      "INCIDENT_NOT_FOUND",
      "The requested synthetic incident does not exist."
    );
  }
  return incident;
}

async function requireEvidenceContext(db: Db, id: string) {
  assertCanonicalIncidentId(id);
  const incident = await db.incident.findUnique({
    where: { id },
    include: {
      application: { include: { releases: true } },
      logs: { orderBy: { timestamp: "asc" } },
      requests: { orderBy: { createdAt: "asc" } },
      transactions: { orderBy: { createdAt: "asc" } },
      validationChecks: { orderBy: { key: "asc" } },
      auditEvents: { orderBy: { timestamp: "asc" } }
    }
  });

  if (!incident) {
    throw new ApiError(
      404,
      "INCIDENT_NOT_FOUND",
      "The requested synthetic incident does not exist."
    );
  }

  const currentRelease = incident.application.releases.find(
    (release) => release.version === incident.affectedRelease
  );
  const previousRelease = incident.application.releases.find(
    (release) => release.version !== incident.affectedRelease
  );
  const failedRequest = incident.requests.find(
    (request) => request.failureCode === SCENARIO.failureCode
  );

  if (!currentRelease || !previousRelease || !failedRequest) {
    throw new ApiError(
      409,
      "EVIDENCE_INCOMPLETE",
      "The persisted synthetic evidence is incomplete and the workflow cannot progress safely."
    );
  }

  return { incident, currentRelease, previousRelease, failedRequest };
}

function rootCauseFromContext(context: Awaited<ReturnType<typeof requireEvidenceContext>>) {
  const evidence = buildRootCauseEvidence({
    incident: {
      status: context.incident.status as IncidentStatus,
      affectedRelease: context.incident.affectedRelease,
      createdAt: context.incident.createdAt
    },
    currentRelease: {
      version: context.currentRelease.version,
      status: context.currentRelease.status,
      downstreamTimeoutMs: context.currentRelease.downstreamTimeoutMs,
      deployedAt: context.currentRelease.deployedAt
    },
    previousRelease: {
      version: context.previousRelease.version,
      status: context.previousRelease.status,
      downstreamTimeoutMs: context.previousRelease.downstreamTimeoutMs,
      deployedAt: context.previousRelease.deployedAt
    },
    observedDownstreamLatencyMs: context.failedRequest.durationMs,
    logs: context.incident.logs.map((log) => ({
      level: log.level,
      message: log.message,
      timestamp: log.timestamp
    }))
  });

  return { evidence, assessment: assessRootCause(evidence) };
}

async function compareAndSetIncidentStatus(
  tx: Tx,
  id: string,
  expected: IncidentStatus,
  next: IncidentStatus,
  data: Prisma.IncidentUpdateManyMutationInput = {}
): Promise<void> {
  const result = await tx.incident.updateMany({
    where: { id, status: expected },
    data: { ...data, status: next, updatedAt: new Date() }
  });
  if (result.count !== 1) throw new PersistenceConflictError();
}

async function requireSingleUpdate(result: { count: number }, message: string): Promise<void> {
  if (result.count !== 1) throw new PersistenceConflictError(message);
}

export async function getDashboard() {
  const application = await prisma.application.findUnique({
    where: { id: SCENARIO.applicationId }
  });
  if (!application) {
    throw new ApiError(404, "SCENARIO_NOT_FOUND", "The synthetic scenario has not been seeded.");
  }

  const activeIncidents = await prisma.incident.count({
    where: { applicationId: application.id, status: { not: "RESOLVED" } }
  });

  return {
    activeIncidents,
    serviceHealth: application.serviceHealth,
    currentRelease: application.activeReleaseVersion,
    errorRatePct: application.syntheticErrorRate,
    environment: application.environment
  };
}

export async function getIncident(id: string) {
  assertCanonicalIncidentId(id);
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: { application: true }
  });
  if (!incident) throw new ApiError(404, "INCIDENT_NOT_FOUND", "Incident not found.");

  return {
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    requestSummary: incident.requestSummary,
    technicalSummary: incident.technicalSummary,
    closureTechnicalSummary: incident.closureTechnicalSummary,
    closureBusinessSummary: incident.closureBusinessSummary,
    rootCauseCode: incident.rootCauseCode,
    selectedRemediation: incident.selectedRemediation,
    affectedRelease: incident.affectedRelease,
    recoveredRelease: incident.recoveredRelease,
    application: {
      id: incident.application.id,
      name: incident.application.name,
      environment: incident.application.environment,
      serviceHealth: incident.application.serviceHealth,
      activeReleaseVersion: incident.application.activeReleaseVersion,
      syntheticErrorRate: incident.application.syntheticErrorRate
    },
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt
  };
}

export async function getLogs(id: string) {
  await requireIncident(prisma, id);
  return prisma.diagnosticLog.findMany({
    where: { incidentId: id },
    orderBy: { timestamp: "asc" }
  });
}

export async function getRequests(id: string) {
  await requireIncident(prisma, id);
  return prisma.apiRequest.findMany({ where: { incidentId: id }, orderBy: { createdAt: "asc" } });
}

export async function getTransactions(id: string) {
  await requireIncident(prisma, id);
  return prisma.syntheticTransaction.findMany({
    where: { incidentId: id },
    orderBy: { createdAt: "asc" }
  });
}

export async function getReleases(id: string) {
  const context = await requireEvidenceContext(prisma, id);
  return {
    previous: context.previousRelease,
    current: context.currentRelease,
    activeReleaseVersion: context.incident.application.activeReleaseVersion,
    diff: {
      downstreamTimeoutMs: {
        previous: context.previousRelease.downstreamTimeoutMs,
        current: context.currentRelease.downstreamTimeoutMs
      },
      syntheticErrorRate: {
        previous: context.previousRelease.syntheticErrorRate,
        current: context.currentRelease.syntheticErrorRate
      }
    }
  };
}

export async function getValidation(id: string) {
  await requireIncident(prisma, id);
  return prisma.validationCheck.findMany({ where: { incidentId: id }, orderBy: { key: "asc" } });
}

export async function getAudit(id: string) {
  await requireIncident(prisma, id);
  return prisma.auditEvent.findMany({
    where: { incidentId: id },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }]
  });
}

export async function investigateIncident(id: string) {
  assertCanonicalIncidentId(id);
  return prisma.$transaction(async (tx) => {
    const incident = await requireIncident(tx, id);
    const next = startInvestigation(incident.status as IncidentStatus);

    await compareAndSetIncidentStatus(tx, id, incident.status as IncidentStatus, next);
    await appendAudit(tx, id, "INVESTIGATION_STARTED", { from: incident.status, to: next });

    return { id, status: next };
  });
}

export async function confirmRegression(id: string) {
  assertCanonicalIncidentId(id);
  return prisma.$transaction(async (tx) => {
    const context = await requireEvidenceContext(tx, id);
    const { evidence, assessment } = rootCauseFromContext(context);
    const next = confirmReleaseRegression(context.incident.status as IncidentStatus, assessment);
    const now = new Date();

    await compareAndSetIncidentStatus(tx, id, context.incident.status as IncidentStatus, next, {
      rootCauseCode: assessment.code,
      technicalSummary: assessment.explanation
    });
    await appendAudit(
      tx,
      id,
      "RELEASE_COMPARISON_REVIEWED",
      {
        affectedRelease: context.currentRelease.version,
        previousRelease: context.previousRelease.version,
        currentTimeoutMs: evidence.currentTimeoutMs,
        previousTimeoutMs: evidence.previousTimeoutMs,
        observedDownstreamLatencyMs: evidence.observedDownstreamLatencyMs
      },
      now
    );
    await appendAudit(
      tx,
      id,
      "RELEASE_REGRESSION_CONFIRMED",
      {
        code: assessment.code,
        confidence: assessment.confidence
      },
      new Date(now.getTime() + 1)
    );

    return { id, status: next, rootCause: assessment, evidence };
  });
}

export async function selectIncidentRemediation(id: string, action: RemediationAction) {
  assertCanonicalIncidentId(id);
  return prisma.$transaction(async (tx) => {
    const context = await requireEvidenceContext(tx, id);
    const { assessment } = rootCauseFromContext(context);
    const selected = chooseRemediation(
      context.incident.status as IncidentStatus,
      assessment,
      action
    );

    await compareAndSetIncidentStatus(
      tx,
      id,
      context.incident.status as IncidentStatus,
      selected.status,
      { selectedRemediation: selected.action }
    );
    await appendAudit(tx, id, "REMEDIATION_SELECTED", { action: selected.action });

    return { id, status: selected.status, selectedRemediation: selected.action };
  });
}

export async function rollbackIncident(id: string) {
  assertCanonicalIncidentId(id);
  return prisma.$transaction(async (tx) => {
    const context = await requireEvidenceContext(tx, id);
    const releasePair = buildReleasePairState({
      applicationActiveReleaseVersion: context.incident.application.activeReleaseVersion,
      currentRelease: {
        version: context.currentRelease.version,
        status: context.currentRelease.status,
        downstreamTimeoutMs: context.currentRelease.downstreamTimeoutMs,
        deployedAt: context.currentRelease.deployedAt
      },
      previousRelease: {
        version: context.previousRelease.version,
        status: context.previousRelease.status,
        downstreamTimeoutMs: context.previousRelease.downstreamTimeoutMs,
        deployedAt: context.previousRelease.deployedAt
      }
    });

    const started = beginRollback(
      context.incident.status as IncidentStatus,
      context.incident.selectedRemediation as RemediationAction | null,
      releasePair
    );
    const baseTime = new Date();

    await compareAndSetIncidentStatus(
      tx,
      id,
      context.incident.status as IncidentStatus,
      started.status
    );
    const stablePreviousCount = await tx.release.count({
      where: { id: context.previousRelease.id, status: "STABLE" }
    });
    if (stablePreviousCount !== 1) {
      throw new PersistenceConflictError(
        "The previous release is no longer in the expected stable state."
      );
    }
    await requireSingleUpdate(
      await tx.release.updateMany({
        where: { id: context.currentRelease.id, status: context.currentRelease.status },
        data: { status: started.releases.currentReleaseStatus }
      }),
      "The affected release no longer matches the expected degraded state."
    );
    await appendAudit(
      tx,
      id,
      "ROLLBACK_STARTED",
      {
        fromRelease: context.currentRelease.version,
        targetRelease: context.previousRelease.version
      },
      baseTime
    );

    const finished = finishRollback(started.status, started.releases);

    await compareAndSetIncidentStatus(tx, id, started.status, finished.status, {
      recoveredRelease: context.previousRelease.version
    });
    await requireSingleUpdate(
      await tx.release.updateMany({
        where: { id: context.currentRelease.id, status: "ROLLING_BACK" },
        data: { status: finished.releases.currentReleaseStatus }
      }),
      "The affected release could not complete rollback from the expected state."
    );
    await requireSingleUpdate(
      await tx.application.updateMany({
        where: {
          id: context.incident.application.id,
          activeReleaseVersion: context.currentRelease.version,
          serviceHealth: "DEGRADED"
        },
        data: {
          activeReleaseVersion: context.previousRelease.version,
          serviceHealth: "HEALTHY",
          syntheticErrorRate: SCENARIO.recoveredErrorRatePct,
          updatedAt: new Date(baseTime.getTime() + 1)
        }
      }),
      "Application state changed before rollback recovery could be persisted."
    );

    const rollbackCompletedAt = new Date(baseTime.getTime() + 2);
    await appendAudit(
      tx,
      id,
      "ROLLBACK_COMPLETED",
      {
        affectedRelease: context.currentRelease.version,
        restoredRelease: context.previousRelease.version,
        recoveredErrorRatePct: SCENARIO.recoveredErrorRatePct
      },
      rollbackCompletedAt
    );

    const validationAt = new Date(baseTime.getTime() + 3);
    await tx.apiRequest.create({
      data: {
        id: "api-request-recovery-1",
        incidentId: id,
        requestId: SCENARIO.recoveryRequestId,
        method: "POST",
        path: "/transactions/process",
        responseStatus: 200,
        durationMs: 1280,
        releaseVersion: context.previousRelease.version,
        failureCode: null,
        createdAt: validationAt
      }
    });
    await tx.syntheticTransaction.create({
      data: {
        id: SCENARIO.recoveryTransactionId,
        incidentId: id,
        requestId: SCENARIO.recoveryRequestId,
        status: "SUCCEEDED",
        applicationVersion: context.previousRelease.version,
        failureCode: null,
        createdAt: validationAt
      }
    });
    await tx.diagnosticLog.create({
      data: {
        id: "log-recovery-transaction-succeeded",
        incidentId: id,
        timestamp: validationAt,
        level: "INFO",
        requestId: SCENARIO.recoveryRequestId,
        service: SCENARIO.serviceName,
        message: `Synthetic recovery transaction ${SCENARIO.recoveryTransactionId} completed successfully on release ${context.previousRelease.version}.`
      }
    });

    return {
      id,
      status: finished.status,
      activeReleaseVersion: context.previousRelease.version,
      serviceHealth: "HEALTHY" as const,
      errorRatePct: SCENARIO.recoveredErrorRatePct
    };
  });
}

function mapPersistedChecks(
  checks: Array<{ key: string; label: string; required: boolean; status: string }>
): ValidationCheck[] {
  return checks.map((check) => ({
    id: check.key as ValidationCheckId,
    label: check.label,
    required: check.required,
    status: check.status as ValidationCheck["status"]
  }));
}

export async function runIncidentValidation(id: string) {
  assertCanonicalIncidentId(id);
  return prisma.$transaction(async (tx) => {
    const context = await requireEvidenceContext(tx, id);
    const rollbackCompleted = context.incident.auditEvents.find(
      (event) => event.type === "ROLLBACK_COMPLETED"
    );
    if (!rollbackCompleted) {
      throw new ApiError(
        409,
        "ROLLBACK_NOT_COMPLETED",
        "Recovery validation requires a completed rollback."
      );
    }

    const recoveryEvidence = deriveRecoveryValidationEvidence({
      incident: {
        status: context.incident.status as IncidentStatus,
        recoveredRelease: context.incident.recoveredRelease,
        application: {
          serviceHealth: context.incident.application.serviceHealth,
          activeReleaseVersion: context.incident.application.activeReleaseVersion,
          syntheticErrorRate: context.incident.application.syntheticErrorRate
        }
      },
      releases: {
        previous: {
          version: context.previousRelease.version,
          status: context.previousRelease.status as ReleaseStatus
        },
        current: {
          version: context.currentRelease.version,
          status: context.currentRelease.status as ReleaseStatus
        },
        activeReleaseVersion: context.incident.application.activeReleaseVersion
      },
      requests: context.incident.requests.map((request) => ({
        requestId: request.requestId,
        responseStatus: request.responseStatus,
        releaseVersion: request.releaseVersion,
        failureCode: request.failureCode,
        createdAt: request.createdAt
      })),
      transactions: context.incident.transactions.map((transaction) => ({
        id: transaction.id,
        requestId: transaction.requestId,
        status: transaction.status as "FAILED" | "SUCCEEDED",
        applicationVersion: transaction.applicationVersion,
        failureCode: transaction.failureCode,
        createdAt: transaction.createdAt
      })),
      logs: context.incident.logs.map((log) => ({
        timestamp: log.timestamp,
        level: log.level as "INFO" | "WARN" | "ERROR",
        requestId: log.requestId,
        message: log.message
      })),
      audit: context.incident.auditEvents.map((event) => ({
        type: event.type,
        timestamp: event.timestamp
      }))
    });

    const checks = validationChecksFromEvidence(recoveryEvidence);
    const next = validateRecovery(context.incident.status as IncidentStatus, checks);
    const validationStartedAt = new Date();

    await appendAudit(
      tx,
      id,
      "VALIDATION_STARTED",
      {
        thresholdPct: SCENARIO.validationErrorRateThresholdPct,
        recoveryRequestId: SCENARIO.recoveryRequestId,
        recoveryTransactionId: SCENARIO.recoveryTransactionId
      },
      validationStartedAt
    );

    for (const check of checks) {
      await requireSingleUpdate(
        await tx.validationCheck.updateMany({
          where: { incidentId: id, key: check.id, required: true },
          data: { status: check.status }
        }),
        `Validation check ${check.id} is missing or duplicated.`
      );
    }

    await compareAndSetIncidentStatus(tx, id, context.incident.status as IncidentStatus, next);
    await appendAudit(
      tx,
      id,
      "VALIDATION_PASSED",
      {
        passed: 4,
        required: 4,
        stableReleaseRestored: recoveryEvidence.stableReleaseRestored,
        errorRateBelowThreshold: recoveryEvidence.errorRateBelowThreshold,
        syntheticTransactionSucceeded: recoveryEvidence.syntheticTransactionSucceeded,
        noNewTimeoutErrors: recoveryEvidence.noNewTimeoutErrors
      },
      new Date(validationStartedAt.getTime() + 1)
    );

    return { id, status: next, checks, evidence: recoveryEvidence };
  });
}

export async function resolveIncident(id: string) {
  assertCanonicalIncidentId(id);
  return prisma.$transaction(async (tx) => {
    const context = await requireEvidenceContext(tx, id);
    const checks = mapPersistedChecks(context.incident.validationChecks);
    const handoff = deriveResolutionHandoff({
      incident: {
        status: context.incident.status as IncidentStatus,
        recoveredRelease: context.incident.recoveredRelease,
        rootCauseCode: context.incident.rootCauseCode,
        selectedRemediation: context.incident.selectedRemediation,
        affectedRelease: context.incident.affectedRelease,
        technicalSummary: context.incident.technicalSummary,
        closureTechnicalSummary: context.incident.closureTechnicalSummary,
        closureBusinessSummary: context.incident.closureBusinessSummary,
        application: {
          serviceHealth: context.incident.application.serviceHealth,
          activeReleaseVersion: context.incident.application.activeReleaseVersion,
          syntheticErrorRate: context.incident.application.syntheticErrorRate
        }
      },
      releases: {
        previous: {
          version: context.previousRelease.version,
          status: context.previousRelease.status as ReleaseStatus
        },
        current: {
          version: context.currentRelease.version,
          status: context.currentRelease.status as ReleaseStatus
        },
        activeReleaseVersion: context.incident.application.activeReleaseVersion
      },
      requests: context.incident.requests.map((request) => ({
        requestId: request.requestId,
        responseStatus: request.responseStatus,
        releaseVersion: request.releaseVersion,
        failureCode: request.failureCode,
        createdAt: request.createdAt
      })),
      transactions: context.incident.transactions.map((transaction) => ({
        id: transaction.id,
        requestId: transaction.requestId,
        status: transaction.status as "FAILED" | "SUCCEEDED",
        applicationVersion: transaction.applicationVersion,
        failureCode: transaction.failureCode,
        createdAt: transaction.createdAt
      })),
      logs: context.incident.logs.map((log) => ({
        timestamp: log.timestamp,
        level: log.level as "INFO" | "WARN" | "ERROR",
        requestId: log.requestId,
        message: log.message
      })),
      audit: context.incident.auditEvents.map((event) => ({
        type: event.type,
        timestamp: event.timestamp
      })),
      validation: checks
    });
    if (!handoff.ready || !handoff.technicalSummary || !handoff.businessSummary) {
      throw new ApiError(
        409,
        "RESOLUTION_EVIDENCE_INCOMPLETE",
        "Incident closure requires validated, internally consistent persisted recovery evidence.",
        handoff.reasons
      );
    }

    const next = resolveValidatedIncident(context.incident.status as IncidentStatus, checks);
    const now = new Date();
    await compareAndSetIncidentStatus(tx, id, context.incident.status as IncidentStatus, next, {
      closureTechnicalSummary: handoff.technicalSummary,
      closureBusinessSummary: handoff.businessSummary
    });
    await appendAudit(
      tx,
      id,
      "RESOLUTION_HANDOFF_CREATED",
      {
        technicalSummaryGenerated: true,
        businessSummaryGenerated: true,
        validation: "4/4 PASS"
      },
      now
    );
    await appendAudit(
      tx,
      id,
      "INCIDENT_RESOLVED",
      {
        rootCauseCode: context.incident.rootCauseCode ?? "UNKNOWN",
        affectedRelease: context.incident.affectedRelease,
        recoveredRelease: context.incident.recoveredRelease ?? "UNKNOWN",
        validation: "4/4 PASS"
      },
      new Date(now.getTime() + 1)
    );

    return {
      id,
      status: next,
      technicalSummary: handoff.technicalSummary,
      businessSummary: handoff.businessSummary
    };
  });
}

export async function resetDemo() {
  await resetSyntheticScenario(prisma);
  return getIncident(SCENARIO.incidentId);
}
