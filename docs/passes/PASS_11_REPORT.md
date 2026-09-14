# ApplicationOps — PASS 11 Rollback + Recovery Report

## Verdict

**PASS 11 IMPLEMENTED — READY FOR PASS 12, subject to the existing final runtime/CI blocker.**

PASS 11 adds the explicit execution stage that PASS 10 deliberately withheld. A reviewer must first persist the supported `ROLLBACK_RELEASE` decision. Only then does the guided controller expose **EXECUTE CONTROLLED ROLLBACK**.

The UI stops after persisted recovery at `READY_FOR_VALIDATION`. It does **not** execute the PASS 12 validation command.

## Implemented workflow

```text
REGRESSION_CONFIRMED
  -> review remediation options
  -> persist ROLLBACK_RELEASE
REMEDIATION_SELECTED
  -> EXECUTE CONTROLLED ROLLBACK
  -> guarded POST /api/incidents/APP-2047/rollback
  -> atomic persisted rollback + recovery evidence
READY_FOR_VALIDATION
  -> STOP (PASS 12 not executed)
```

## Persisted controlled rollback

The existing backend rollback transaction remains authoritative. PASS 11 wires the UI to it only after a persisted rollback decision.

The backend transaction:

- delegates to `beginRollback()` and `finishRollback()` domain guards;
- moves incident state through `ROLLING_BACK` to `READY_FOR_VALIDATION`;
- moves affected release v2.8.0 from `DEGRADED` -> `ROLLING_BACK` -> `ROLLED_BACK`;
- keeps v2.7.4 `STABLE` and restores it as the active release;
- changes synthetic service health from `DEGRADED` to `HEALTHY`;
- changes synthetic error-rate state from 14.8% to 1.1%;
- persists `recoveredRelease = 2.7.4`;
- records `ROLLBACK_STARTED` and `ROLLBACK_COMPLETED` audit events;
- creates the synthetic recovery request `req_tx_recovery` with HTTP 200;
- creates synthetic recovery transaction `TX-90843` with `SUCCEEDED`;
- writes the matching recovery INFO log.

All of the above remains inside the existing Prisma transaction. PASS 11 did not add a generic status mutation.

## Before / after service state

A dedicated `RollbackRecovery` surface now shows the deterministic baseline and the persisted post-rollback state.

### Before

```text
active release        v2.8.0
release status        DEGRADED
service health        DEGRADED
synthetic error rate  14.8%
timeout               800 ms
```

### After (only when persisted evidence is complete)

```text
active release        v2.7.4
restored status       STABLE
affected status       ROLLED_BACK
service health        HEALTHY
synthetic error rate  1.1%
timeout               5000 ms
```

The after state is not shown as recovered merely because the incident status advanced. The presentation helper validates the persisted release state, application state, audit events, recovery request, recovery transaction and recovery log.

## Fail-closed recovery modes

`lib/ui/rollback-recovery.ts` exposes:

- `LOCKED` — supported rollback decision has not been persisted;
- `READY` — `ROLLBACK_RELEASE` is persisted and explicit execution is available;
- `EXECUTING` — persisted incident is in `ROLLING_BACK`;
- `RECOVERED` — all canonical persisted recovery evidence is present;
- `INCONSISTENT` — incident is post-rollback but one or more required evidence elements are missing.

The `RECOVERED` state requires all of these:

- persisted rollback decision;
- `ROLLBACK_STARTED` audit event;
- `ROLLBACK_COMPLETED` audit event;
- v2.8.0 = `ROLLED_BACK`;
- v2.7.4 = `STABLE`;
- v2.7.4 active in both release view and application state;
- application health = `HEALTHY`;
- persisted synthetic error rate = 1.1%;
- incident `recoveredRelease = 2.7.4`;
- `req_tx_recovery` HTTP 200 on v2.7.4;
- `TX-90843` = `SUCCEEDED` on v2.7.4;
- matching recovery INFO log.

Missing recovery transaction evidence, for example, produces `INCONSISTENT`, not `RECOVERED`.

## PASS 12 freeze

PASS 11 intentionally removes guided execution of `/validation/run` from Step 4. After rollback, the fixed controller displays **ROLLBACK COMPLETE** and is disabled.

The existing backend validation endpoint and earlier validation shell remain in the repository because they were implemented in earlier foundational passes, but PASS 11 does not execute or extend them.

The UI explicitly states:

> Recovery observed ≠ incident validated.

The four canonical checks stay `PENDING` until PASS 12.

## Verification performed

### PASS 11 source/scope gate

```text
checks=36
passed=36
failed=0
PASS11_ROLLBACK_RECOVERY_GATE_PASS
```

### Executable TypeScript recovery smoke

Verified:

- persisted decision -> `READY`;
- complete persisted recovery -> `RECOVERED`;
- every recovery evidence check passes for the canonical recovered state;
- active release changes v2.8.0 -> v2.7.4;
- service health changes `DEGRADED` -> `HEALTHY`;
- synthetic error rate changes 14.8% -> 1.1%;
- rollback stops at `READY_FOR_VALIDATION`;
- missing recovery transaction -> `INCONSISTENT`.

Final marker:

```text
PASS11_ROLLBACK_RECOVERY_SMOKE_PASS
```

### Pure helper TypeScript compile

```text
PASS11_ROLLBACK_RECOVERY_TYPESCRIPT_COMPILE_PASS
```

### Selected UI TypeScript shim compile

Changed PASS 11 UI/provider/controller sources compiled under strict TypeScript with temporary React shims because project dependencies are not installed in this execution environment.

```text
PASS11_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS
```

### Backend regression fallback gate

The existing relational backend fallback gate was rerun after PASS 11 changes:

```text
PASS4_RELATIONAL_BACKEND_GATE_PASS
tests=7 passed=7 failed=0
```

### Secret-pattern scan

```text
PASS11_SECRET_PATTERN_SCAN_PASS
```

`.env.example` is excluded from this scan because it contains only the documented local placeholder database URI, not a live credential.

## Files added

- `components/rollback-recovery.tsx`
- `lib/ui/rollback-recovery.ts`
- `tests/unit/rollback-recovery.test.ts`
- `scripts/pass11_rollback_recovery_gate.py`
- `scripts/pass11_rollback_recovery_smoke.ts`
- `PASS_11_REPORT.md`
- PASS 11 verification outputs

## Relevant files changed

- `components/guided-workflow-provider.tsx`
- `components/guided-controller.tsx`
- `components/guided-nav.tsx`
- `components/remediation-decision.tsx`
- `lib/ui/remediation-decision.ts`
- `lib/ui/guided-workflow.ts`
- `app/page.tsx`
- `tests/unit/guided-workflow.test.ts`
- `tests/unit/remediation-decision.test.ts`
- `package.json`
- `README.md`

## Runtime boundary still open

This pass does **not** claim a full production runtime gate. The existing project-wide release blockers remain:

- no `package-lock.json` / real `npm ci` gate in this environment;
- full Vitest suite not executed with installed project dependencies;
- full ESLint and project TypeScript not executed with installed dependencies;
- Prisma client generation/migrations not executed against the real target PostgreSQL from this environment;
- real Prisma/PostgreSQL integration test remains pending;
- Next production build remains pending;
- browser/mobile rendered QA remains pending;
- production dependency audit remains pending.

These are release/CI blockers, not PASS 11 source-implementation blockers.

## Scope verdict

**PASS 11 complete. PASS 12 not started by the guided UI.**
