from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/page.tsx").read_text()
provider = (ROOT / "components/guided-workflow-provider.tsx").read_text()
controller = (ROOT / "components/guided-controller.tsx").read_text()
preview = (ROOT / "components/workflow-preview.tsx").read_text()
nav = (ROOT / "components/guided-nav.tsx").read_text()
status = (ROOT / "components/guided-status.tsx").read_text()
gates = (ROOT / "components/progressive-gate.tsx").read_text()
guided = (ROOT / "lib/ui/guided-workflow.ts").read_text()

checks = []
def check(name, ok, detail):
    checks.append((name, bool(ok), detail))

# Guided controller contract
for label in [
    "START INVESTIGATION",
    "CONFIRM RELEASE REGRESSION",
    "ROLL BACK RELEASE",
    "RUN VALIDATION",
    "RESOLVE INCIDENT",
]:
    check(f"controller_action::{label}", label in guided, f"Guided state definition contains {label}.")
check("reset_action", "RESET DEMO" in controller, "Completed walkthrough exposes deterministic reset.")
check("fixed_controller", "fixed inset-x-0 bottom-0" in controller, "Primary next action remains visible at the bottom of the viewport.")
check("aria_live_feedback", 'aria-live="polite"' in controller, "Controller announces loading/error feedback.")

# Backend wiring
required_paths = [
    "/investigate",
    "/confirm-regression",
    "/remediation",
    "/rollback",
    "/validation/run",
    "/resolve",
    "/api/demo/reset",
]
for path in required_paths:
    check(f"api_wiring::{path}", path in provider, f"Provider wires the existing guarded API path {path}.")
check("rollback_action_is_guarded", 'action: "ROLLBACK_RELEASE"' in provider, "Recovery action uses the guarded rollback remediation enum.")
check("no_generic_status_patch", 'method: "PATCH"' not in provider and "/status" not in provider, "UI does not introduce a generic status mutation endpoint.")
check("refresh_from_persisted_state", "/validation`" in provider and "/audit`" in provider and "setIncident" in provider, "UI refreshes incident, validation and audit from persisted backend state.")

# Progressive disclosure
for step in [2, 3, 4, 5]:
    check(f"progressive_gate::{step}", f"<ProgressiveGate requiredStep={{{step}}}>" in page, f"Future-stage content is gated until guided step {step}.")
check("gate_logic", "currentStep >= requiredStep" in guided, "Unlock semantics are monotonic and deterministic.")
check("dynamic_navigation", "links.filter((link) => step >= link.step)" in nav, "Navigation exposes only currently unlocked sections.")
check("dynamic_preview", "isCurrent" in preview and "isComplete" in preview and 'aria-current={isCurrent ? "step" : undefined}' in preview, "Workflow preview reflects current and completed stages.")

# State feedback
check("dynamic_incident_status", "GuidedIncidentStatusPill" in page and "incident?.status" in status, "Persisted incident status replaces hard-coded OPEN feedback.")
check("dynamic_validation", "GuidedValidationChecks" in page and 'check.status === "PASS"' in status, "Validation UI reflects persisted checks.")
check("dynamic_audit", "GuidedAuditTrail" in page and "audit.map" in status, "Audit trail updates with persisted events after each action.")
check("dynamic_resolution_gate", "GuidedResolutionState" in page, "Resolution stage reflects validation/current incident state without adding final handoff content.")

# Scope freeze — no PASS 8 component/domain/API expansion.
check("no_pass8_release_component", not (ROOT / "components/release-comparison.tsx").exists(), "PASS 8 release-comparison component was not introduced.")
check("no_pass8_root_cause_component", not (ROOT / "components/root-cause-evidence.tsx").exists(), "PASS 8 root-cause evidence component was not introduced.")
check("no_domain_changes_marker", "assessRootCause" not in provider, "PASS 7 consumes existing guarded API instead of reimplementing root-cause logic client-side.")
check("no_client_validation_derivation", "stableReleaseRestored" not in provider and "noNewTimeoutErrors" not in provider, "PASS 7 does not duplicate server validation derivation in the browser.")

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL"), name, "-", detail)
print(f"\nchecks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed:
    sys.exit(1)
print("PASS7_GUIDED_INTERACTION_GATE_PASS")
