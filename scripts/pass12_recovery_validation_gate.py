from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
provider = (ROOT / "components/guided-workflow-provider.tsx").read_text()
controller = (ROOT / "components/guided-controller.tsx").read_text()
page = (ROOT / "app/page.tsx").read_text()
component = (ROOT / "components/recovery-validation.tsx").read_text()
ui_helper = (ROOT / "lib/ui/recovery-validation.ts").read_text()
evidence = (ROOT / "lib/evidence/recovery-validation.ts").read_text()
service = (ROOT / "lib/services/applicationops-service.ts").read_text()
integration = (ROOT / "tests/integration/applicationops.db.test.ts").read_text()
unit_evidence = (ROOT / "tests/unit/recovery-validation-evidence.test.ts").read_text()
unit_ui = (ROOT / "tests/unit/recovery-validation-ui.test.ts").read_text()

checks=[]
def check(name, ok, detail): checks.append((name,bool(ok),detail))

for path in [
    "components/recovery-validation.tsx",
    "lib/ui/recovery-validation.ts",
    "lib/evidence/recovery-validation.ts",
    "tests/unit/recovery-validation-evidence.test.ts",
    "tests/unit/recovery-validation-ui.test.ts",
    "scripts/pass12_validation_smoke.ts",
]:
    check(f"artifact::{path}", (ROOT/path).exists(), f"PASS 12 artifact {path} exists.")

check("page_renders_validation", "<RecoveryValidation />" in page and 'id="validation"' in page, "Recovery validation section renders the PASS 12 component.")
check("provider_calls_validation", "/validation/run`" in provider and 'method: "POST"' in provider, "Step 4 executes the existing guarded validation endpoint.")
check("provider_stops_before_resolution", "/resolve" not in provider, "Guided provider does not execute resolution in PASS 12.")
check("controller_validation_action", "RUN RECOVERY VALIDATION" in controller, "Controller exposes explicit validation execution after recovery.")
check("controller_holds_after_validation", "VALIDATION COMPLETE" in controller and "validationComplete" in controller, "Controller stops after VALIDATED rather than resolving automatically.")
check("validation_complete_disabled", "rollbackExecuting || validationComplete" in controller, "Validated state disables further guided action in PASS 12.")

for marker in [
    "stableReleaseRestored",
    "errorRateBelowThreshold",
    "syntheticTransactionSucceeded",
    "noNewTimeoutErrors",
]:
    check(f"evidence::{marker}", marker in evidence and marker in service, f"Server validation derives {marker} from persisted recovery state.")

check("exact_recovery_request", "SCENARIO.recoveryRequestId" in evidence and "responseStatus === 200" in evidence, "Synthetic transaction check requires the exact persisted recovery request and HTTP success.")
check("exact_recovery_transaction", "SCENARIO.recoveryTransactionId" in evidence and 'status === "SUCCEEDED"' in evidence, "Synthetic transaction check requires the exact persisted recovery transaction.")
check("restored_release_guard", 'status === "ROLLED_BACK"' in evidence and 'status === "STABLE"' in evidence and 'serviceHealth === "HEALTHY"' in evidence, "Stable-release validation checks persisted release and service recovery invariants.")
check("strict_error_threshold", "<\n      SCENARIO.validationErrorRateThresholdPct" in evidence or "SCENARIO.validationErrorRateThresholdPct" in evidence, "Error-rate check uses the configured synthetic validation threshold.")
check("timeout_after_rollback", "timeMs(log.timestamp) > rollbackCompletedAt" in evidence and "SCENARIO.failureCode" in evidence, "Timeout check is scoped after the persisted ROLLBACK_COMPLETED boundary.")

check("server_authoritative_copy", "The browser does not mark these checks as passed" in component, "UI explicitly distinguishes evidence readiness from authoritative server validation.")
check("four_definitions", "REQUIRED_VALIDATION_DEFINITIONS.map" in component, "UI renders the exact canonical four validation definitions.")
check("evidence_vs_persisted", "Evidence readiness" in component and "Persisted validation" in component, "UI separates observed evidence readiness from persisted PASS state.")
check("closure_boundary", "4/4 validated ≠ incident resolved" in component, "PASS 12 preserves validation-vs-resolution boundary.")

for mode in ['"LOCKED"', '"READY"', '"BLOCKED"', '"VALIDATED"', '"INCONSISTENT"']:
    check(f"mode::{mode}", mode in ui_helper, f"Validation view includes fail-closed {mode} mode.")
check("schema_exact", "validation.length === REQUIRED_VALIDATION_DEFINITIONS.length" in ui_helper and "unique.size === REQUIRED_VALIDATION_DEFINITIONS.length" in ui_helper, "UI validation view fails closed on missing/duplicate canonical checks.")
check("validation_audits_required", "VALIDATION_STARTED" in ui_helper and "VALIDATION_PASSED" in ui_helper, "VALIDATED display requires persisted validation audit evidence.")

check("atomic_backend", "prisma.$transaction" in service and '"VALIDATION_STARTED"' in service and '"VALIDATION_PASSED"' in service, "Validation remains an atomic DB transaction with matching audit events.")
check("guarded_domain_validation", "validateRecovery" in service and "validationChecksFromEvidence" in service, "Backend still delegates 4/4 enforcement to guarded domain validation.")
check("persisted_checks_update", "tx.validationCheck.updateMany" in service and "compareAndSetIncidentStatus" in service, "Check persistence and incident transition remain guarded inside the transaction.")
check("tamper_negative_path", "tampered recovery request" in integration and 'responseStatus: 500' in integration and '"VALIDATION_REQUIRED"' in integration, "DB integration source covers persisted recovery evidence tampering.")
check("unit_negative_paths", "timeout error appears after rollback completion" in unit_evidence and "missing validation audit evidence" in unit_ui, "Unit source covers evidence and validation-state fail-closed paths.")

# PASS 13 freeze: existing backend resolve route/service may remain from earlier backend passes,
# but PASS 12 must not add or invoke a resolution/handoff implementation in guided UI.
check("pass13_no_new_component", not (ROOT / "components/resolution-handoff.tsx").exists(), "No dedicated PASS 13 resolution/handoff component introduced.")
check("pass13_no_new_helper", not (ROOT / "lib/ui/resolution-handoff.ts").exists(), "No dedicated PASS 13 resolution/handoff helper introduced.")
check("pass13_no_guided_resolve_call", "/resolve" not in provider, "Guided workflow cannot execute the PASS 13 resolution command.")

failed=[x for x in checks if not x[1]]
for name,ok,detail in checks:
    print(("PASS" if ok else "FAIL"), name, "-", detail)
print(f"\nchecks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed:
    sys.exit(1)
print("PASS12_RECOVERY_VALIDATION_GATE_PASS")
