import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { buildSyntheticScenarioSeed, SCENARIO } from "@/lib/data/synthetic-scenario";
import { assertSyntheticScenarioSeedInvariants } from "@/lib/data/scenario-invariants";
import { REQUIRED_VALIDATION_DEFINITIONS } from "@/lib/domain/validation";

export class PersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceInvariantError";
  }
}

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

async function assertPersistedScenarioInvariants(client: DatabaseClient): Promise<void> {
  const application = await client.application.findUnique({
    where: { id: SCENARIO.applicationId },
    include: {
      releases: { orderBy: { version: "asc" } },
      incidents: {
        where: { id: SCENARIO.incidentId },
        include: {
          logs: true,
          requests: true,
          transactions: true,
          validationChecks: true,
          auditEvents: true
        }
      }
    }
  });

  if (!application) throw new PersistenceInvariantError("Synthetic application was not persisted.");
  if (application.serviceHealth !== "DEGRADED") {
    throw new PersistenceInvariantError("Reset application must persist as DEGRADED.");
  }
  if (application.activeReleaseVersion !== SCENARIO.currentRelease.version) {
    throw new PersistenceInvariantError("Reset must activate the problematic current release.");
  }

  if (application.releases.length !== 2) {
    throw new PersistenceInvariantError("Exactly two releases must be persisted.");
  }
  const previous = application.releases.find((release) => release.version === SCENARIO.previousRelease.version);
  const current = application.releases.find((release) => release.version === SCENARIO.currentRelease.version);
  if (previous?.status !== "STABLE" || current?.status !== "DEGRADED") {
    throw new PersistenceInvariantError("Persisted release pair violates the initial domain invariant.");
  }

  const incident = application.incidents[0];
  if (!incident || application.incidents.length !== 1) {
    throw new PersistenceInvariantError("Exactly one canonical incident must be persisted.");
  }
  if (
    incident.status !== "OPEN" ||
    incident.selectedRemediation !== null ||
    incident.rootCauseCode !== null ||
    incident.closureTechnicalSummary !== null ||
    incident.closureBusinessSummary !== null
  ) {
    throw new PersistenceInvariantError("Reset incident contains progressed workflow or closure state.");
  }

  const validationKeys = incident.validationChecks.map((check) => check.key);
  if (validationKeys.length !== REQUIRED_VALIDATION_DEFINITIONS.length) {
    throw new PersistenceInvariantError("Persisted validation gate does not contain exactly four canonical checks.");
  }
  for (const definition of REQUIRED_VALIDATION_DEFINITIONS) {
    const matches = incident.validationChecks.filter((check) => check.key === definition.id);
    if (matches.length !== 1 || matches[0].required !== true || matches[0].status !== "PENDING") {
      throw new PersistenceInvariantError(`Persisted validation check ${definition.id} is invalid.`);
    }
  }

  const request = incident.requests[0];
  const transaction = incident.transactions[0];
  if (!request || !transaction) {
    throw new PersistenceInvariantError("Correlated request/transaction evidence is missing.");
  }
  if (
    request.requestId !== SCENARIO.requestId ||
    transaction.requestId !== SCENARIO.requestId ||
    request.releaseVersion !== SCENARIO.currentRelease.version ||
    transaction.applicationVersion !== SCENARIO.currentRelease.version
  ) {
    throw new PersistenceInvariantError("Persisted request/transaction correlation drifted.");
  }
  const correlatedError = incident.logs.some(
    (log) => log.requestId === SCENARIO.requestId && log.level === "ERROR"
  );
  if (!correlatedError) {
    throw new PersistenceInvariantError("Persisted correlated ERROR evidence is missing.");
  }
}

export async function resetSyntheticScenario(client: PrismaClient = prisma): Promise<void> {
  const seed = buildSyntheticScenarioSeed();
  assertSyntheticScenarioSeedInvariants(seed);

  await client.$transaction(async (tx) => {
    // Delete only the canonical synthetic application. Cascades remove its incident evidence.
    // If any insert or invariant check fails, PostgreSQL rolls the entire reset back atomically.
    await tx.application.deleteMany({ where: { id: SCENARIO.applicationId } });

    await tx.application.create({ data: seed.application });
    await tx.release.createMany({ data: seed.releases });
    await tx.incident.create({ data: seed.incident });
    await tx.diagnosticLog.createMany({ data: seed.logs });
    await tx.apiRequest.createMany({ data: seed.requests });
    await tx.syntheticTransaction.createMany({ data: seed.transactions });
    await tx.validationCheck.createMany({ data: seed.validationChecks });
    await tx.auditEvent.createMany({ data: seed.auditEvents });

    await assertPersistedScenarioInvariants(tx);
  });
}

export async function readSyntheticScenario(client: DatabaseClient = prisma) {
  return client.incident.findUnique({
    where: { id: SCENARIO.incidentId },
    include: {
      application: { include: { releases: { orderBy: { version: "asc" } } } },
      logs: { orderBy: { timestamp: "asc" } },
      requests: { orderBy: { createdAt: "asc" } },
      transactions: { orderBy: { createdAt: "asc" } },
      validationChecks: { orderBy: { key: "asc" } },
      auditEvents: { orderBy: { timestamp: "asc" } }
    }
  });
}
