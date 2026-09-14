from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/page.tsx").read_text()
workflow = (ROOT / "components/workflow-preview.tsx").read_text()
globals_css = (ROOT / "app/globals.css").read_text()
components_text = "\n".join(p.read_text() for p in (ROOT / "components").glob("*.tsx"))
ui_text = page + "\n" + components_text

checks = []

def check(name: str, ok: bool, detail: str):
    checks.append((name, ok, detail))

# Clarity / hierarchy contract
check("single_primary_hero_path", "See release evidence" not in page and "Start with the incident" in page,
      "Hero exposes one dominant start path and does not encourage skipping directly to release evidence.")
check("no_competing_start_here_label", "Start here · workflow preview" not in page and "Guided path · workflow preview" in page,
      "Workflow preview explains the path without competing with the primary CTA.")
check("initial_state_does_not_preselect_remediation", "Recommended" not in page and "Reversible option" in page,
      "Rollback is visible but not pre-selected before PASS 7 interaction.")
check("root_cause_not_preconfirmed_in_heading", "The strongest signal is a configuration regression introduced by the new release." not in page and "not yet a confirmed root cause" in page,
      "Release evidence is framed as a correlation signal until diagnostics support confirmation.")
check("metrics_follow_incident_context", page.index('id="incident"') < page.index('aria-label="Initial application metrics"'),
      "Operational metrics no longer delay the first incident workspace.")
check("mobile_metrics_compact", 'grid grid-cols-2 gap-3 lg:grid-cols-4' in page,
      "Metrics use two columns on narrow screens instead of four stacked cards.")
check("mobile_workflow_horizontal", "overflow-x-auto" in workflow and 'min-w-[220px]' in workflow,
      "Five workflow cards use a horizontal strip on small screens rather than a long vertical stack.")
check("current_step_semantics", 'aria-current={index === 0 ? "step" : undefined}' in workflow,
      "The first workflow stage is exposed semantically as the current step.")

# Accessibility / interaction readiness
check("nav_focus_visible", page.count("focus:ring-2 focus:ring-sky-300 focus:ring-inset") >= 7,
      "Every sticky navigation anchor has explicit keyboard focus styling.")
check("low_contrast_tokens_removed", "text-slate-500" not in ui_text and "text-slate-600" not in ui_text,
      "Small UI copy avoids the low-contrast slate-500/600 tokens used in the original PASS 6.")
check("reduced_motion_fallback", "prefers-reduced-motion: reduce" in globals_css and "scroll-behavior: auto" in globals_css,
      "Smooth scrolling is disabled when the user requests reduced motion.")

# Scope freeze: PASS 7 must remain untouched.
forbidden = ["useState", "onClick", "fetch(", '"use client"', "START INVESTIGATION", "RUN VALIDATION", "RESOLVE INCIDENT"]
for token in forbidden:
    check(f"pass7_scope_freeze::{token}", token not in page and token not in components_text,
          f"Forbidden PASS 7 marker {token!r} is absent from the UI source.")

required_sections = ["incident", "release-evidence", "diagnostics", "remediation", "validation", "resolution", "audit"]
for section in required_sections:
    check(f"required_section::{section}", f'id="{section}"' in page, f"Required section #{section} remains present.")

failed = [c for c in checks if not c[1]]
for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL"), name, "-", detail)
print(f"\nchecks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed:
    sys.exit(1)
print("PASS6_UI_AUDIT_HARDENED_GATE_PASS")
