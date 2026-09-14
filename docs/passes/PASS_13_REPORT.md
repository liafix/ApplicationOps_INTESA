# ApplicationOps — PASS 13 Resolution + Business Handoff Report

## Scope

PASS 13 implements the final explicit incident-closure stage only:

`VALIDATED → RESOLVED`

It does not implement PASS 14 Presentation Mode.

## Implemented

- guided Step 5 now executes `POST /api/incidents/APP-2047/resolve`;
- the controller exposes `RESOLVE INCIDENT` only after persisted validation reaches `VALIDATED`;
- two new nullable persisted incident fields:
  - `closureTechnicalSummary`;
  - `closureBusinessSummary`;
- additive Prisma migration for those closure fields;
- deterministic `deriveResolutionHandoff()` built only from persisted synthetic evidence;
- fail-closed UI state model: `LOCKED | READY | RESOLVED | INCONSISTENT`;
- dedicated `ResolutionHandoff` UI with technical and business-facing views;
- atomic closure audit sequence:
  - `RESOLUTION_HANDOFF_CREATED`;
  - `INCIDENT_RESOLVED`;
- reset contract clears both closure summaries.

## Closure evidence requirements

The server refuses final closure unless all of these remain true at resolution time:

1. incident is `VALIDATED`;
2. root cause is `RELEASE_TIMEOUT_REGRESSION`;
3. selected remediation is `ROLLBACK_RELEASE`;
4. affected release remains v2.8.0;
5. recovered release remains v2.7.4;
6. post-rollback recovery evidence still passes 4/4;
7. the four canonical persisted validation checks still pass;
8. `VALIDATION_PASSED` exists in the audit trail.

If any invariant has drifted, the command returns `RESOLUTION_EVIDENCE_INCOMPLETE` and the transaction does not persist a partial closure.

## Closure summaries

### Technical summary

The technical handoff includes the persisted synthetic root-cause code, affected/current release, timeout-vs-latency evidence, correlated request + transaction identifiers, controlled rollback target, service recovery state, recovery request + transaction result, and 4/4 validation outcome.

### Business-facing summary

The stakeholder handoff intentionally removes raw low-level diagnostics. It states that a release-level timeout regression caused elevated synthetic failures, the service was restored to the previous stable release, recovery checks passed 4/4 and the incident was closed after validation. It preserves the synthetic-data boundary.

No €/% savings or claims about Intesa internal systems are introduced.

## Fail-closed resolved display

The UI only presents `RESOLVED` when:

- persisted incident status is `RESOLVED`;
- both persisted closure summaries exist;
- both summaries exactly match the deterministic evidence-derived summaries;
- `RESOLUTION_HANDOFF_CREATED` exists;
- `INCIDENT_RESOLVED` exists;
- underlying recovery + validation evidence still remains consistent.

Otherwise the resolution surface shows `INCONSISTENT` rather than a false successful closure.

## Integration-test source hardening

The PostgreSQL integration source now additionally asserts:

- golden-path closure summaries are persisted;
- `RESOLUTION_HANDOFF_CREATED` occurs before `INCIDENT_RESOLVED`;
- resolving before validation persists no closure summary/audit;
- post-validation service-state drift blocks resolution and leaves `VALIDATED` unchanged;
- deterministic reset clears closure fields.

## Verification executed in this environment

### PASS 13 source/scope gate

```text
checks=24
passed=24
failed=0
PASS13_RESOLUTION_HANDOFF_GATE_PASS
```

### Executable closure-contract smoke

```text
checks=7
passed=7
failed=0
PASS13_RESOLUTION_HANDOFF_SMOKE_PASS
```

### TypeScript checks

```text
PASS13_RESOLUTION_HELPER_TYPESCRIPT_COMPILE_PASS
PASS13_UNIT_TEST_SOURCE_TYPESCRIPT_SHIM_COMPILE_PASS
PASS13_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS
PASS13_SERVICE_TYPESCRIPT_PRISMA_SHIM_COMPILE_PASS
```

The service shim compile disables `noImplicitAny` only for generic Prisma relation values because the real generated Prisma client is unavailable in this environment; strict pure helper/UI-state compilation remains enabled.

### Previous backend regression harness

```text
PASS4_RELATIONAL_BACKEND_GATE_PASS
tests=7 passed=7 failed=0
```

### Secret scan

```text
PASS13_SECRET_PATTERN_SCAN_PASS
```

## Runtime boundary still open

This pass does not claim successful execution of:

- `npm ci`;
- Prisma client generation using installed project dependencies;
- migrations against a real PostgreSQL runtime;
- the real Prisma/PostgreSQL integration suite;
- full Vitest/ESLint/typecheck;
- Next.js production build;
- browser/mobile visual QA;
- dependency audit.

Those remain release blockers before public repository/deployment/application use.

## PASS 14 freeze

No Presentation Mode component, browser-only synthetic state engine or public deployment implementation was added. PASS 14 remains not started.
