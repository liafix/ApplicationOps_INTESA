# PASS 3 API Contract

All endpoints operate only on the canonical synthetic scenario. No endpoint accepts arbitrary SQL, release identifiers, transaction payloads or external banking data.

## Read endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Synthetic service/incident summary |
| GET | `/api/incidents/APP-2047` | Incident + application context |
| GET | `/api/incidents/APP-2047/logs` | Correlated diagnostic logs |
| GET | `/api/incidents/APP-2047/requests` | Failed/recovery request evidence |
| GET | `/api/incidents/APP-2047/transactions` | Synthetic transaction evidence |
| GET | `/api/incidents/APP-2047/releases` | Previous/current release comparison |
| GET | `/api/incidents/APP-2047/validation` | Canonical validation gate |
| GET | `/api/incidents/APP-2047/audit` | Append-only application audit events |

## Mutation endpoints

| Method | Path | Guarded domain command / behavior |
| --- | --- | --- |
| POST | `/api/incidents/APP-2047/investigate` | `startInvestigation()` |
| POST | `/api/incidents/APP-2047/confirm-regression` | Derive persisted evidence → `assessRootCause()` → `confirmReleaseRegression()` |
| POST | `/api/incidents/APP-2047/remediation` | Zod-validated action → `chooseRemediation()` |
| POST | `/api/incidents/APP-2047/rollback` | `beginRollback()` + `finishRollback()` as one atomic synthetic rollback command |
| POST | `/api/incidents/APP-2047/validation/run` | Derive recovery evidence → `validateRecovery()` |
| POST | `/api/incidents/APP-2047/resolve` | Persisted checks → `resolveValidatedIncident()` |
| POST | `/api/demo/reset` | Atomic deterministic scenario reset from PASS 2 |

Remediation request body:

```json
{
  "action": "ROLLBACK_RELEASE"
}
```

The three other known remediation options are valid enum values but intentionally rejected as the successful path for this deterministic evidence set by the hardened domain layer.

## Atomicity contract

Every workflow mutation executes inside one Prisma/PostgreSQL transaction. State writes use compare-and-set conditions against the status read by the guarded command. If the expected state changed concurrently, the transaction fails with `PERSISTENCE_CONFLICT` and its audit write is rolled back with it.

Rollback is a compound command inside one transaction:

1. compare-and-set incident to `ROLLING_BACK`;
2. compare-and-set affected release to `ROLLING_BACK`;
3. append `ROLLBACK_STARTED`;
4. finish the guarded release/incident transition;
5. persist affected release as `ROLLED_BACK` and restore the stable release as active;
6. persist synthetic recovery evidence;
7. append `ROLLBACK_COMPLETED`;
8. commit everything together or roll everything back.

The intermediate `ROLLING_BACK` state is therefore part of the domain/audit history but is not exposed as a partially committed database state by this deterministic MVP command.

## Response envelope

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_REQUIRED",
    "message": "..."
  }
}
```

## Error semantics

- `400 INVALID_INPUT` — schema validation failure
- `400 INVALID_JSON` — malformed JSON body
- `400 INVALID_EVIDENCE` — invalid root-cause evidence values
- `400 REMEDIATION_NOT_SUPPORTED` — known action is not the supported successful path
- `404 INCIDENT_NOT_FOUND` / `SCENARIO_NOT_FOUND` — canonical synthetic resource missing
- `409 INVALID_INCIDENT_TRANSITION` — attempted workflow skip/replay
- `409 REGRESSION_NOT_CONFIRMED` — remediation before evidence-backed confirmation
- `409 ROLLBACK_NOT_COMPLETED` — validation before completed rollback
- `409 VALIDATION_REQUIRED` — resolution without complete required validation
- `409 PERSISTENCE_CONFLICT` — compare-and-set/concurrency invariant failed
- `500 INTERNAL_ERROR` — unexpected failure without leaking implementation details

## PASS 12 recovery-validation evidence contract

`POST /api/incidents/APP-2047/validation/run` does not accept PASS/FAIL values from the client. It re-reads persisted recovery state inside the existing Prisma transaction and derives the exact four canonical checks before invoking `validateRecovery()`.

The synthetic gate requires all of the following persisted evidence:

- restored-release check: active v2.7.4, v2.7.4 `STABLE`, affected v2.8.0 `ROLLED_BACK`, recovered release recorded on the incident, service `HEALTHY`;
- error-rate check: persisted synthetic error rate is strictly below the configured validation threshold;
- synthetic-transaction check: exact `req_tx_recovery` HTTP 200 plus exact `TX-90843` `SUCCEEDED`, both on v2.7.4 and without failure codes;
- timeout-error check: zero `UPSTREAM_TIMEOUT` ERROR records after the persisted `ROLLBACK_COMPLETED` timestamp.

If the evidence does not satisfy all required checks, `validateRecovery()` rejects the state transition and the transaction does not manufacture validation success. When 4/4 pass, the same transaction records `VALIDATION_STARTED`, persists the four check statuses, compare-and-sets the incident to `VALIDATED`, records `VALIDATION_PASSED`, and commits the result together.

PASS 12 guided UI invokes this validation command but intentionally does not invoke `/resolve`. `VALIDATED` and `RESOLVED` remain separate domain states.

## PASS 13 resolution + business handoff contract

`POST /api/incidents/APP-2047/resolve` remains a separate explicit command after `VALIDATED`. It does not accept a target status or closure copy from the client.

Inside one Prisma/PostgreSQL transaction the server:

1. re-reads the persisted incident, releases, requests, synthetic transactions, logs, validation checks and audit evidence;
2. requires the exact confirmed root cause `RELEASE_TIMEOUT_REGRESSION`, selected `ROLLBACK_RELEASE`, restored v2.7.4 state, 4/4 recovery evidence, 4/4 persisted validation and `VALIDATION_PASSED` audit evidence;
3. derives deterministic technical and business-facing closure summaries from that persisted evidence;
4. compare-and-sets `VALIDATED → RESOLVED` while persisting both closure summaries on the incident;
5. appends `RESOLUTION_HANDOFF_CREATED` and then `INCIDENT_RESOLVED` in the same transaction.

If post-validation recovery evidence has drifted, the command fails closed with `409 RESOLUTION_EVIDENCE_INCOMPLETE`; no summary, resolution status or closure audit is partially persisted.

The incident read response now also exposes nullable `closureTechnicalSummary` and `closureBusinessSummary`. They remain `null` before successful explicit resolution.
