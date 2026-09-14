from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/page.tsx").read_text()
component = (ROOT / "components/diagnostic-correlation.tsx").read_text()
provider = (ROOT / "components/guided-workflow-provider.tsx").read_text()
correlation = (ROOT / "lib/ui/diagnostic-correlation.ts").read_text()
unit = (ROOT / "tests/unit/diagnostic-correlation.test.ts").read_text()
service = (ROOT / "lib/services/applicationops-service.ts").read_text()

checks = []
def check(name, ok, detail):
    checks.append((name, bool(ok), detail))

# PASS 9 artifacts and rendering
check("correlation_component_exists", (ROOT / "components/diagnostic-correlation.tsx").exists(), "Dedicated PASS 9 correlation component exists.")
check("correlation_helper_exists", (ROOT / "lib/ui/diagnostic-correlation.ts").exists(), "Pure diagnostic-correlation helper exists.")
check("unit_test_exists", (ROOT / "tests/unit/diagnostic-correlation.test.ts").exists(), "PASS 9 unit-test source exists.")
check("component_rendered", "<DiagnosticCorrelation />" in page, "Diagnostics section renders the dedicated persisted-evidence component.")
check("static_seed_logs_removed", "buildSyntheticScenarioSeed" not in page and "initialLogs" not in page, "Page no longer renders diagnostic logs from a static seed snapshot.")

# Persisted evidence hydration
for endpoint in ["/logs", "/requests", "/transactions"]:
    check(f"provider_fetch::{endpoint}", endpoint in provider, f"Guided provider hydrates persisted {endpoint} evidence.")
for state in ["logs", "requests", "transactions"]:
    check(f"provider_state::{state}", f"{state}: Guided" in provider or f"set{state.capitalize()}" in provider, f"Provider exposes {state} evidence to PASS 9 UI.")

# Canonical linkage
for marker in ["SCENARIO.requestId", "SCENARIO.transactionId", "SCENARIO.currentRelease.version"]:
    check(f"component_key::{marker}", marker in component, f"Component renders canonical correlation key {marker}.")
for marker in ["requestId === expected.requestId", "item.id === expected.transactionId", "request.releaseVersion === expected.releaseVersion", "transaction.applicationVersion === expected.releaseVersion"]:
    check(f"helper_link::{marker[:24]}", marker in correlation, f"Correlation helper validates {marker}.")
check("request_logs_filtered", "log.requestId === expected.requestId" in correlation, "Only logs with the canonical request ID enter the request trail.")
check("timeout_log_guard", "expected.failureCode" in correlation and "expected.httpStatus" in correlation, "Timeout evidence must agree on failure code and HTTP status.")
check("latency_log_guard", "expected.observedLatencyMs" in correlation, "Latency warning is tied to the canonical observed latency.")
check("complete_partial_mismatch", all(x in correlation for x in ['"COMPLETE"', '"PARTIAL"', '"MISMATCH"']), "Correlation result fails closed with COMPLETE/PARTIAL/MISMATCH states.")
check("five_trail_nodes", all(x in correlation for x in ['"DEPLOYMENT"', '"REQUEST"', '"LATENCY"', '"TIMEOUT"', '"TRANSACTION"']), "Single evidence trail covers the five intended checkpoints.")

# UX / reasoning boundary
check("correlation_not_causation_copy", "correlation alone does not independently establish causation" in component, "PASS 9 explicitly preserves correlation-versus-causation boundary.")
check("persisted_copy", "Persisted evidence in sequence" in component, "Timeline is described as persisted evidence.")
check("read_only_lookup_label", "Read-only diagnostic lookup · illustrative" in component, "Data inspector does not imply arbitrary production SQL execution.")
check("no_client_root_cause_engine", "assessRootCause" not in component and "assessRootCause" not in correlation, "PASS 9 does not move root-cause logic into the browser.")
check("server_root_cause_unchanged", "assessRootCause(evidence)" in service, "Root-cause assessment remains server/domain responsibility.")
check("no_pass9_mutation", 'method: "POST"' not in component and "fetch(" not in component, "PASS 9 component is read-only and adds no mutation path.")

# Test coverage source
for phrase in ["COMPLETE", "MISMATCH", "PARTIAL", "req_tx_recovery"]:
    check(f"unit::{phrase}", phrase in unit, f"Unit source covers {phrase} diagnostic behavior.")

# PASS 10 freeze — inherited remediation shell may remain, but no dedicated PASS 10 decision implementation.
for path in [
    "components/remediation-decision.tsx",
    "lib/ui/remediation-decision.ts",
    "tests/unit/remediation-decision.test.ts",
]:
    check(f"no_pass10::{path}", not (ROOT / path).exists(), f"PASS 10 artifact {path} was not introduced.")

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL"), name, "-", detail)
print(f"\nchecks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed:
    sys.exit(1)
print("PASS9_DIAGNOSTIC_CORRELATION_GATE_PASS")
