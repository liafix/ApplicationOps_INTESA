# ApplicationOps — PASS 4 Report

## Scope

PASS 4 implements the database-backed backend MVP gate defined in the approved implementation plan.

The goal is to verify the complete guarded workflow at the persistence/service boundary, not to add UI behavior.

## Implemented PostgreSQL integration suite

Added:

`tests/integration/applicationops.db.test.ts`

The suite calls the real ApplicationOps service layer and Prisma-backed reset. It is designed to run against a disposable PostgreSQL database and contains seven sequential cases:

1. **Golden path** — reset → investigate → confirm regression → select rollback → execute rollback → validate → resolve.
2. **Rollback before evidence/remediation** — rejected with no partial rollback state/audit.
3. **Unsupported remediation** — `CHANGE_PRODUCTION_DATA` is rejected and the incident remains `REGRESSION_CONFIRMED`.
4. **Validation before rollback** — rejected; all four checks remain `PENDING`.
5. **Resolve before validation** — rejected; no resolution audit is written.
6. **Mid-rollback persistence conflict** — application state is deliberately changed so the late compare-and-set fails; the whole rollback transaction must revert incident/release/audit writes.
7. **Deterministic reset after completion** — restores the exact canonical initial graph.

## Golden-path final assertions

The database integration test requires all of the following:

- incident `APP-2047 = RESOLVED`,
- root cause `RELEASE_TIMEOUT_REGRESSION`,
- remediation `ROLLBACK_RELEASE`,
- affected release `v2.8.0`,
- recovered release `v2.7.4`,
- application health `HEALTHY`,
- active release `v2.7.4`,
- recovered synthetic error rate equals the canonical recovery value,
- `v2.8.0 = ROLLED_BACK`,
- `v2.7.4 = STABLE`,
- exactly four required validation checks and all `PASS`,
- synthetic recovery transaction exists on `v2.7.4`,
- complete ordered audit sequence exists.

Expected audit sequence:

`RELEASE_DEPLOYED → INCIDENT_CREATED → APPLICATION_DEGRADED → INVESTIGATION_STARTED → RELEASE_COMPARISON_REVIEWED → RELEASE_REGRESSION_CONFIRMED → REMEDIATION_SELECTED → ROLLBACK_STARTED → ROLLBACK_COMPLETED → VALIDATION_STARTED → VALIDATION_PASSED → INCIDENT_RESOLVED`

## Hardening found during PASS 4

### Deterministic audit ordering

PASS 4 test design exposed a potential flake: separate commands can execute within the same millisecond, while audit reads sort primarily by timestamp.

`appendAudit()` now reads the latest incident audit timestamp inside the same transaction and guarantees the new timestamp is strictly greater by at least 1 ms when needed.

This preserves deterministic event ordering without claiming cryptographic immutability.

## New scripts

- `npm run test:unit`
- `npm run test:integration:db`
- `npm run backend:mvp:gate`

The full backend gate script is:

`prisma validate → prisma migrate deploy → PostgreSQL integration suite`

The integration suite must be pointed only at a disposable test database because it resets the canonical synthetic scenario before each test.

## Executed verification in the current environment

### TypeScript source check

The PASS 4 domain/data/service/integration-test source was compiled using the system TypeScript compiler plus temporary declaration shims for external packages that cannot currently be installed.

Result:

`PASS4_TS_SOURCE_SHIM_COMPILE_PASS`

This verifies source syntax/type structure but does **not** substitute for a real Prisma-generated typecheck.

### Relational database transaction fallback gate

Because no local PostgreSQL server is installed and npm registry DNS is unavailable, an offline relational fallback harness was added at:

`scripts/pass4_relational_backend_gate.py`

It uses an in-memory relational database and mirrors the canonical persisted workflow/transaction boundaries. It is intentionally documented as a fallback, not as a replacement for the Prisma/PostgreSQL integration suite.

Executed result:

`PASS4_RELATIONAL_BACKEND_GATE_PASS`

`tests=7 passed=7 failed=0`

Passed scenarios:

- golden path,
- rollback before evidence,
- unsupported remediation,
- validation before rollback,
- resolve before validation,
- rollback transaction atomicity,
- deterministic reset.

### Static backend audit

- integration cases: 7
- Prisma workflow mutation transactions: 6
- generic PATCH status routes: 0
- real PII/credential pattern scan: none found
- project version: 0.4.0

## PostgreSQL execution attempt

A dedicated Neon PostgreSQL project was provisioned for the ApplicationOps candidate demo:

- Project: `applicationops-candidate-demo`
- Project ID: `lively-lab-44822886`
- PostgreSQL: 18
- Default branch: `main`
- Default branch ID: `br-soft-credit-arkv7iqw`

No schema or test data were applied through Neon during this PASS. The connected Neon SQL/migration tools currently expose camelCase arguments to the assistant but the connector runtime rejects them and asks for undocumented snake_case keys. Direct SQL execution therefore could not be used as a truthful PostgreSQL test result.

Separately, `registry.npmjs.org` still cannot be resolved from the build container and no local PostgreSQL server is installed, so Prisma generation and the Vitest PostgreSQL suite cannot be executed here.

## Backend MVP Gate verdict

**PASS 4 implementation: COMPLETE**

**Backend MVP Gate: CONDITIONAL GO**

The guarded backend contract, transactional test source, negative paths, deterministic reset and offline relational transaction execution are all in place and pass the checks available in this environment.

The following remains a **hard release/CI blocker** before publishing the final repository or submitting the finished candidate artifact:

- real `npm ci`,
- `prisma generate`,
- `prisma validate`,
- migration deployment to disposable PostgreSQL,
- `npm run test:integration:db`,
- full unit suite,
- ESLint/typecheck with installed dependencies,
- production build,
- dependency audit.

It is safe to proceed to PASS 5 UI skeleton while preserving this blocker explicitly. It is not safe to claim "PostgreSQL integration tests PASS" until that actual run succeeds.
