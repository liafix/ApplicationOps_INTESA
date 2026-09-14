# PASS 12 — Recovery Validation Gate

## Verdict

**IMPLEMENTED — PASS 13 NOT STARTED**

PASS 12 activates the explicit recovery-validation stage after the persisted controlled rollback. The reviewer can now run the four canonical recovery checks through the existing guarded backend. The workflow stops at `VALIDATED`; no guided resolution action is executed in this pass.

## Functional change

Step 4 now performs:

```text
READY_FOR_VALIDATION
  → POST /api/incidents/APP-2047/validation/run
  → derive checks from persisted recovery evidence
  → validateRecovery()
  → persist 4/4 PASS
  → VALIDATED
  → VALIDATION_STARTED + VALIDATION_PASSED
  → STOP
```

The fixed controller exposes `RUN RECOVERY VALIDATION` when rollback evidence is persisted. After success it displays `VALIDATION COMPLETE` and is disabled. The guided provider contains no `/resolve` call.

## Canonical 4/4 evidence contract

The validation result is not supplied by the browser. `runIncidentValidation()` now delegates evidence derivation to `lib/evidence/recovery-validation.ts`, which re-reads persisted application, release, request, transaction, log and audit state.

### 1. Previous stable release restored

Requires all of the following:

- incident `recoveredRelease = 2.7.4`;
- application active release = `2.7.4`;
- service health = `HEALTHY`;
- release `2.7.4 = STABLE`;
- affected release `2.8.0 = ROLLED_BACK`;
- persisted `ROLLBACK_COMPLETED` boundary exists.

### 2. Error rate below threshold

Requires:

```text
persisted synthetic error rate < 5%
```

The threshold is strict; equality does not pass.

### 3. Synthetic transaction succeeded

Requires the exact persisted recovery pair:

```text
req_tx_recovery
  → HTTP 200
  → release 2.7.4
  → failureCode = null

TX-90843
  → requestId = req_tx_recovery
  → SUCCEEDED
  → applicationVersion 2.7.4
  → failureCode = null
```

Both records must be at or after the persisted rollback-completion boundary.

### 4. No new timeout errors

Requires zero post-rollback diagnostic records matching:

```text
level = ERROR
message contains UPSTREAM_TIMEOUT
timestamp > ROLLBACK_COMPLETED
```

## Atomic persistence

Validation remains one Prisma transaction:

1. load persisted evidence context;
2. derive the four evidence booleans;
3. map them to the canonical validation checks;
4. run guarded `validateRecovery()`;
5. append `VALIDATION_STARTED`;
6. persist each canonical check with compare/invariant semantics;
7. compare-and-set incident `READY_FOR_VALIDATION → VALIDATED`;
8. append `VALIDATION_PASSED` with the four evidence outcomes;
9. commit.

If the evidence does not support 4/4, the guarded domain command throws before a successful validation state can be manufactured.

## UI behavior

New component:

- `components/recovery-validation.tsx`

New fail-closed UI helper:

- `lib/ui/recovery-validation.ts`

New shared evidence helper:

- `lib/evidence/recovery-validation.ts`

The validation UI deliberately shows two separate concepts:

- **Evidence readiness** — observations from persisted post-rollback state;
- **Persisted validation** — the authoritative stored `PENDING`/`PASS` state.

A reviewer may therefore see `4 / 4` evidence conditions ready while persisted validation remains `0 / 4` until the explicit server command runs. This prevents the browser from visually manufacturing validation success.

Validation view modes:

```text
LOCKED
READY
BLOCKED
VALIDATED
INCONSISTENT
```

`VALIDATED` is shown only when:

- exact canonical validation schema is intact;
- all four required persisted checks are `PASS`;
- persisted recovery evidence still supports 4/4;
- `VALIDATION_STARTED` exists;
- `VALIDATION_PASSED` exists;
- incident status is `VALIDATED` or later.

Missing checks, duplicate/malformed check schema, missing audit events or inconsistent evidence fail closed.

## Negative-path hardening

Added unit source for:

- exact recovery request/transaction requirement;
- strict error-rate threshold;
- broken restored-release invariant;
- post-rollback timeout recurrence;
- missing rollback audit boundary;
- missing canonical validation check;
- validated state without validation audit evidence.

The PostgreSQL integration-test source now also includes a post-rollback tamper case:

```text
recovery request HTTP 200 → tampered to HTTP 500
  → run validation
  → VALIDATION_REQUIRED
  → incident remains READY_FOR_VALIDATION
  → canonical checks remain PENDING
  → no VALIDATION_STARTED / VALIDATION_PASSED audit written
```

## PASS 13 freeze

PASS 12 does **not** execute incident resolution.

Verified boundaries:

- guided provider contains no `/resolve` call;
- `VALIDATED` disables the fixed primary action;
- no dedicated `resolution-handoff.tsx` component was created;
- no dedicated PASS 13 UI helper was created;
- existing backend resolution service/route from earlier backend passes remains untouched and is not invoked by PASS 12.

The existing resolution shell may remain in the page structure, but the workflow explicitly stops after validation and does not perform closure or business-handoff implementation.

## Verification executed

### PASS 12 source/scope gate

```text
checks=40
passed=40
failed=0
PASS12_RECOVERY_VALIDATION_GATE_PASS
```

### Executable pure TypeScript validation smoke

```text
PASS 4/4 recovery evidence conditions derive from persisted state
PASS READY_FOR_VALIDATION + complete evidence + pending checks exposes READY gate
PASS evidence readiness does not manufacture persisted PASS statuses
PASS VALIDATED requires 4/4 persisted PASS plus validation audit evidence
PASS persisted validation gate reports 4/4 PASS
PASS tampered recovery request blocks validation readiness
PASS new timeout ERROR after rollback blocks validation readiness
PASS validated state without validation audits fails closed
PASS12_RECOVERY_VALIDATION_SMOKE_PASS
```

### TypeScript checks

```text
PASS12_RECOVERY_VALIDATION_TYPESCRIPT_COMPILE_PASS
PASS12_SERVICE_TYPESCRIPT_SHIM_COMPILE_PASS
PASS12_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS
PASS12_UNIT_TEST_SOURCE_TYPESCRIPT_SHIM_COMPILE_PASS
```

Temporary shims were used only because external npm packages are unavailable in the current execution environment. They do not replace the final dependency-backed release gate.

### Previous backend regression harness

```text
PASS4_RELATIONAL_BACKEND_GATE_PASS
tests=7 passed=7 failed=0
```

### Secret pattern scan

```text
PASS12_SECRET_PATTERN_SCAN_PASS
```

## Runtime boundary still open

This pass does **not** claim successful execution of:

- `npm ci`;
- real Vitest suite with installed project dependencies;
- Prisma generation/validation with installed package;
- Prisma migration against PostgreSQL;
- the real PostgreSQL integration suite;
- full ESLint/typecheck;
- Next.js production build;
- browser/mobile visual QA;
- dependency audit.

Those remain final release blockers before public repository/deployment/application use.

## Next phase

**PASS 13 — Resolution & Business Handoff**

That phase should perform the separate `VALIDATED → RESOLVED` action, create the recruiter-friendly technical/business handoff, and keep the final closure audit explicit.
