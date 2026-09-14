# PASS 8 — Release Comparison + Root-Cause Evidence

Status: **IMPLEMENTED**

PASS 8 strengthens the Step 2 investigation experience without starting PASS 9. The release section now separates **observable correlation signals** from the **persisted root-cause decision**, so the interface does not pre-confirm the answer before investigation.

## What changed

### Dedicated release comparison

`components/release-comparison.tsx` now presents the release evidence as facts rather than a conclusion:

- previous known-stable release `v2.7.4`
- current release `v2.8.0` active during the incident
- downstream timeout change `5000 ms → 800 ms`
- synthetic error-rate change `1.2% → 14.8%`
- deployment-to-incident timing signal
- observed downstream latency `1437 ms`
- explicit investigation question: whether the evidence supports a release-level regression

The component deliberately does **not** contain the `RELEASE_TIMEOUT_REGRESSION` answer.

### Root-cause checkpoint with progressive disclosure

`components/root-cause-evidence.tsx` has two states:

1. **HYPOTHESIS OPEN** while the incident is being investigated and no qualifying root-cause code has been persisted.
2. **CONFIRMED** only when the backend has persisted the exact `RELEASE_TIMEOUT_REGRESSION` code.

The disclosure helper is fail-closed:

- `OPEN + no code` → `LOCKED`
- `INVESTIGATING + no code` → `HYPOTHESIS`
- `REGRESSION_CONFIRMED + no code` → still `HYPOTHESIS`
- `REGRESSION_CONFIRMED + INSUFFICIENT_EVIDENCE` → still `HYPOTHESIS`
- qualifying persisted regression code → `CONFIRMED`

This prevents the UI from treating status alone, or any arbitrary root-cause value, as proof.

### Persisted explanation, not client-side inference

The guided incident view now reads `technicalSummary` from the existing incident endpoint. The confirmed panel displays:

- persisted `rootCauseCode`
- persisted server/domain explanation

The browser still does **not** call `assessRootCause()` or duplicate the domain evidence engine.

### Neutral Step 2 action

PASS 7 used the user-facing label:

`CONFIRM RELEASE REGRESSION`

That wording pre-committed to the expected outcome. PASS 8 changes it to:

`EVALUATE RELEASE EVIDENCE`

The underlying guarded endpoint is unchanged. The server can confirm or reject based on persisted evidence; the CTA itself no longer tells the reviewer what the answer must be.

After Step 2, the guided scroll now lands on `#root-cause-evidence` so the reviewer sees the persisted confirmation before proceeding to remediation.

## Correlation versus causation contract

Before confirmation the UI may show:

- the incident followed deployment
- the timeout changed
- observed latency exceeds the new timeout
- the previous timeout was above that latency

But it explicitly states that these are **correlation signals**, not a root-cause conclusion. The existing diagnostics remain available for review during Step 2.

Only the server-side guarded workflow can persist the root-cause result.

## PASS 9 scope freeze

PASS 8 deliberately does **not** add dedicated PASS 9 correlation implementation such as:

- `components/log-correlation.tsx`
- `components/request-correlation.tsx`
- `components/data-correlation.tsx`
- `lib/ui/diagnostic-correlation.ts`

The diagnostic panels inherited from PASS 6 remain unchanged as the existing shell. PASS 9 is still responsible for deeper logs/request/data correlation UX.

No new API route, domain root-cause implementation, validation derivation or generic status mutation was added in PASS 8.

## Verification executed

### PASS 8 source/scope gate

`PASS_8_GATE_OUTPUT.txt`

Result:

`PASS8_RELEASE_EVIDENCE_GATE_PASS`

- 33 checks
- 33 passed
- 0 failed

### Release-evidence disclosure smoke

`PASS_8_EVIDENCE_SMOKE_OUTPUT.txt`

Result:

`PASS8_RELEASE_EVIDENCE_SMOKE_PASS`

- 7 checks
- 7 passed
- 0 failed

The smoke verifies fail-closed disclosure and canonical deployment-to-incident duration logic.

### Selected PASS 8 UI TypeScript compile

`PASS_8_UI_TS_COMPILE_OUTPUT.txt`

Result:

`PASS8_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS`

Temporary ambient shims are used only because project dependencies are not installed in the current execution environment.

### Scope diff

`PASS_8_SCOPE_DIFF.txt`

The diff is limited to the PASS 8 UI/presentation layer, guided Step 2 wording/scroll target, unit-test source, package script and PASS 8 verification artifacts. Backend/domain service files were not modified.

## Runtime boundary

PASS 8 is source-implemented and its isolated evidence/disclosure logic is executable, but the previously tracked final runtime gates remain open:

- real `npm ci`
- full Vitest/component suite
- full ESLint/typecheck
- Prisma generation/migration
- real PostgreSQL integration suite
- Next.js production build
- browser/mobile visual QA
- dependency audit

These remain release blockers before repository publication or application submission.

## Next formal phase

**PASS 9 — Logs, Request & Data Correlation** is next and has **not** been implemented in this artifact.
