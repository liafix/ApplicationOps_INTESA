export const SCENARIO = Object.freeze({
  incidentId: "APP-2047",
  severity: "HIGH",
  service: "Transaction Processing Service",
  previousRelease: "2.7.4",
  currentRelease: "2.8.0",
  currentTimeoutMs: 800,
  previousTimeoutMs: 5000,
  observedLatencyMs: 1437,
  initialErrorRate: 14.8,
  recoveredErrorRate: 1.1,
  validationThreshold: 5,
  failureCode: "UPSTREAM_TIMEOUT",
  failedRequestId: "req_tx_8f31",
  failedTransactionId: "TX-90842",
  recoveryRequestId: "req_tx_recovery",
  recoveryTransactionId: "TX-90843"
});

export const STEPS = Object.freeze([
  { id: 1, key: "investigate", label: "Investigate", action: "START INVESTIGATION" },
  { id: 2, key: "confirm", label: "Confirm regression", action: "CONFIRM REGRESSION" },
  { id: 3, key: "remediate", label: "Choose remediation", action: "RECORD ROLLBACK DECISION" },
  { id: 4, key: "recover", label: "Recover & validate", action: "ROLL BACK + VALIDATE" },
  { id: 5, key: "resolve", label: "Resolve", action: "RESOLVE INCIDENT" }
]);

const baseAudit = () =>
  [
    ["RELEASE_DEPLOYED", "Synthetic deployment pipeline", "07:30:00"],
    ["INCIDENT_CREATED", "Synthetic monitoring", "07:32:20"],
    ["APPLICATION_DEGRADED", "Synthetic monitoring", "07:32:21"]
  ].map(([type, actor, time], index) => ({ id: `seed-${index}`, type, actor, time }));

export function initialState() {
  return {
    step: 1,
    complete: false,
    incidentStatus: "OPEN",
    serviceHealth: "DEGRADED",
    activeRelease: SCENARIO.currentRelease,
    errorRate: SCENARIO.initialErrorRate,
    rootCause: null,
    remediation: null,
    currentReleaseStatus: "DEGRADED",
    validation: [
      ["stable-release", "Previous stable release restored"],
      ["error-rate", "Error rate returned below threshold"],
      ["synthetic-transaction", "New synthetic transaction completed successfully"],
      ["timeout-errors", "No new timeout errors detected"]
    ].map(([key, label]) => ({ key, label, status: "PENDING" })),
    audit: baseAudit(),
    recoveryRequest: null,
    recoveryTransaction: null,
    technicalSummary: null,
    businessSummary: null
  };
}

function clone(state) {
  return {
    ...state,
    validation: state.validation.map((item) => ({ ...item })),
    audit: state.audit.map((event) => ({ ...event })),
    recoveryRequest: state.recoveryRequest ? { ...state.recoveryRequest } : null,
    recoveryTransaction: state.recoveryTransaction ? { ...state.recoveryTransaction } : null
  };
}

function addAudit(state, type, actor, time) {
  state.audit.push({ id: `${type}-${state.audit.length + 1}`, type, actor, time });
}

export function runPrimaryAction(input) {
  const state = clone(input);
  switch (state.step) {
    case 1: {
      if (state.incidentStatus !== "OPEN") throw new Error("Investigation must start from OPEN.");
      state.incidentStatus = "INVESTIGATING";
      addAudit(state, "INVESTIGATION_STARTED", "Candidate reviewer", "07:33:00");
      state.step = 2;
      return state;
    }
    case 2: {
      if (state.incidentStatus !== "INVESTIGATING")
        throw new Error("Regression confirmation requires INVESTIGATING.");
      if (
        !(
          SCENARIO.observedLatencyMs > SCENARIO.currentTimeoutMs &&
          SCENARIO.currentTimeoutMs < SCENARIO.previousTimeoutMs
        )
      ) {
        throw new Error("Evidence does not support a timeout regression.");
      }
      state.incidentStatus = "REGRESSION_CONFIRMED";
      state.rootCause = "RELEASE_TIMEOUT_REGRESSION";
      addAudit(state, "RELEASE_COMPARISON_REVIEWED", "Candidate reviewer", "07:34:00");
      addAudit(state, "RELEASE_REGRESSION_CONFIRMED", "Presentation engine", "07:34:01");
      state.step = 3;
      return state;
    }
    case 3: {
      if (
        state.incidentStatus !== "REGRESSION_CONFIRMED" ||
        state.rootCause !== "RELEASE_TIMEOUT_REGRESSION"
      ) {
        throw new Error("Remediation requires a confirmed regression.");
      }
      state.incidentStatus = "REMEDIATION_SELECTED";
      state.remediation = "ROLLBACK_RELEASE";
      addAudit(state, "REMEDIATION_SELECTED", "Candidate reviewer", "07:35:00");
      state.step = 4;
      return state;
    }
    case 4: {
      if (
        state.incidentStatus !== "REMEDIATION_SELECTED" ||
        state.remediation !== "ROLLBACK_RELEASE"
      ) {
        throw new Error("Recovery requires the rollback decision.");
      }
      state.incidentStatus = "ROLLING_BACK";
      state.currentReleaseStatus = "ROLLING_BACK";
      addAudit(state, "ROLLBACK_STARTED", "Presentation engine", "07:36:00");

      state.currentReleaseStatus = "ROLLED_BACK";
      state.activeRelease = SCENARIO.previousRelease;
      state.serviceHealth = "HEALTHY";
      state.errorRate = SCENARIO.recoveredErrorRate;
      state.incidentStatus = "READY_FOR_VALIDATION";
      state.recoveryRequest = {
        id: SCENARIO.recoveryRequestId,
        status: 200,
        release: SCENARIO.previousRelease
      };
      state.recoveryTransaction = {
        id: SCENARIO.recoveryTransactionId,
        status: "SUCCEEDED",
        release: SCENARIO.previousRelease
      };
      addAudit(state, "ROLLBACK_COMPLETED", "Presentation engine", "07:36:01");

      const validationReady =
        state.activeRelease === SCENARIO.previousRelease &&
        state.serviceHealth === "HEALTHY" &&
        state.errorRate < SCENARIO.validationThreshold &&
        state.recoveryRequest?.status === 200 &&
        state.recoveryTransaction?.status === "SUCCEEDED";
      if (!validationReady) throw new Error("Recovery evidence is incomplete.");

      state.validation = state.validation.map((item) => ({ ...item, status: "PASS" }));
      state.incidentStatus = "VALIDATED";
      addAudit(state, "VALIDATION_STARTED", "Candidate reviewer", "07:37:00");
      addAudit(state, "VALIDATION_PASSED", "Presentation engine", "07:37:01");
      state.step = 5;
      return state;
    }
    case 5: {
      if (
        state.incidentStatus !== "VALIDATED" ||
        state.validation.some((item) => item.status !== "PASS")
      ) {
        throw new Error("Incident resolution requires 4/4 validation.");
      }
      state.technicalSummary = `Root cause ${state.rootCause} affected release v${SCENARIO.currentRelease}. Controlled rollback restored v${SCENARIO.previousRelease}; service health returned to HEALTHY and recovery validation passed 4/4.`;
      state.businessSummary =
        "A release-level timeout regression caused elevated synthetic transaction failures. The previous stable release was restored, recovery checks passed 4/4, and the synthetic incident was closed after validation.";
      addAudit(state, "RESOLUTION_HANDOFF_CREATED", "Candidate reviewer", "07:38:00");
      state.incidentStatus = "RESOLVED";
      addAudit(state, "INCIDENT_RESOLVED", "Candidate reviewer", "07:38:01");
      state.complete = true;
      state.step = 6;
      return state;
    }
    default:
      return state;
  }
}

export function validationCount(state) {
  return state.validation.filter((item) => item.status === "PASS").length;
}
