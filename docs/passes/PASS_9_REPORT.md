# PASS 9 — Logs + Request + Data Correlation

Status: **IMPLEMENTED**

PASS 9 replaces the inherited static diagnostics shell with one persisted, read-only evidence trail that links the canonical synthetic request `req_tx_8f31`, transaction `TX-90842` and affected release `v2.8.0` across logs, HTTP request evidence and transaction state.

## What changed

### Persisted diagnostic hydration

`components/guided-workflow-provider.tsx` now hydrates the existing read APIs for:

- `/api/incidents/APP-2047/logs`
- `/api/incidents/APP-2047/requests`
- `/api/incidents/APP-2047/transactions`

The diagnostics UI no longer renders the seed-time `initialLogs` snapshot from `app/page.tsx`. The evidence shown in PASS 9 comes from the persisted scenario state returned by the API.

### Dedicated correlation engine

`lib/ui/diagnostic-correlation.ts` builds a read-only correlation view. It does not mutate incident state and does not run the root-cause domain engine.

The canonical failing trail is linked through:

1. deployment marker for `v2.8.0`
2. request start for `req_tx_8f31`
3. correlated latency warning (`1437 ms`)
4. correlated `UPSTREAM_TIMEOUT / HTTP 504` error
5. persisted failed transaction `TX-90842`

The helper verifies that the persisted request and transaction agree on the expected request ID, release version and failure evidence.

### Fail-closed evidence integrity

The correlation result has three states:

- `COMPLETE` — all required request/log/transaction relationships agree
- `PARTIAL` — required evidence is missing
- `MISMATCH` — persisted evidence exists but contradicts the canonical linkage

This prevents the UI from presenting a broken or incomplete evidence set as a clean correlation.

The integrity panel checks the canonical request, request/release mapping, HTTP failure evidence, transaction/request mapping, transaction/release mapping and correlated request-start, latency, timeout and transaction-failure logs.

### Single evidence trail UI

`components/diagnostic-correlation.tsx` now presents:

- correlation keys (`req_tx_8f31`, `TX-90842`, `v2.8.0`)
- evidence-integrity status
- a five-checkpoint persisted event timeline
- request-correlated log explorer
- HTTP request inspector
- read-only illustrative data lookup + persisted transaction result

The data lookup is explicitly labelled **illustrative** and **read-only**. It does not expose an arbitrary SQL editor or execute client-provided SQL.

### Correlation vs causation boundary

PASS 9 deliberately states that a complete correlation trail strengthens investigation context but **does not independently establish causation**.

PASS 8's root-cause contract remains unchanged:

- observable evidence is shown to the reviewer
- server/domain logic evaluates the root cause
- the browser does not call `assessRootCause()`
- the persisted root-cause code/explanation remains the confirmation boundary

## Recovery evidence behavior

After rollback, the database can contain additional recovery request/transaction/log records. PASS 9 deliberately filters the failing incident trail by the canonical request `req_tx_8f31` and transaction `TX-90842`, so later `req_tx_recovery` / `TX-90843` evidence does not overwrite or confuse the original failure investigation.

## PASS 10 scope freeze

PASS 9 does **not** introduce dedicated PASS 10 remediation-decision implementation.

Not added:

- `components/remediation-decision.tsx`
- `lib/ui/remediation-decision.ts`
- `tests/unit/remediation-decision.test.ts`

The inherited remediation shell and guided Step 3 behavior remain untouched in this pass.

## Verification executed

### PASS 9 source/scope gate

`PASS_9_GATE_OUTPUT.txt`

Result:

`PASS9_DIAGNOSTIC_CORRELATION_GATE_PASS`

- 36 checks
- 36 passed
- 0 failed

### Executable correlation smoke

`PASS_9_CORRELATION_SMOKE_OUTPUT.txt`

Result:

`PASS9_DIAGNOSTIC_CORRELATION_SMOKE_PASS`

It verifies:

- canonical correlation → `COMPLETE`
- request ID linkage
- transaction ID linkage
- request + transaction version linkage to `v2.8.0`
- request-correlated log selection
- five-step trail construction
- cross-request transaction mismatch → `MISMATCH`
- missing timeout log → `PARTIAL`

### Pure TypeScript compile

`PASS_9_CORRELATION_TS_COMPILE_OUTPUT.txt`

Result:

`PASS9_CORRELATION_TYPESCRIPT_COMPILE_PASS`

The actual correlation helper and executable smoke source compile in strict TypeScript without project dependencies.

### Selected PASS 9 UI TypeScript compile

`PASS_9_UI_TS_COMPILE_OUTPUT.txt`

Result:

`PASS9_UI_SELECTED_TYPESCRIPT_SHIM_COMPILE_PASS`

Temporary React ambient shims are used only because the project dependencies are not installed in this execution environment.

## Runtime boundary

PASS 9 is source-implemented and the correlation logic has been executed independently. The previously tracked final release gates remain open:

- real `npm ci`
- full Vitest/component suite
- full ESLint/typecheck
- Prisma generation/migration
- real PostgreSQL integration suite
- Next.js production build
- browser/mobile visual QA
- dependency audit

No full production/runtime PASS is claimed here.

## Next formal phase

**PASS 10 — Remediation Decision** is next and has **not** been implemented in this artifact.
