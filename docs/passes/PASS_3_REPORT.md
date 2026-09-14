# ApplicationOps — PASS 3 API Vertical Slice Report

## Verdict

**PASS 3 — IMPLEMENTED, SOURCE-VERIFIED, DATABASE RUNTIME GATE DEFERRED TO PASS 4/CI.**

The API/application-service vertical slice now exposes the approved deterministic workflow without adding a generic status mutation endpoint. Every workflow mutation enters through a hardened domain command and persists its state change plus matching audit event inside the same Prisma transaction.

## Implemented surface

### Read API

- `GET /api/dashboard`
- `GET /api/incidents/[id]`
- `GET /api/incidents/[id]/logs`
- `GET /api/incidents/[id]/requests`
- `GET /api/incidents/[id]/transactions`
- `GET /api/incidents/[id]/releases`
- `GET /api/incidents/[id]/validation`
- `GET /api/incidents/[id]/audit`

### Guarded mutation API

- `POST /api/incidents/[id]/investigate`
- `POST /api/incidents/[id]/confirm-regression`
- `POST /api/incidents/[id]/remediation`
- `POST /api/incidents/[id]/rollback`
- `POST /api/incidents/[id]/validation/run`
- `POST /api/incidents/[id]/resolve`
- `POST /api/demo/reset`

## Domain/persistence boundary

The mutation service does **not** accept a requested incident status from the client. There is no `PATCH /status` shortcut.

The service:

1. reads persisted state/evidence;
2. derives domain evidence where required;
3. invokes the approved guarded domain command;
4. compare-and-sets the expected persisted status;
5. persists related application/release/evidence changes;
6. appends the corresponding audit event in the same database transaction;
7. commits only if every invariant-related write succeeds.

This keeps the PASS 1 hardened domain layer authoritative over workflow progression.

## Root-cause confirmation

`confirm-regression` does not trust a client-supplied root cause. It derives evidence from the persisted release pair, failed request duration, incident/deployment timing and timeout ERROR logs, then executes:

`assessRootCause() → confirmReleaseRegression()`.

Only the deterministic high-confidence `RELEASE_TIMEOUT_REGRESSION` can advance the incident.

## Remediation

The JSON body is Zod constrained to the four approved remediation enum values. The hardened domain still permits only `ROLLBACK_RELEASE` as the successful remediation for this evidence set. Malformed JSON returns a controlled `400 INVALID_JSON` instead of leaking into a generic 500.

## Rollback atomicity

The rollback endpoint is intentionally one compound deterministic command. Inside one transaction it:

- guards `REMEDIATION_SELECTED + ROLLBACK_RELEASE`;
- compare-and-sets incident/release state into rollback;
- verifies the previous release remains stable;
- records `ROLLBACK_STARTED`;
- executes the hardened finish transition;
- restores v2.7.4 as active and application health to `HEALTHY`;
- sets synthetic error rate to the recovery value;
- persists a synthetic successful recovery request/transaction/log;
- records `ROLLBACK_COMPLETED`.

Any failure rolls the whole compound operation back.

## Validation

Validation evidence is derived from persisted recovery state rather than accepted from the client:

1. v2.7.4 is active/STABLE and v2.8.0 is ROLLED_BACK;
2. application synthetic error rate is below the explicit synthetic threshold;
3. a post-rollback synthetic transaction succeeded on v2.7.4;
4. no post-rollback timeout ERROR exists.

These facts are mapped to the exact canonical four-check domain gate. `validateRecovery()` must pass before `VALIDATED` is persisted. Resolution then re-reads persisted validation checks and calls `resolveValidatedIncident()`.

## Concurrency hardening

Incident and release workflow writes use compare-and-set predicates on the status/version state read by the command. If another write changes the expected state first, `PERSISTENCE_CONFLICT` aborts the transaction, preventing a stale request from writing a matching audit event for a state transition it did not own.

## API error boundary

Known domain errors are translated into stable `400/409` API responses. Missing canonical resources return 404. Unexpected failures return a generic 500 without stack traces or database details.

## Source verification performed

### PASS

- Pure domain + PASS 3 evidence mapper strict TypeScript compilation: `PASS3_PURE_TYPESCRIPT_COMPILE_PASS`
- Executable guarded-flow smoke: `PASS3_PURE_GUARDED_FLOW_SMOKE_PASS`
- PASS 3 API/service source compile with temporary external-library type shims: `PASS3_API_SOURCE_TYPESCRIPT_SHIM_COMPILE_PASS_AFTER_HARDENING`
- 15 route-handler files present for the approved API surface
- no generic PATCH/status route added
- mutation orchestration centralized in `lib/services/applicationops-service.ts`
- all six workflow mutations use `prisma.$transaction(...)`
- all six workflow mutations persist one or more matching audit events in that transaction
- reset continues to use PASS 2 atomic transaction + seeded audit context
- API routes do not import Prisma directly

### Added test source

`tests/unit/incident-evidence.test.ts` covers:

- root-cause evidence mapping from persisted-style records;
- release-pair state derivation;
- exact four-check PASS mapping;
- explicit FAIL mapping when recovery evidence is missing.

## Verification boundary / not claimed yet

The current execution environment still cannot resolve `registry.npmjs.org` (`EAI_AGAIN`), and no PostgreSQL runtime is available locally. Therefore this report does **not** claim successful execution of:

- `npm ci`
- `prisma generate`
- `prisma validate`
- `prisma migrate deploy`
- real Next route runtime
- real PostgreSQL mutation sequence
- full Vitest suite
- ESLint
- production build
- `npm audit`

Those become hard gates in PASS 4 / release CI. PASS 3 is implemented at source level with pure executable domain/evidence verification; database-backed end-to-end verification remains intentionally pending rather than being overstated.

## PASS 4 handoff

PASS 4 should provision a real PostgreSQL test database and execute the API/application-service golden path:

`reset → investigate → confirm regression → select rollback → rollback → validate → resolve`

It must also verify negative paths and assert final database/audit invariants.
