from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
provider = (ROOT / "components/guided-workflow-provider.tsx").read_text()
controller = (ROOT / "components/guided-controller.tsx").read_text()
page = (ROOT / "app/page.tsx").read_text()
component = (ROOT / "components/rollback-recovery.tsx").read_text()
helper = (ROOT / "lib/ui/rollback-recovery.ts").read_text()
service = (ROOT / "lib/services/applicationops-service.ts").read_text()
nav = (ROOT / "components/guided-nav.tsx").read_text()
validation = (ROOT / "tests/unit/rollback-recovery.test.ts").read_text()

checks=[]
def check(name, ok, detail): checks.append((name,bool(ok),detail))

for path in ["components/rollback-recovery.tsx","lib/ui/rollback-recovery.ts","tests/unit/rollback-recovery.test.ts"]:
    check(f"artifact::{path}",(ROOT/path).exists(),f"PASS 11 artifact {path} exists.")
check("page_renders_recovery","<RollbackRecovery />" in page and 'id="rollback-recovery"' in page,"Recovery section is rendered after remediation.")
check("nav_recovery",'#rollback-recovery' in nav,"Guided nav exposes Recovery when Step 3 is unlocked.")
check("provider_fetches_releases","/releases`" in provider and "setReleases" in provider,"Provider hydrates persisted release state.")
check("provider_executes_rollback","/rollback`" in provider and 'method: "POST"' in provider,"Step 3 can execute the existing guarded rollback endpoint after decision persistence.")
check("decision_required",'incident?.status !== "REMEDIATION_SELECTED"' in provider and 'incident.selectedRemediation !== "ROLLBACK_RELEASE"' in provider,"Rollback execution requires persisted supported decision.")
check("controller_explicit_action","EXECUTE CONTROLLED ROLLBACK" in controller,"Controller exposes explicit rollback execution after decision.")
check("controller_holds_after_rollback","ROLLBACK COMPLETE" in controller and "rollbackComplete" in controller,"Controller stops after rollback instead of auto-validating.")
check("validation_api_not_called","/validation/run`" not in provider,"PASS 11 UI does not execute PASS 12 validation.")
check("step4_hold_copy","PASS 11 stops after persisted rollback + recovery" in provider,"Provider documents PASS 12 scope freeze.")
check("before_after","Before rollback" in component and "After rollback" in component,"UI shows before/after service state.")
for marker in ["ROLLBACK_STARTED","ROLLBACK_COMPLETED","Recovery observed ≠ incident validated"]:
    check(f"evidence::{marker}",marker in component or marker in helper,f"Recovery UI/helper includes {marker} evidence/boundary.")
check("recovery_request_key", "SCENARIO.recoveryRequestId" in component and "SCENARIO.recoveryRequestId" in helper, "Recovery evidence is keyed by the canonical recovery request ID.")
check("recovery_transaction_key", "SCENARIO.recoveryTransactionId" in component and "SCENARIO.recoveryTransactionId" in helper, "Recovery evidence is keyed by the canonical recovery transaction ID.")
for mode in ['"LOCKED"','"READY"','"EXECUTING"','"RECOVERED"','"INCONSISTENT"']:
    check(f"mode::{mode}",mode in helper,f"Rollback helper includes fail-closed {mode} mode.")
for marker in ["affectedReleaseRolledBack","previousReleaseActive","serviceHealthy","errorRateRecovered","recoveryRequestSucceeded","recoveryTransactionSucceeded","recoveryLogPresent"]:
    check(f"persisted::{marker}",marker in helper,f"Recovery result requires {marker}.")
check("atomic_backend_preserved","prisma.$transaction" in service and '"ROLLBACK_STARTED"' in service and '"ROLLBACK_COMPLETED"' in service,"Existing rollback remains one guarded DB transaction with audit events.")
check("backend_domain_guards","beginRollback" in service and "finishRollback" in service,"Backend still delegates to guarded domain rollback commands.")
check("no_generic_patch",'method: "PATCH"' not in provider,"No generic status mutation was introduced.")
check("pass12_no_component",not (ROOT/"components/recovery-validation.tsx").exists(),"No dedicated PASS 12 validation component introduced.")
check("pass12_no_helper",not (ROOT/"lib/ui/recovery-validation.ts").exists(),"No dedicated PASS 12 validation helper introduced.")
check("unit_fail_closed","INCONSISTENT" in validation and "READY_FOR_VALIDATION" in validation,"Unit source covers fail-closed recovery and recovery-vs-validation boundary.")

failed=[x for x in checks if not x[1]]
for name,ok,detail in checks:
    print(("PASS" if ok else "FAIL"),name,"-",detail)
print(f"\nchecks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed: sys.exit(1)
print("PASS11_ROLLBACK_RECOVERY_GATE_PASS")
