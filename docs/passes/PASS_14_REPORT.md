# PASS 14 — Recruiter Presentation Mode

## Verdict

**IMPLEMENTED — PASS 14 COMPLETE / PASS 15 NOT STARTED**

ApplicationOps now has a deterministic recruiter-facing runtime that completes the full five-step incident walkthrough without PostgreSQL, while the existing PASS 0–13 API/Prisma/PostgreSQL implementation remains in the repository for technical review.

## Runtime contract

Default:

```text
NEXT_PUBLIC_APPLICATIONOPS_RUNTIME unset
→ presentation
```

Optional technical-review mode:

```text
NEXT_PUBLIC_APPLICATIONOPS_RUNTIME=server
→ existing guarded API + Prisma/PostgreSQL path
```

The default live mode does not hydrate from `/api/*`, does not call Prisma, and does not require `DATABASE_URL`.

## Presentation state engine

Added:

- `lib/presentation/presentation-state.ts`
- `components/presentation-mode-banner.tsx`
- `tests/unit/presentation-state.test.ts`

The pure presentation engine owns only synthetic browser state. It contains no Prisma import, database URL, bank API integration or network fetch.

### Deterministic sequence

1. `presentationStartInvestigation()`
   - `OPEN → INVESTIGATING`
   - records `INVESTIGATION_STARTED`
2. `presentationConfirmRegression()`
   - runs the existing deterministic root-cause rules over the synthetic evidence
   - records `RELEASE_TIMEOUT_REGRESSION`
   - `INVESTIGATING → REGRESSION_CONFIRMED`
3. `presentationRecordRemediation()`
   - accepts only `ROLLBACK_RELEASE` as the successful path for this evidence set
   - `REGRESSION_CONFIRMED → REMEDIATION_SELECTED`
4. controlled rollback
   - `REMEDIATION_SELECTED → ROLLING_BACK → READY_FOR_VALIDATION`
   - v2.8.0 → `ROLLED_BACK`
   - v2.7.4 → active `STABLE`
   - service `DEGRADED → HEALTHY`
   - synthetic error rate `14.8% → 1.1%`
   - adds `req_tx_recovery`, HTTP 200, `TX-90843 SUCCEEDED` and recovery log
5. validation
   - reuses the existing recovery-evidence derivation
   - requires 4/4 evidence conditions
   - records four `PASS` checks
   - `READY_FOR_VALIDATION → VALIDATED`
6. resolution
   - reuses the deterministic resolution-handoff derivation
   - creates technical and business-facing closure summaries
   - `VALIDATED → RESOLVED`
7. reset
   - rebuilds the exact canonical `OPEN` synthetic state

The reviewer still experiences five user-facing checkpoints: Investigate → Compare → Decide/Recover → Validate → Resolve. Rollback remains a separate controlled action inside the remediation stage, consistent with PASS 10–13.

## Transparency / credibility hardening

The live UI now exposes a visible `Recruiter Presentation Mode` banner:

> This live walkthrough uses deterministic synthetic state entirely in the browser, so it does not require PostgreSQL or access to any external bank system. The repository keeps the separate database-backed implementation and tests for technical review.

This prevents a recruiter from mistaking the reliability layer for a live bank/backend connection.

Presentation-aware copy was hardened so the browser mode no longer falsely claims that each live action was persisted to PostgreSQL or executed by a live server transaction. Database-backed wording remains available only where the optional server runtime is active.

## Independence from PostgreSQL

The default presentation path:

- initializes from `createPresentationState()`;
- does not call `refresh()` against API routes on mount;
- does not call API mutation endpoints for the five-step flow;
- does not import Prisma in the presentation module;
- does not require `DATABASE_URL`;
- reset is local and deterministic;
- still uses the same synthetic IDs, evidence, guards, validation definitions and closure logic.

The existing `/api/*`, Prisma schema, migrations and DB integration tests were not removed or weakened.

## Verification

### PASS 14 source/scope gate

```text
checks=45
passed=45
failed=0
PASS14_PRESENTATION_MODE_GATE_PASS
```

### Executable presentation walkthrough

```text
PASS14_PRESENTATION_WORKFLOW_SMOKE_PASS
steps=5
final_status=RESOLVED
validation=4/4
postgres_runtime_required=false
```

### TypeScript

```text
PASS14_PRESENTATION_TYPESCRIPT_COMPILE_PASS
PASS14_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS
```

## Scope freeze

PASS 15 was not started.

Not performed in this pass:

- `npm ci`
- full Vitest suite
- ESLint full gate
- full project typecheck
- Prisma generate/migrate against a real database
- real PostgreSQL integration suite
- Next production build
- dependency audit
- GitHub Actions hardening
- public deployment
- browser/mobile rendered QA

Those remain explicit release gates.
