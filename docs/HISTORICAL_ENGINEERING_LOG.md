# ApplicationOps — Release & Incident Support Console

Independent candidate demonstrator created specifically for an application to the **Application Support Associate** role at **Intesa Sanpaolo International Value Services**.

> Built only from publicly available role/company context and synthetic data. It is not an Intesa Sanpaolo product, internal system or representation of its architecture.

## What it demonstrates

ApplicationOps is designed around one deterministic synthetic application-support scenario: a release introduces a timeout regression, transaction processing degrades, evidence is correlated, a controlled reversible rollback is selected, recovery is validated and the incident is resolved.

## Current runtime modes

- **Recruiter Presentation Mode (default):** deterministic synthetic browser state; no PostgreSQL or external bank-system dependency at runtime.
- **Database-backed technical-review mode (optional):** set `NEXT_PUBLIC_APPLICATIONOPS_RUNTIME=server` and provide `DATABASE_URL` to use the guarded API + Prisma/PostgreSQL implementation.

The UI visibly discloses Presentation Mode so the live reliability layer is not mistaken for an Intesa internal or production system.

## Current implementation status

### PASS 0 — Foundation ✅
- Next.js 15.5.24 + React 19 + TypeScript
- Tailwind CSS
- ESLint + Prettier
- Vitest + React Testing Library foundation
- Prisma + PostgreSQL tooling foundation
- Zod
- security headers
- Node 22.x / npm 10.x runtime contract
- canonical synthetic scenario constants
- visible candidate/synthetic-data disclaimer

### PASS 1 — Domain Engine ✅ + audit hardened
- explicit incident state machine
- guarded workflow commands for evidence-backed progression
- guarded release rollback state machine
- deterministic root-cause engine with evidence validation
- remediation recommendations and selection guards
- exact four-check validation gate that fails closed on missing/duplicate checks
- domain errors for invalid and unsafe paths
- source tests for positive, negative and bypass paths

### PASS 2 — Database & Synthetic Scenario ✅
- PostgreSQL/Prisma models for Application, Release, Incident, DiagnosticLog, ApiRequest, SyntheticTransaction, ValidationCheck and AuditEvent
- enum-backed persisted workflow/release/validation states
- migration SQL with foreign keys, cascade semantics, uniqueness constraints and access-pattern indexes
- deterministic synthetic seed with correlated `APP-2047`, `TX-90842`, `req_tx_8f31` evidence
- exactly four canonical required validation checks, reset to `PENDING`
- atomic scenario reset implemented with a single PostgreSQL transaction
- reset deletes only the canonical synthetic application and relies on FK cascades for its evidence graph
- pre-write and post-write persistence invariant checks; a failed invariant rolls the whole reset back
- seed entrypoint via `npm run db:seed` / `npm run db:reset`
- unit-test source for deterministic seed, correlation integrity, validation completeness and bypass rejection


### PASS 3 — Guarded API Vertical Slice ✅
- 8 read endpoints for dashboard, incident, logs, requests, transactions, releases, validation and audit
- 7 POST endpoints for investigate, evidence-backed regression confirmation, remediation selection, rollback, validation, resolution and deterministic reset
- no generic client-controlled status mutation endpoint
- persisted root-cause evidence is derived server-side before domain confirmation
- remediation payload validated with Zod; malformed JSON has a controlled 400 boundary
- every workflow mutation runs inside one Prisma transaction
- compare-and-set status writes prevent stale concurrent requests from silently advancing state
- matching audit event(s) are persisted in the same transaction as the state change
- rollback is a compound atomic command that restores the stable release and adds synthetic recovery evidence
- validation derives all four checks from persisted recovery evidence; the client cannot submit PASS results
- API/domain errors mapped to stable 400/404/409/500 response envelopes
- source-level tests added for persisted-evidence mapping and validation derivation


### PASS 4 — Database-backed Backend MVP Gate ✅ implementation / conditional runtime gate
- real Prisma/PostgreSQL integration suite added in `tests/integration/applicationops.db.test.ts`
- 1 complete guarded golden-path test across reset → investigate → confirm regression → remediation → rollback → validation → resolve
- 6 negative/transactional tests covering early rollback, unsupported remediation, early validation, early resolve, mid-rollback persistence conflict and deterministic reset
- final-state assertions cover incident, release pair, application health/error rate, recovery transaction, 4/4 validation and audit sequence
- rollback conflict test verifies state/audit writes roll back together on a late persistence conflict
- audit timestamps hardened to remain strictly monotonic per incident even when commands occur within the same millisecond
- `npm run test:integration:db` and `npm run backend:mvp:gate` scripts added
- offline relational fallback gate executed successfully: 7/7 PASS
- full Prisma/PostgreSQL execution remains a release gate because package registry access is unavailable and the connected Neon SQL adapter currently rejects its own argument schema

### PASS 5 — UI Skeleton ✅
- recruiter-facing single-route operations-console layout
- visible candidate disclaimer and synthetic-data boundary
- incident, release, diagnostics, remediation, validation, resolution and audit sections
- sticky section navigation and responsive desktop-first structure
- reusable UI components for disclaimer, metrics, section headings and workflow preview

### PASS 6 — Above-the-Fold Clarity ✅
- first viewport explains what happened, the reviewer's goal and why evidence-backed closure matters
- incident snapshot surfaces severity, degraded health, active release, error rate and failure code
- clear dominant `Review incident ↓` CTA with secondary release-evidence navigation
- five-step workflow preview establishes Investigate → Compare → Recover → Validate → Resolve
- release regression is visually explained before raw logs through previous/current release comparison and configuration diff
- no PASS 7 workflow mutations, API POST actions or client-side guided state were implemented


## Canonical synthetic scenario
- Incident: `APP-2047`
- Transaction: `TX-90842`
- Request: `req_tx_8f31`
- Stable release: `v2.7.4`, timeout 5000 ms, error rate 1.2%
- Problem release: `v2.8.0`, timeout 800 ms, error rate 14.8%
- Observed downstream latency: 1437 ms
- Failure: `UPSTREAM_TIMEOUT`, HTTP 504

## Guarded workflow

`OPEN → INVESTIGATING → REGRESSION_CONFIRMED → REMEDIATION_SELECTED → ROLLING_BACK → READY_FOR_VALIDATION → VALIDATED → RESOLVED`

PASS 3 API/application services use the guarded workflow commands exported from `@/lib/domain`. Mutation routes never accept a target incident status from the client; they read persisted state/evidence and invoke the appropriate guarded command before compare-and-set persistence.

## Persistence invariants

The database layer is prepared around these rules:

1. reset state is always `OPEN` with no preselected root cause/remediation/recovery;
2. `v2.8.0` is initially the active `DEGRADED` release and `v2.7.4` is `STABLE`;
3. request, transaction and diagnostic logs share the canonical correlation id;
4. all four canonical validation checks exist exactly once and are required + `PENDING` after reset;
5. the full synthetic reset is atomic; partial deletion/insertion is rolled back on failure;
6. future incident/release mutations must couple state change and audit write in the same database transaction.

## Database commands

After dependencies and a PostgreSQL `DATABASE_URL` are available:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run db:seed
```

`npm run db:reset` executes the same deterministic atomic reset contract as the seed.

## Safety boundaries
- synthetic data only
- no real customer, account, card, IBAN or transaction data
- no connection to Intesa or banking APIs
- no arbitrary SQL or shell execution
- no claim of representing internal architecture or processes

## Verification note

PASS 0–3 retain their previous source/domain verification. PASS 4 adds the real Prisma/PostgreSQL integration-test source and a separately executed relational transaction harness. The PASS 4 source passes a TypeScript syntax/type-structure compile using temporary shims for unavailable external packages. The fallback relational database gate executed 7/7 scenarios successfully.

A full Prisma/PostgreSQL runtime execution is still not claimed in this environment: `registry.npmjs.org` cannot be resolved, no local PostgreSQL server is installed, and the connected Neon SQL execution tools currently reject the connector's own camelCase arguments in favor of undocumented snake_case parameters. A dedicated Neon project was provisioned for ApplicationOps, but no schema/data were applied through the broken SQL adapter.

Therefore PASS 4 is **implemented** and the backend MVP is a **conditional GO for UI work**, while real Prisma generation + PostgreSQL migration + Vitest integration execution remain a hard CI/release gate before repository publication or final application submission.

See `PASS_2_REPORT.md`, `PASS_3_REPORT.md`, `PASS_4_REPORT.md` and `API_CONTRACT.md` for exact boundaries.

## Planned next phase

PASS 7 wires the guided interaction workflow onto the completed PASS 5–6 presentation shell. PostgreSQL runtime verification remains tracked as a release blocker and must be closed before the final live/repository gate.

## PASS 5 + PASS 6 UI audit hardening

The PASS 5/6 interface was audited before guided interaction work. The hardened initial state now preserves a single start path, does not pre-confirm root cause or pre-select rollback, reduces mobile pre-task scroll depth, improves secondary-text contrast and keyboard focus treatment, and keeps PASS 7 interaction scope untouched. See `PASS_5_PASS_6_UI_AUDIT.md` and `PASS_6_UI_AUDIT_OUTPUT.txt`.

## PASS 7 — Guided Interaction Workflow ✅

PASS 7 now wires the audit-hardened presentation shell to the existing guarded API. A fixed five-step controller advances only through persisted domain states, progressively reveals release/diagnostic/remediation/validation/resolution sections, refreshes validation + audit evidence after each action, and exposes deterministic reset after resolution.

The browser does not calculate root cause, validation success or arbitrary target status; those remain server/domain responsibilities. PASS 8-specific release/root-cause evidence expansion has not been started. See `PASS_7_REPORT.md`, `PASS_7_GATE_OUTPUT.txt` and `PASS_7_WORKFLOW_SMOKE_OUTPUT.txt`.

### Next phase

PASS 8 — Release Comparison & Root-Cause Evidence. Do not treat PASS 7 as a browser/runtime release gate; full npm, PostgreSQL, production build and visual QA remain pending before publication.

## PASS 8 — Release Comparison & Root-Cause Evidence ✅

PASS 8 separates observable release correlation from the persisted root-cause decision. The release comparison now surfaces timing, configuration and latency signals without hard-coding the answer. The root-cause checkpoint stays in `HYPOTHESIS OPEN` until the server has persisted the exact qualifying regression code and explanation; the browser does not run the domain root-cause engine itself.

The Step 2 CTA was hardened from outcome-leading `CONFIRM RELEASE REGRESSION` to neutral `EVALUATE RELEASE EVIDENCE`. After the server evaluates the evidence, the guided flow lands on the persisted root-cause checkpoint before remediation.

Dedicated PASS 9 logs/request/data correlation components were not introduced. See `PASS_8_REPORT.md`, `PASS_8_GATE_OUTPUT.txt`, `PASS_8_EVIDENCE_SMOKE_OUTPUT.txt` and `PASS_8_UI_TS_COMPILE_OUTPUT.txt`.

### Next phase

PASS 9 — Logs, Request & Data Correlation. Full npm/PostgreSQL/build/browser release gates remain pending before publication.


## PASS 9 — Logs + Request + Data Correlation ✅

PASS 9 replaces the static diagnostics shell with a persisted read-only evidence trail. The guided provider now hydrates logs, HTTP requests and synthetic transaction records from the existing API, while `lib/ui/diagnostic-correlation.ts` fail-closes the trail as `COMPLETE`, `PARTIAL` or `MISMATCH`.

The canonical failure is linked as `v2.8.0 → req_tx_8f31 → 1437 ms latency → UPSTREAM_TIMEOUT / HTTP 504 → TX-90842 FAILED`. Later recovery records are ignored when constructing the original failure trail. Correlation is presented as investigation evidence, not as an independent causal conclusion; root-cause confirmation remains server/domain-owned.

PASS 10 remediation-decision work has not been introduced. See `PASS_9_REPORT.md`, `PASS_9_GATE_OUTPUT.txt`, `PASS_9_CORRELATION_SMOKE_OUTPUT.txt`, `PASS_9_CORRELATION_TS_COMPILE_OUTPUT.txt` and `PASS_9_UI_TS_COMPILE_OUTPUT.txt`.

### Next phase

PASS 10 — Remediation Decision. Full npm/PostgreSQL/build/browser release gates remain pending before publication.

## PASS 10 — remediation decision

PASS 10 turns the remediation shell into an evidence-led decision surface. The reviewer can inspect all four candidate responses, compare risk and evidence fit, and record the supported decision only after the persisted release regression is confirmed.

Key boundaries:

- no remediation is preselected;
- unsupported actions remain reviewable but cannot be recorded as the successful path;
- `ROLLBACK_RELEASE` is recorded through the existing guarded remediation endpoint;
- the browser does not recompute root cause or mutate incident status directly;
- rollback execution is intentionally not triggered by the PASS 10 UI. Recovery remains a separate controlled action for the next pass.


## PASS 11 — controlled rollback + recovery

PASS 11 separates remediation decision from execution. After `ROLLBACK_RELEASE` is persisted, the guided controller executes the existing guarded `/rollback` command. The backend transaction moves the affected release to `ROLLED_BACK`, restores v2.7.4 as active, changes synthetic service health to `HEALTHY`, records the recovered error-rate state, appends rollback audit events, and creates synthetic recovery request/transaction/log evidence.

The UI shows a before/after service-state comparison and fails closed if any persisted recovery evidence is missing. It intentionally stops at `READY_FOR_VALIDATION`; PASS 12 validation is not executed by the guided UI in this pass.

## PASS 12 — recovery validation gate

PASS 12 activates the explicit recovery-validation stage without advancing into incident resolution. The guided Step 4 action now calls the existing guarded `POST /api/incidents/APP-2047/validation/run` endpoint and stops when the incident reaches `VALIDATED`.

The four canonical checks are derived from persisted post-rollback evidence rather than browser-authored success state:

1. `stable-release` — v2.7.4 is active + `STABLE`, v2.8.0 is `ROLLED_BACK`, the incident records v2.7.4 as recovered, and service health is `HEALTHY`;
2. `error-rate` — persisted synthetic error rate is strictly below the configured 5% validation threshold;
3. `synthetic-transaction` — the exact persisted `req_tx_recovery` request returned HTTP 200 and `TX-90843` succeeded on v2.7.4 without a failure code;
4. `timeout-errors` — no new `UPSTREAM_TIMEOUT` ERROR log exists after the persisted `ROLLBACK_COMPLETED` boundary.

The UI intentionally separates **evidence readiness** from **persisted validation**. Before the command runs it may show 4/4 evidence conditions ready while all canonical checks remain `PENDING`. Only the server transaction can persist the four `PASS` statuses, move `READY_FOR_VALIDATION → VALIDATED`, and append `VALIDATION_STARTED` + `VALIDATION_PASSED` audit events.

The validation view fails closed on missing/duplicate canonical checks, missing validation audits, incomplete recovery evidence, or a post-rollback timeout recurrence. PASS 12 does not call `/resolve`; the fixed controller stops at `VALIDATION COMPLETE` and keeps resolution as a separate explicit next stage.

Verification in this environment:

- `PASS12_RECOVERY_VALIDATION_GATE_PASS` — 40/40 static/source/scope checks;
- `PASS12_RECOVERY_VALIDATION_SMOKE_PASS` — executable pure TypeScript evidence/state smoke;
- selected recovery-validation pure TypeScript compile — PASS;
- selected service TypeScript compile with temporary external-package shims — PASS;
- selected UI/provider/controller TypeScript compile with temporary React shims — PASS;
- selected unit-test source TypeScript compile with temporary Vitest shim — PASS;
- prior relational backend regression harness — 7/7 PASS;
- secret-pattern scan — PASS.

A real dependency-backed Prisma/PostgreSQL/Vitest/Next production run is still not claimed in this environment and remains a release gate before public repository/deployment/application use.

### Next phase

PASS 13 — Resolution & Business Handoff. The guided workflow must keep validation and final incident closure as separate actions.

## PASS 13 — resolution + business handoff

PASS 13 activates the final explicit `VALIDATED → RESOLVED` workflow action without starting Presentation Mode. Step 5 now calls the existing guarded `/resolve` endpoint only after the server has persisted 4/4 validation.

Closure is evidence-derived and fail-closed. The server re-reads persisted root cause, selected remediation, restored release/application state, recovery request + transaction evidence, validation checks and validation audit events. Only a complete internally consistent evidence set can generate and persist:

- `closureTechnicalSummary` — detailed root-cause, correlated failure, rollback and validation handoff for a technical reviewer;
- `closureBusinessSummary` — concise stakeholder-facing closure wording without raw implementation detail.

Both summaries are persisted atomically with `VALIDATED → RESOLVED`, `RESOLUTION_HANDOFF_CREATED` and `INCIDENT_RESOLVED`. A post-validation drift such as service health returning to `DEGRADED` produces `RESOLUTION_EVIDENCE_INCOMPLETE` and leaves the incident `VALIDATED` with no partial closure artifacts.

The resolution UI has fail-closed `LOCKED`, `READY`, `RESOLVED` and `INCONSISTENT` modes. A resolved view requires the two persisted summaries to exactly match the deterministic evidence-derived handoff and requires both closure audit events. The browser cannot author the summaries or set the incident status directly.

PASS 14 Presentation Mode has not been implemented in this pass. Full dependency-backed Prisma/PostgreSQL/Vitest/Next/browser verification remains a release gate before publication.

### Next phase

PASS 14 — Recruiter Presentation Mode. Preserve the real repository implementation while providing a deterministic public walkthrough that does not depend on live database availability.

## PASS 14 — Recruiter Presentation Mode ✅

PASS 14 adds a recruiter-safe live runtime that is **independent of PostgreSQL** while preserving the database-backed implementation for technical review.

### Default live runtime

If `NEXT_PUBLIC_APPLICATIONOPS_RUNTIME` is unset, ApplicationOps runs in:

```text
presentation
```

The five-step walkthrough uses deterministic synthetic React/browser state only. Initial page load, investigation, evidence evaluation, remediation selection, controlled rollback, recovery validation, resolution and reset do **not** call the API or require `DATABASE_URL`.

The live UI displays an explicit **Recruiter Presentation Mode** disclosure so the reliability mechanism is transparent rather than pretending that browser state is a production backend.

### Optional database-backed runtime

For technical review of the real API/Prisma implementation:

```bash
NEXT_PUBLIC_APPLICATIONOPS_RUNTIME=server
DATABASE_URL=postgresql://...
npm run dev
```

In that mode the existing guarded API, Prisma transactions, migrations and PostgreSQL evidence model remain available exactly as implemented in PASS 0–13.

### Presentation-mode workflow

The browser presentation engine preserves the same five-stage reasoning path:

```text
OPEN
→ INVESTIGATING
→ REGRESSION_CONFIRMED
→ REMEDIATION_SELECTED
→ ROLLING_BACK
→ READY_FOR_VALIDATION
→ VALIDATED
→ RESOLVED
```

It also preserves the same synthetic correlation set:

```text
v2.8.0
→ req_tx_8f31
→ UPSTREAM_TIMEOUT / HTTP 504
→ TX-90842 FAILED
→ rollback to v2.7.4
→ req_tx_recovery / HTTP 200
→ TX-90843 SUCCEEDED
→ validation 4/4 PASS
```

The presentation engine intentionally rejects unsupported remediation, prevents premature validation/resolution, produces the same deterministic technical + business closure handoff, and resets to the canonical initial state.

### PASS 14 verification

- `PASS14_PRESENTATION_MODE_GATE_PASS` — 45/45 source/scope checks
- `PASS14_PRESENTATION_WORKFLOW_SMOKE_PASS` — executable pure TypeScript/JavaScript five-step walkthrough to `RESOLVED`
- presentation-state strict TypeScript compile — PASS
- selected provider/controller/presentation UI TypeScript compile with temporary React shims — PASS
- no Prisma, `DATABASE_URL` or fetch dependency exists inside the pure presentation-state module
- PASS 15 CI/repository hardening was not started

This pass does **not** claim final deployment, full npm dependency verification, production Next build, real PostgreSQL integration, browser-device QA or dependency audit. Those remain PASS 15+ release gates.

### Next phase

PASS 15 — CI & Repository Hardening. Keep Presentation Mode as the default recruiter runtime, then close the dependency/build/test/security gates before public deployment.


## PASS 15 — CI + Repository Hardening

PASS 15 turns the implementation into a reproducible repository gate without publishing or deploying it. The repository now uses a committed npm lockfile, Node 22/npm 10 runtime constraints, a two-job GitHub Actions workflow, weekly npm Dependabot updates, a PostgreSQL 18 integration job, and explicit dependency hardening for security-sensitive transitive packages.

The default live build remains Presentation Mode. The CI build still generates Prisma so the database-backed source remains type/build valid, but it does not require a live database connection. Real PostgreSQL behavior is tested separately against a PostgreSQL 18 service after applying committed migrations.

PASS 15 does **not** perform the final candidate/recruiter audit, publish a GitHub repository, or deploy the demo. Those remain explicit later approval gates.
