from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/page.tsx").read_text()
release = (ROOT / "components/release-comparison.tsx").read_text()
root_cause = (ROOT / "components/root-cause-evidence.tsx").read_text()
provider = (ROOT / "components/guided-workflow-provider.tsx").read_text()
disclosure = (ROOT / "lib/ui/release-evidence.ts").read_text()
guided = (ROOT / "lib/ui/guided-workflow.ts").read_text()
service = (ROOT / "lib/services/applicationops-service.ts").read_text()

checks = []
def check(name, ok, detail):
    checks.append((name, bool(ok), detail))

# PASS 8 surface
check("release_component_exists", (ROOT / "components/release-comparison.tsx").exists(), "Dedicated release comparison component exists.")
check("root_cause_component_exists", (ROOT / "components/root-cause-evidence.tsx").exists(), "Dedicated root-cause evidence component exists.")
check("release_component_rendered", "<ReleaseComparison />" in page, "PASS 8 release comparison is rendered in the release-evidence section.")
check("root_cause_component_rendered", "<RootCauseEvidence />" in page, "Root-cause checkpoint is rendered after release comparison.")
check("release_stage_progressive", '<ProgressiveGate requiredStep={2}>' in page, "Release/root-cause evidence remains hidden until investigation starts.")

# Observable evidence, not premature conclusion
for marker in ["Previous release", "Current release", "Configuration delta", "Timing signal", "Runtime signal", "Question to answer"]:
    check(f"release_marker::{marker}", marker in release, f"Release comparison exposes {marker} as an observable signal.")
check("no_hardcoded_root_cause_in_release", "RELEASE_TIMEOUT_REGRESSION" not in release, "Release comparison does not hard-code the root-cause answer.")
check("no_confirmed_wording_in_release", "confirmed root cause" not in release.lower(), "Release comparison does not declare causation before confirmation.")
check("neutral_step2_action", "EVALUATE RELEASE EVIDENCE" in guided and "CONFIRM RELEASE REGRESSION" not in guided, "Step 2 asks the reviewer to evaluate evidence rather than pre-committing to a regression outcome.")
check("hypothesis_copy", "correlation is not yet a conclusion" in root_cause, "Pre-confirmation copy explicitly distinguishes correlation from conclusion.")
check("browser_not_root_cause_engine", "assessRootCause" not in root_cause and "assessRootCause" not in provider, "Browser does not reimplement the domain root-cause engine.")

# Fail-closed disclosure contract
check("disclosure_open_locked", 'if (!investigationStatuses.includes(status)) return "LOCKED"' in disclosure, "OPEN state keeps PASS 8 evidence locked.")
check("disclosure_requires_specific_persisted_code", 'persistedRootCauseCode !== "RELEASE_TIMEOUT_REGRESSION"' in disclosure, "Confirmation requires the specific persisted regression code, not status or any arbitrary code.")
check("confirmed_only_after_code", 'return "CONFIRMED"' in disclosure, "Confirmed presentation has an explicit persisted-code gate.")
check("provider_reads_technical_summary", "technicalSummary: string | null" in provider, "UI can display the server-persisted explanation without recomputing it.")
check("root_cause_uses_persisted_code", "incident?.rootCauseCode" in root_cause, "Root-cause component reads persisted rootCauseCode.")
check("root_cause_uses_persisted_summary", "incident?.technicalSummary" in root_cause, "Root-cause component reads persisted technicalSummary.")
check("confirmed_panel_is_dynamic", 'confirmed ? "Root-cause decision · persisted"' in root_cause, "Confirmed styling/copy is conditional on persisted evidence state.")

# Guided sequence after confirmation
check("step2_scrolls_to_confirmation", 'case 2:\n      return "root-cause-evidence";' in guided, "After Step 2 the reviewer sees the server-confirmed result before recovery.")
check("root_cause_anchor", 'id="root-cause-evidence"' in root_cause, "The confirmation checkpoint has a deterministic scroll target.")

# Domain/API boundary unchanged
check("server_domain_still_assesses", "assessRootCause(evidence)" in service, "Root-cause assessment remains in the server/domain service.")
check("server_persists_root_cause", "rootCauseCode: assessment.code" in service, "Server persists the root-cause code before UI reveals confirmation.")
check("server_persists_summary", "technicalSummary: assessment.explanation" in service, "Server persists the root-cause explanation before UI reveals it.")
check("no_generic_patch", 'method: "PATCH"' not in provider, "PASS 8 does not add a generic status mutation.")

# PASS 9 freeze — existing PASS 6 diagnostic shell may remain, but PASS 8 must not add the dedicated correlation implementation.
for path in [
    "components/log-correlation.tsx",
    "components/request-correlation.tsx",
    "components/data-correlation.tsx",
    "lib/ui/diagnostic-correlation.ts",
]:
    check(f"no_pass9::{path}", not (ROOT / path).exists(), f"PASS 9 artifact {path} was not introduced.")

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL"), name, "-", detail)
print(f"\nchecks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed:
    sys.exit(1)
print("PASS8_RELEASE_EVIDENCE_GATE_PASS")
