import { describe, expect, it } from "vitest";
import {
  INITIAL_RELEASE_PAIR,
  assessRootCause,
  beginRollback,
  chooseRemediation,
  confirmReleaseRegression,
  createPendingValidationChecks,
  finishRollback,
  resolveValidatedIncident,
  startInvestigation,
  validateRecovery
} from "@/lib/domain";

const assessment = assessRootCause({
  currentTimeoutMs: 800,
  previousTimeoutMs: 5000,
  observedDownstreamLatencyMs: 1437,
  incidentStartedAfterDeployment: true,
  timeoutErrorCount: 2
});

describe("guarded golden-path workflow", () => {
  it("advances only through evidence-backed commands", () => {
    let status = startInvestigation("OPEN");
    status = confirmReleaseRegression(status, assessment);

    const selected = chooseRemediation(status, assessment, "ROLLBACK_RELEASE");
    status = selected.status;

    const rolling = beginRollback(status, selected.action, { ...INITIAL_RELEASE_PAIR });
    status = rolling.status;

    const rolledBack = finishRollback(status, rolling.releases);
    status = rolledBack.status;

    const checks = createPendingValidationChecks().map((check) => ({
      ...check,
      status: "PASS" as const
    }));
    status = validateRecovery(status, checks);
    status = resolveValidatedIncident(status, checks);

    expect(status).toBe("RESOLVED");
    expect(rolledBack.releases.activeRelease).toBe("PREVIOUS");
  });

  it("blocks regression confirmation without high-confidence evidence", () => {
    const insufficient = assessRootCause({
      currentTimeoutMs: 800,
      previousTimeoutMs: 5000,
      observedDownstreamLatencyMs: 1437,
      incidentStartedAfterDeployment: true,
      timeoutErrorCount: 0
    });
    expect(() => confirmReleaseRegression("INVESTIGATING", insufficient)).toThrow();
  });

  it("blocks validation if canonical checks are incomplete", () => {
    const [one] = createPendingValidationChecks();
    expect(() =>
      validateRecovery("READY_FOR_VALIDATION", [{ ...one, status: "PASS" }])
    ).toThrow();
  });
});
