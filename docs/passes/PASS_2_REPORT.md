# ApplicationOps — PASS 2 Database & Synthetic Scenario Report

## Verdict

**PASS 2 source implementation: COMPLETE**

The repository now contains a PostgreSQL/Prisma persistence contract and deterministic synthetic scenario that preserve the hardened PASS 0/1 domain assumptions. No PASS 3 API endpoints were introduced.

## Implemented

### Prisma/PostgreSQL schema

Models:
- `Application`
- `Release`
- `Incident`
- `DiagnosticLog`
- `ApiRequest`
- `SyntheticTransaction`
- `ValidationCheck`
- `AuditEvent`

Persisted enums:
- `IncidentStatus`
- `ReleaseStatus`
- `RemediationAction`
- `ValidationStatus`
- `ServiceHealth`
- `LogLevel`
- `SyntheticTransactionStatus`

Database protections include:
- foreign keys with cascade deletion for the synthetic evidence graph;
- unique application+release version constraint;
- unique incident+validation-key constraint;
- indexes for incident state, releases, timestamps, request correlation, error status and audit access patterns.

### Deterministic synthetic scenario

Initial reset creates:
- one synthetic application;
- two releases (`v2.7.4` STABLE, `v2.8.0` DEGRADED);
- one OPEN incident `APP-2047`;
- five diagnostic log rows;
- one failed API request with `req_tx_8f31`;
- one failed synthetic transaction `TX-90842`;
- exactly four canonical required validation checks in `PENDING`;
- three initial audit/context events.

No customer/account/card/IBAN data is present.

### Atomic reset

`resetSyntheticScenario()` executes deletion, recreation and persisted invariant verification inside one Prisma `$transaction`.

Only the canonical synthetic application is deleted. Its related incident/release/evidence rows are removed by the declared FK cascades. If any insert or invariant assertion fails, PostgreSQL rolls the reset back rather than leaving a partial state.

### Invariant hardening

Before persistence, `assertSyntheticScenarioSeedInvariants()` rejects:
- progressed incident state;
- preselected remediation/root cause/recovery;
- release-pair drift;
- request/transaction correlation drift;
- missing correlated ERROR evidence;
- missing/duplicate canonical validation definitions.

After persistence, `assertPersistedScenarioInvariants()` re-reads the graph inside the same transaction and fails closed if the persisted state no longer matches the canonical reset contract.

## Verification completed in this environment

### Strict TypeScript compile — domain + data layer

**PASS**

The existing hardened domain layer plus new synthetic scenario/invariant layer compiled with strict TypeScript settings.

### Executable scenario smoke

**PASS** — `PASS2_SYNTHETIC_SCENARIO_SMOKE_PASS`

Verified:
- deterministic fresh seed equality;
- 2 releases;
- 5 log rows;
- 1 API request;
- 1 synthetic transaction;
- 4 validation checks;
- 3 audit events;
- canonical request correlation across request/transaction/logs;
- correlated ERROR evidence;
- invariant rejection when a validation check is removed;
- invariant rejection when request correlation drifts;
- invariant rejection when reset incident starts progressed.

### Static migration/schema audit

The migration contains all 8 tables, 7 enum types, declared foreign keys, cascade rules, uniqueness constraints and indexes represented by the PASS 2 Prisma schema.

## Deferred verification — NOT claimed as passed

The following are still pending because the current environment cannot reliably access npm registry/PostgreSQL infrastructure:

- `npm install` / generated `package-lock.json`;
- `prisma generate`;
- `prisma validate`;
- actual PostgreSQL `prisma migrate deploy`;
- executing `npm run db:seed` against PostgreSQL;
- DB referential-integrity runtime verification;
- full ESLint/Vitest/Next production build;
- `npm audit`.

These remain explicit CI/release gates. PASS 4 will add the database-backed golden-path integration test after the persistence/API workflow exists.

## PASS 3 constraints

PASS 3 must not introduce generic database state-update endpoints. Application services should:

1. load current persisted evidence/state;
2. invoke the hardened domain workflow command;
3. persist the resulting incident/release/application mutation;
4. append the corresponding audit event;
5. do steps 3–4 inside the **same Prisma transaction**;
6. reject optimistic-state mismatch rather than overwriting concurrent/drifted state.

Rollback must update incident, release pair and application active-release/health metrics atomically.

## PASS 2 status

**READY FOR PASS 3 API VERTICAL SLICE, subject to the explicitly deferred npm/Prisma runtime gates above.**
