import {
  REMEDIATION_OPTIONS,
  canRecordRemediationDecision,
  remediationDecisionMode,
  remediationOption
} from "../lib/ui/remediation-decision";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

assert(REMEDIATION_OPTIONS.length === 4, "four remediation options are available for review");
assert(
  remediationDecisionMode({ status: "INVESTIGATING", rootCauseCode: null, selectedRemediation: null }) === "LOCKED",
  "decision remains LOCKED before root-cause confirmation"
);
assert(
  remediationDecisionMode({ status: "REGRESSION_CONFIRMED", rootCauseCode: "RELEASE_TIMEOUT_REGRESSION", selectedRemediation: null }) === "READY",
  "decision becomes READY after persisted release regression"
);
assert(remediationOption("ROLLBACK_RELEASE").risk === "MEDIUM", "rollback is presented with MEDIUM risk");
assert(remediationOption("ROLLBACK_RELEASE").evidenceFit === "STRONG", "rollback has strongest evidence fit");
assert(remediationOption("CHANGE_PRODUCTION_DATA").evidenceFit === "NO_EVIDENCE", "production data change has no supporting evidence");
assert(canRecordRemediationDecision({ mode: "READY", action: "ROLLBACK_RELEASE" }), "guard permits recording rollback decision");
assert(!canRecordRemediationDecision({ mode: "READY", action: "RETRY_FAILED_TRANSACTIONS" }), "retry cannot be recorded as successful remediation");
assert(!canRecordRemediationDecision({ mode: "READY", action: "CHANGE_PRODUCTION_DATA" }), "data change cannot be recorded as successful remediation");
assert(!canRecordRemediationDecision({ mode: "READY", action: "ESCALATE_WITHOUT_ACTION" }), "escalation cannot be recorded as successful remediation");
assert(
  remediationDecisionMode({ status: "REMEDIATION_SELECTED", rootCauseCode: "RELEASE_TIMEOUT_REGRESSION", selectedRemediation: "ROLLBACK_RELEASE" }) === "RECORDED",
  "persisted rollback selection moves decision to RECORDED"
);
console.log("PASS10_REMEDIATION_DECISION_SMOKE_PASS");
