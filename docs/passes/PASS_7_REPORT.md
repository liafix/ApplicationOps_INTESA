# PASS 7 — Guided Interaction Workflow

Status: **IMPLEMENTED**

PASS 7 adds the recruiter-facing guided interaction layer on top of the audit-hardened PASS 5/6 presentation shell. It deliberately does **not** add PASS 8 release-evidence enhancements or new root-cause visualization logic.

## Implemented interaction contract

The persisted incident status drives one deterministic five-step walkthrough:

1. `OPEN` → **START INVESTIGATION**
2. `INVESTIGATING` → **CONFIRM RELEASE REGRESSION**
3. `REGRESSION_CONFIRMED` / `REMEDIATION_SELECTED` → **ROLL BACK RELEASE**
4. `READY_FOR_VALIDATION` → **RUN VALIDATION**
5. `VALIDATED` → **RESOLVE INCIDENT**
6. `RESOLVED` → walkthrough complete / **RESET DEMO**

The UI does not accept or send an arbitrary incident status. It calls the guarded PASS 3 endpoints that already enforce domain state transitions and atomic persistence/audit rules.

## Progressive disclosure

Future workflow sections are withheld until their prerequisite stage is reached:

- Step 1: incident context + current audit only
- Step 2: release evidence + diagnostics unlock
- Step 3: remediation unlocks only after regression confirmation
- Step 4: validation unlocks only after rollback completion
- Step 5: resolution gate unlocks only after validation passes

The sticky navigation is filtered to the currently unlocked sections, and the workflow preview marks current versus completed stages.

## Persistent-state feedback

After every successful guided action, the client reloads:

- incident status / application state
- validation checks
- audit trail

The incident pill, active release, service-health/error-rate values, validation count/check status, resolution gate and audit timeline therefore reflect persisted backend state instead of being client-authored status mutations.

If the combined Step 3 sequence selects rollback successfully but a later rollback request fails, the provider performs a best-effort refresh so the UI can resume from persisted `REMEDIATION_SELECTED` rather than retrying the selection blindly.

## Accessibility / UX

- fixed bottom controller keeps exactly one primary next action visible
- current step is exposed through `aria-current="step"`
- action/error/loading feedback uses an `aria-live="polite"` region
- disabled action state prevents double submits while a request is in flight
- guided scrolling respects `prefers-reduced-motion`
- fixed controller is offset by page bottom padding so it does not cover the final content

## Scope freeze — PASS 8 not started

PASS 7 does not introduce:

- a new release-comparison component
- a new root-cause evidence component
- client-side root-cause calculation
- client-side validation derivation
- new API routes or generic status mutation
- PASS 8-specific release/evidence expansion

The release/diagnostics content remains the existing PASS 6 evidence shell; PASS 7 only controls when it becomes visible and how the guarded workflow advances.

## Verification executed

### PASS 7 static/source gate

`PASS_7_GATE_OUTPUT.txt`

Result:

`PASS7_GUIDED_INTERACTION_GATE_PASS`

- 33 checks
- 33 passed
- 0 failed

### Pure guided-state smoke

`PASS_7_WORKFLOW_SMOKE_OUTPUT.txt`

Result:

`PASS7_GUIDED_WORKFLOW_SMOKE_PASS`

Verified eight persisted incident states, progressive section locking and all five post-action scroll targets.

### Selected UI TypeScript compile

`PASS_7_UI_TS_COMPILE_OUTPUT.txt`

Result:

`PASS7_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS`

This uses temporary local type shims only because dependencies are still unavailable in this execution environment.

## Remaining runtime boundary

PASS 7 source is implemented, but this environment still cannot truthfully claim a full Next.js browser/runtime gate because project dependencies are not installed from `registry.npmjs.org`. The previously tracked real Prisma/PostgreSQL runtime gate also remains open.

Before final publication/application, the release gate still requires real:

- `npm ci`
- Prisma generate/validate/migrate
- real PostgreSQL integration tests
- unit/component tests
- ESLint + TypeScript
- production Next.js build
- browser/mobile walkthrough QA
- dependency audit

## Next formal phase

**PASS 8 — Release Comparison & Root-Cause Evidence** is next and remains unimplemented in this artifact.
