# ApplicationOps PASS 10 — Remediation Decision Report

## Verdict

**PASS 10 IMPLEMENTED — PASS 11 NOT STARTED**

PASS 10 converts the static remediation shell into an interactive, evidence-led decision step. It deliberately stops after persisting the remediation choice and does not execute rollback or render recovery results.

## Reviewer flow

After `RELEASE_TIMEOUT_REGRESSION` is persisted and the incident reaches `REGRESSION_CONFIRMED`, the reviewer sees four neutral response options:

1. `RETRY_FAILED_TRANSACTIONS`
2. `CHANGE_PRODUCTION_DATA`
3. `ROLLBACK_RELEASE`
4. `ESCALATE_WITHOUT_ACTION`

Nothing is selected on entry. Selecting a card only opens its decision review: risk, evidence fit, review question, and rationale. This makes the reviewer compare options before committing to a recovery path.

For the deterministic evidence set, only `ROLLBACK_RELEASE` is executable as the successful remediation decision. The other options remain inspectable but the record action stays disabled.

## Fail-closed decision modes

The new pure UI helper exposes three states:

- `LOCKED` — root cause is not yet persistently confirmed;
- `READY` — incident is `REGRESSION_CONFIRMED`, root cause is `RELEASE_TIMEOUT_REGRESSION`, and no remediation has been persisted;
- `RECORDED` — incident is `REMEDIATION_SELECTED` and persisted remediation is `ROLLBACK_RELEASE`.

The UI therefore does not infer readiness only from a visual step number.

## Guarded persistence

`submitRemediationDecision(action)` posts to the existing endpoint:

`POST /api/incidents/APP-2047/remediation`

The server/domain `chooseRemediation()` / `selectRemediation()` path remains authoritative. PASS 10 adds no generic status mutation and no browser-side root-cause engine.

## PASS 11 boundary

The PASS 7 controller previously combined remediation selection and rollback execution in Step 3. PASS 10 intentionally separates those responsibilities:

- Step 3 primary controller now navigates to the remediation decision surface;
- the dedicated decision component persists only the decision;
- after `REMEDIATION_SELECTED`, the fixed controller displays `DECISION RECORDED` and is held;
- the UI does **not** call `/rollback`;
- no rollback/recovery component, recovery animation, or post-rollback metric state was introduced.

The existing backend rollback route/service from earlier backend passes remains in the repository, but PASS 10 does not execute or extend it.

## New artifacts

- `components/remediation-decision.tsx`
- `lib/ui/remediation-decision.ts`
- `tests/unit/remediation-decision.test.ts`
- `scripts/pass10_remediation_decision_gate.py`
- `scripts/pass10_remediation_decision_smoke.ts`

Updated:

- `app/page.tsx`
- `components/guided-workflow-provider.tsx`
- `components/guided-controller.tsx`
- `lib/ui/guided-workflow.ts`
- `tests/unit/guided-workflow.test.ts`
- `package.json`
- `README.md`

## Verification executed

### PASS 10 static/source gate

`43/43 PASS`

Final marker:

`PASS10_REMEDIATION_DECISION_GATE_PASS`

The gate verifies four reviewable options, no initial preselection, persisted-root-cause gating, guarded decision persistence, no generic status mutation, and no PASS 11 recovery UI.

### Pure TypeScript decision smoke

The remediation helper compiled successfully and the executable smoke verified:

- four options;
- `LOCKED` before root-cause confirmation;
- `READY` after persisted release regression;
- rollback risk remains `MEDIUM`;
- rollback has strongest evidence fit;
- production-data change has no supporting evidence;
- only rollback can be recorded for this evidence set;
- persisted rollback selection produces `RECORDED`.

Final marker:

`PASS10_REMEDIATION_DECISION_SMOKE_PASS`

### Selected UI TypeScript shim compile

New decision UI + provider/controller integration compiled under strict TypeScript using temporary React type shims because project dependencies are not installed in this execution environment.

Final marker:

`PASS10_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS`

### Secret scan

`PASS10_SECRET_PATTERN_SCAN_PASS`

## Runtime boundary

This pass does not claim a full production runtime gate. The previously documented release blockers remain outside PASS 10 scope: real `npm ci`, full Vitest/ESLint/typecheck, Prisma generation/migration, real PostgreSQL integration, Next production build, browser/mobile QA, and dependency audit.
