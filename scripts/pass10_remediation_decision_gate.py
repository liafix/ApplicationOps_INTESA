from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/page.tsx").read_text()
component = (ROOT / "components/remediation-decision.tsx").read_text()
provider = (ROOT / "components/guided-workflow-provider.tsx").read_text()
controller = (ROOT / "components/guided-controller.tsx").read_text()
helper = (ROOT / "lib/ui/remediation-decision.ts").read_text()
guided = (ROOT / "lib/ui/guided-workflow.ts").read_text()
unit = (ROOT / "tests/unit/remediation-decision.test.ts").read_text()
domain = (ROOT / "lib/domain/remediation.ts").read_text()
service = (ROOT / "lib/services/applicationops-service.ts").read_text()

checks = []
def check(name, ok, detail):
    checks.append((name, bool(ok), detail))

# PASS 10 artifacts / rendering
check("decision_component_exists", (ROOT / "components/remediation-decision.tsx").exists(), "Dedicated remediation decision component exists.")
check("decision_helper_exists", (ROOT / "lib/ui/remediation-decision.ts").exists(), "Pure remediation presentation helper exists.")
check("decision_unit_exists", (ROOT / "tests/unit/remediation-decision.test.ts").exists(), "PASS 10 unit-test source exists.")
check("component_rendered", "<RemediationDecision />" in page, "Remediation section renders the dedicated decision component.")
check("nothing_preselected_copy", "Nothing is preselected" in component and "useState<RemediationAction | null>(null)" in component, "Decision UX begins without a preselected action.")

# All options are reviewable
for action in [
    "RETRY_FAILED_TRANSACTIONS",
    "CHANGE_PRODUCTION_DATA",
    "ROLLBACK_RELEASE",
    "ESCALATE_WITHOUT_ACTION",
]:
    check(f"option::{action}", action in helper, f"Decision model includes {action}.")
for marker in ["Risk {option.risk}", "evidenceFitLabel", "reviewQuestion", "shortRationale"]:
    check(f"review_surface::{marker[:18]}", marker in component, f"Option review exposes {marker}.")
check("no_universal_low_risk_rollback", 'action: "ROLLBACK_RELEASE"' in helper and 'risk: "MEDIUM"' in helper, "Rollback is not presented as universally low risk.")
check("strong_fit_not_preselection", 'evidenceFit: "STRONG"' in helper and "aria-pressed={active}" in component, "Strong evidence fit is distinct from UI preselection.")

# Fail-closed decision gate
for mode in ['"LOCKED"', '"READY"', '"RECORDED"']:
    check(f"mode::{mode}", mode in helper, f"Decision disclosure includes {mode} mode.")
check("ready_requires_persisted_root_cause", 'input.rootCauseCode === "RELEASE_TIMEOUT_REGRESSION"' in helper and 'input.status === "REGRESSION_CONFIRMED"' in helper, "READY mode requires persisted confirmed root cause.")
check("recorded_requires_persisted_selection", 'input.status === "REMEDIATION_SELECTED"' in helper and 'input.selectedRemediation === "ROLLBACK_RELEASE"' in helper, "RECORDED mode requires persisted rollback selection.")
check("only_supported_can_record", "remediationOption(input.action).executableForScenario" in helper, "UI record gate delegates to explicit scenario support metadata.")
check("unsupported_button_disabled", "disabled={!canRecord || busy}" in component and "NOT SUPPORTED BY EVIDENCE" in component, "Unsupported options remain reviewable but cannot be recorded as success.")

# Persisted backend decision; no client status mutation
check("provider_exposes_submit", "submitRemediationDecision" in provider, "Provider exposes a dedicated decision submission action.")
check("remediation_post", "/remediation`" in provider and 'body: JSON.stringify({ action })' in provider, "Decision is persisted through the existing guarded remediation endpoint.")
check("server_guard_remains", "chooseRemediation" in service and "selectRemediation" in domain, "Server/domain remediation guard remains authoritative.")
check("no_generic_status_patch", 'method: "PATCH"' not in provider and "/status" not in provider, "PASS 10 does not add generic status mutation.")
check("no_client_root_cause_engine", "assessRootCause" not in component and "assessRootCause" not in helper, "Decision UI consumes persisted root cause rather than recomputing it.")

# Guided workflow now stops before PASS 11 recovery execution
check("step3_is_decision", 'title: "Choose a remediation action"' in guided and 'actionLabel: "REVIEW REMEDIATION OPTIONS"' in guided, "Step 3 is a decision stage, not an automatic rollback action.")
check("step3_controller_scroll_only", 'case 3:\n          scrollToGuidedTarget("remediation");\n          return;' in provider, "Primary Step 3 controller only navigates to the decision surface.")
check("rollback_not_called_by_provider", "/rollback`" not in provider, "PASS 10 UI no longer executes rollback.")
check("decision_recorded_controller_hold", "decisionRecorded" in controller and "DECISION RECORDED" in controller, "Controller holds after persisted selection instead of starting recovery.")
check("separate_recovery_copy", "Recovery execution remains a separate controlled action" in component, "UI explicitly separates decision from execution.")

# PASS 11 freeze — backend route may be inherited, but no new recovery UI implementation.
for path in [
    "components/rollback-recovery.tsx",
    "lib/ui/rollback-recovery.ts",
    "tests/unit/rollback-recovery.test.ts",
    "scripts/pass11_rollback_recovery_gate.py",
]:
    check(f"no_pass11::{path}", not (ROOT / path).exists(), f"PASS 11 artifact {path} was not introduced.")
check("no_recovery_ui_markers", "EXECUTE ROLLBACK" not in component and "ROLLBACK COMPLETED" not in component, "PASS 10 decision component does not present recovery execution/results.")

# Test-source expectations
for phrase in ["LOCKED", "READY", "RECORDED", "ROLLBACK_RELEASE", "CHANGE_PRODUCTION_DATA", "Nothing preselected"]:
    needle = phrase if phrase != "Nothing preselected" else "presents all four response options without preselecting one"
    check(f"unit::{phrase}", needle in unit, f"Unit source covers {phrase} behavior.")

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL"), name, "-", detail)
print(f"\nchecks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed:
    sys.exit(1)
print("PASS10_REMEDIATION_DECISION_GATE_PASS")
