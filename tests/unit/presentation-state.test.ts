import { describe, expect, it } from "vitest";

import { SCENARIO } from "@/lib/data/synthetic-scenario";
import {
  createPresentationState,
  presentationBeginRollback,
  presentationCompleteRollback,
  presentationConfirmRegression,
  presentationRecordRemediation,
  presentationResolve,
  presentationRunValidation,
  presentationStartInvestigation
} from "@/lib/presentation/presentation-state";

describe("recruiter presentation mode", () => {
  it("runs the deterministic five-step workflow without a database", () => {
    let state = createPresentationState();
    expect(state.incident.status).toBe("OPEN");

    state = presentationStartInvestigation(state);
    expect(state.incident.status).toBe("INVESTIGATING");

    state = presentationConfirmRegression(state);
    expect(state.incident.status).toBe("REGRESSION_CONFIRMED");
    expect(state.incident.rootCauseCode).toBe("RELEASE_TIMEOUT_REGRESSION");

    state = presentationRecordRemediation(state, "ROLLBACK_RELEASE");
    expect(state.incident.status).toBe("REMEDIATION_SELECTED");

    state = presentationBeginRollback(state);
    expect(state.incident.status).toBe("ROLLING_BACK");

    state = presentationCompleteRollback(state);
    expect(state.incident.status).toBe("READY_FOR_VALIDATION");
    expect(state.incident.application.activeReleaseVersion).toBe(SCENARIO.previousRelease.version);
    expect(state.incident.application.serviceHealth).toBe("HEALTHY");
    expect(state.releases.current.status).toBe("ROLLED_BACK");

    state = presentationRunValidation(state);
    expect(state.incident.status).toBe("VALIDATED");
    expect(state.validation.every((check) => check.status === "PASS")).toBe(true);

    state = presentationResolve(state);
    expect(state.incident.status).toBe("RESOLVED");
    expect(state.incident.closureTechnicalSummary).toContain("RELEASE_TIMEOUT_REGRESSION");
    expect(state.incident.closureBusinessSummary).toContain("synthetic");
    expect(state.audit.at(-1)?.type).toBe("INCIDENT_RESOLVED");
  });

  it("rejects unsupported remediation and premature transitions", () => {
    const initial = createPresentationState();
    expect(() => presentationConfirmRegression(initial)).toThrow();

    const investigating = presentationStartInvestigation(initial);
    const confirmed = presentationConfirmRegression(investigating);
    expect(() => presentationRecordRemediation(confirmed, "CHANGE_PRODUCTION_DATA")).toThrow();
    expect(() => presentationRunValidation(confirmed)).toThrow();
  });

  it("resets to the same canonical synthetic opening state", () => {
    const first = createPresentationState();
    const second = createPresentationState();
    expect(second).toEqual(first);
  });
});
