// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { readSyntheticScenario, resetSyntheticScenario } from "@/lib/db/synthetic-scenario-store";
import { SCENARIO } from "@/lib/data/synthetic-scenario";
import { DomainError } from "@/lib/domain/errors";
import { ApiError } from "@/lib/api/errors";
import {
  confirmRegression,
  investigateIncident,
  resolveIncident,
  rollbackIncident,
  runIncidentValidation,
  selectIncidentRemediation
} from "@/lib/services/applicationops-service";

const EXPECTED_AUDIT_SEQUENCE = [
  "RELEASE_DEPLOYED",
  "INCIDENT_CREATED",
  "APPLICATION_DEGRADED",
  "INVESTIGATION_STARTED",
  "RELEASE_COMPARISON_REVIEWED",
  "RELEASE_REGRESSION_CONFIRMED",
  "REMEDIATION_SELECTED",
  "ROLLBACK_STARTED",
  "ROLLBACK_COMPLETED",
  "VALIDATION_STARTED",
  "VALIDATION_PASSED",
  "RESOLUTION_HANDOFF_CREATED",
  "INCIDENT_RESOLVED"
] as const;

async function progressToConfirmedRegression() {
  await investigateIncident(SCENARIO.incidentId);
  await confirmRegression(SCENARIO.incidentId);
}

async function progressToReadyForValidation() {
  await progressToConfirmedRegression();
  await selectIncidentRemediation(SCENARIO.incidentId, "ROLLBACK_RELEASE");
  await rollbackIncident(SCENARIO.incidentId);
}

function assertErrorCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(Error);
  expect((error as { code?: string }).code).toBe(code);
}

describe.sequential("ApplicationOps PostgreSQL backend MVP gate", () => {
  beforeEach(async () => {
    await resetSyntheticScenario(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists the complete golden path with final recovery state and ordered audit evidence", async () => {
    await investigateIncident(SCENARIO.incidentId);
    await confirmRegression(SCENARIO.incidentId);
    await selectIncidentRemediation(SCENARIO.incidentId, "ROLLBACK_RELEASE");
    await rollbackIncident(SCENARIO.incidentId);
    await runIncidentValidation(SCENARIO.incidentId);
    await resolveIncident(SCENARIO.incidentId);

    const persisted = await readSyntheticScenario(prisma);
    expect(persisted).not.toBeNull();
    if (!persisted) throw new Error("Canonical incident was not persisted.");

    expect(persisted.status).toBe("RESOLVED");
    expect(persisted.rootCauseCode).toBe("RELEASE_TIMEOUT_REGRESSION");
    expect(persisted.selectedRemediation).toBe("ROLLBACK_RELEASE");
    expect(persisted.affectedRelease).toBe(SCENARIO.currentRelease.version);
    expect(persisted.recoveredRelease).toBe(SCENARIO.previousRelease.version);
    expect(persisted.closureTechnicalSummary).toContain("RELEASE_TIMEOUT_REGRESSION");
    expect(persisted.closureBusinessSummary).toContain("previous stable release");

    expect(persisted.application.activeReleaseVersion).toBe(SCENARIO.previousRelease.version);
    expect(persisted.application.serviceHealth).toBe("HEALTHY");
    expect(persisted.application.syntheticErrorRate).toBe(SCENARIO.recoveredErrorRatePct);

    const current = persisted.application.releases.find(
      (release) => release.version === SCENARIO.currentRelease.version
    );
    const previous = persisted.application.releases.find(
      (release) => release.version === SCENARIO.previousRelease.version
    );
    expect(current?.status).toBe("ROLLED_BACK");
    expect(previous?.status).toBe("STABLE");

    expect(persisted.validationChecks).toHaveLength(4);
    expect(persisted.validationChecks.every((check) => check.required && check.status === "PASS")).toBe(true);

    expect(
      persisted.transactions.some(
        (transaction) =>
          transaction.id === SCENARIO.recoveryTransactionId &&
          transaction.status === "SUCCEEDED" &&
          transaction.applicationVersion === SCENARIO.previousRelease.version
      )
    ).toBe(true);

    expect(persisted.auditEvents.map((event) => event.type)).toEqual(EXPECTED_AUDIT_SEQUENCE);
    for (let index = 1; index < persisted.auditEvents.length; index += 1) {
      expect(persisted.auditEvents[index].timestamp.getTime()).toBeGreaterThan(
        persisted.auditEvents[index - 1].timestamp.getTime()
      );
    }
  });

  it("rejects rollback before evidence/remediation and persists no partial rollback state", async () => {
    let thrown: unknown;
    try {
      await rollbackIncident(SCENARIO.incidentId);
    } catch (error) {
      thrown = error;
    }
    assertErrorCode(thrown, "REMEDIATION_NOT_SELECTED");

    const persisted = await readSyntheticScenario(prisma);
    expect(persisted?.status).toBe("OPEN");
    expect(persisted?.application.activeReleaseVersion).toBe(SCENARIO.currentRelease.version);
    expect(persisted?.auditEvents.some((event) => event.type.startsWith("ROLLBACK_"))).toBe(false);
  });

  it("rejects a non-supported remediation and keeps the confirmed regression state atomically", async () => {
    await progressToConfirmedRegression();

    let thrown: unknown;
    try {
      await selectIncidentRemediation(SCENARIO.incidentId, "CHANGE_PRODUCTION_DATA");
    } catch (error) {
      thrown = error;
    }
    assertErrorCode(thrown, "REMEDIATION_NOT_SUPPORTED");

    const persisted = await readSyntheticScenario(prisma);
    expect(persisted?.status).toBe("REGRESSION_CONFIRMED");
    expect(persisted?.selectedRemediation).toBeNull();
    expect(persisted?.auditEvents.some((event) => event.type === "REMEDIATION_SELECTED")).toBe(false);
  });

  it("rejects validation before rollback and leaves all canonical checks pending", async () => {
    await progressToConfirmedRegression();
    await selectIncidentRemediation(SCENARIO.incidentId, "ROLLBACK_RELEASE");

    let thrown: unknown;
    try {
      await runIncidentValidation(SCENARIO.incidentId);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    assertErrorCode(thrown, "ROLLBACK_NOT_COMPLETED");

    const persisted = await readSyntheticScenario(prisma);
    expect(persisted?.status).toBe("REMEDIATION_SELECTED");
    expect(persisted?.validationChecks.every((check) => check.status === "PENDING")).toBe(true);
    expect(persisted?.auditEvents.some((event) => event.type.startsWith("VALIDATION_"))).toBe(false);
  });

  it("rejects resolution before 4/4 persisted validation and writes no resolution audit", async () => {
    await progressToReadyForValidation();

    let thrown: unknown;
    try {
      await resolveIncident(SCENARIO.incidentId);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DomainError);
    assertErrorCode(thrown, "VALIDATION_REQUIRED");

    const persisted = await readSyntheticScenario(prisma);
    expect(persisted?.status).toBe("READY_FOR_VALIDATION");
    expect(persisted?.validationChecks.every((check) => check.status === "PENDING")).toBe(true);
    expect(persisted?.closureTechnicalSummary).toBeNull();
    expect(persisted?.closureBusinessSummary).toBeNull();
    expect(persisted?.auditEvents.some((event) => event.type === "RESOLUTION_HANDOFF_CREATED")).toBe(false);
    expect(persisted?.auditEvents.some((event) => event.type === "INCIDENT_RESOLVED")).toBe(false);
  });


  it("derives validation from persisted recovery evidence and refuses a tampered recovery request", async () => {
    await progressToReadyForValidation();

    await prisma.apiRequest.update({
      where: { id: "api-request-recovery-1" },
      data: { responseStatus: 500, failureCode: SCENARIO.failureCode }
    });

    let thrown: unknown;
    try {
      await runIncidentValidation(SCENARIO.incidentId);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DomainError);
    assertErrorCode(thrown, "VALIDATION_REQUIRED");

    const persisted = await readSyntheticScenario(prisma);
    expect(persisted?.status).toBe("READY_FOR_VALIDATION");
    expect(persisted?.validationChecks.every((check) => check.status === "PENDING")).toBe(true);
    expect(persisted?.auditEvents.some((event) => event.type === "VALIDATION_STARTED")).toBe(false);
    expect(persisted?.auditEvents.some((event) => event.type === "VALIDATION_PASSED")).toBe(false);
  });

  it("refuses resolution when persisted recovery evidence drifts after validation", async () => {
    await progressToReadyForValidation();
    await runIncidentValidation(SCENARIO.incidentId);
    await prisma.application.update({ where: { id: SCENARIO.applicationId }, data: { serviceHealth: "DEGRADED" } });

    await expect(resolveIncident(SCENARIO.incidentId)).rejects.toMatchObject({ code: "RESOLUTION_EVIDENCE_INCOMPLETE" });
    const persisted = await readSyntheticScenario(prisma);
    expect(persisted?.status).toBe("VALIDATED");
    expect(persisted?.closureTechnicalSummary).toBeNull();
    expect(persisted?.closureBusinessSummary).toBeNull();
    expect(persisted?.auditEvents.some((event) => event.type === "INCIDENT_RESOLVED")).toBe(false);
  });

  it("rolls back the entire rollback command when persisted release evidence conflicts mid-transaction", async () => {
    await progressToConfirmedRegression();
    await selectIncidentRemediation(SCENARIO.incidentId, "ROLLBACK_RELEASE");

    await prisma.application.update({
      where: { id: SCENARIO.applicationId },
      data: { serviceHealth: "HEALTHY" }
    });

    await expect(rollbackIncident(SCENARIO.incidentId)).rejects.toMatchObject({
      name: "PersistenceConflictError"
    });

    const persisted = await readSyntheticScenario(prisma);
    const current = persisted?.application.releases.find(
      (release) => release.version === SCENARIO.currentRelease.version
    );

    expect(persisted?.status).toBe("REMEDIATION_SELECTED");
    expect(current?.status).toBe("DEGRADED");
    expect(persisted?.application.activeReleaseVersion).toBe(SCENARIO.currentRelease.version);
    expect(persisted?.auditEvents.some((event) => event.type === "ROLLBACK_STARTED")).toBe(false);
  });

  it("reset remains deterministic after a completed workflow", async () => {
    await progressToReadyForValidation();
    await runIncidentValidation(SCENARIO.incidentId);
    await resolveIncident(SCENARIO.incidentId);

    await resetSyntheticScenario(prisma);
    const reset = await readSyntheticScenario(prisma);

    expect(reset?.status).toBe("OPEN");
    expect(reset?.rootCauseCode).toBeNull();
    expect(reset?.selectedRemediation).toBeNull();
    expect(reset?.recoveredRelease).toBeNull();
    expect(reset?.closureTechnicalSummary).toBeNull();
    expect(reset?.closureBusinessSummary).toBeNull();
    expect(reset?.application.serviceHealth).toBe("DEGRADED");
    expect(reset?.application.activeReleaseVersion).toBe(SCENARIO.currentRelease.version);
    expect(reset?.transactions).toHaveLength(1);
    expect(reset?.requests).toHaveLength(1);
    expect(reset?.logs).toHaveLength(5);
    expect(reset?.validationChecks).toHaveLength(4);
    expect(reset?.validationChecks.every((check) => check.status === "PENDING")).toBe(true);
    expect(reset?.auditEvents.map((event) => event.type)).toEqual([
      "RELEASE_DEPLOYED",
      "INCIDENT_CREATED",
      "APPLICATION_DEGRADED"
    ]);
  });
});
