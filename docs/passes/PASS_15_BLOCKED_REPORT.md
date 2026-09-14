# PASS 15 — Source Reconciliation / Network-Gate Blocked Report

Date: 2026-09-06

## Verdict

**PASS 15 remains INCOMPLETE / NETWORK GATE BLOCKED.**

This report intentionally does not claim RELEASE GREEN. Final Candidate Audit has not been started.

## Uploaded baseline inspection

The supplied working ZIP was not the final green PASS 15 source snapshot:

- `package-lock.json` was missing;
- `@prisma/client` and `prisma` were `6.19.0` instead of the checkpointed `6.12.0`;
- `vitest` was `3.2.4` instead of the checkpointed `3.2.7`;
- the repository otherwise already contained the PASS 15 CI workflow, Dependabot configuration,
  security/CI documentation, the PASS 13 closure migration and the guarded rollback transaction fix.

## Source reconciled in this artifact

The known green source-level PASS 15 state was restored without inventing execution results:

- `@prisma/client` = `6.12.0`;
- `prisma` = `6.12.0`;
- `vitest` = `3.2.7`;
- `postcss` = `8.5.26` and override retained;
- `next-env.d.ts` is explicitly ignored by ESLint;
- the PASS 13 closure migration is present;
- PASS 15 repository gate now asserts the hardened Prisma/Vitest/PostCSS versions and the PASS 13 migration.

The repository gate after reconciliation is **30/31 PASS**. The only failing repository invariant is
`package-lock committed`.

## Real PostgreSQL evidence obtained

Read-only SQL was executed against the dedicated Neon PASS 15 integration branch only.

A separate empty database, `applicationops_pass15_ci`, was then created inside that same dedicated branch for the eventual clean Prisma migration/integration run. It was verified to contain **0 public tables** before execution. No main/production database was modified.

Verified:

- managed PostgreSQL responds;
- PostgreSQL version is 18.6;
- all eight expected ApplicationOps tables are present;
- both PASS 13 closure columns are present in the pre-existing `neondb` schema;
- `applicationops_pass15_ci` exists as a clean 0-table target for `prisma migrate deploy`.

However `public._prisma_migrations` is not present. Connector SQL availability and existing relational
state are explicitly **not** treated as equivalent to the required Prisma/PostgreSQL integration run.

## Why the mandatory DB gate could not be closed in this runtime

The execution sandbox has the exact required runtime:

- Node `v22.16.0`;
- npm `10.9.2`.

But outbound DNS/network access is unavailable in this runtime:

- npm registry probe fails with `EAI_AGAIN` for `registry.npmjs.org`;
- direct DNS resolution of the dedicated Neon compute host fails with temporary name-resolution failure.

Therefore this runtime cannot truthfully perform:

1. regeneration/recovery of the real npm lockfile;
2. `npm ci` from that lockfile;
3. direct Prisma connection to the dedicated Neon branch;
4. `prisma migrate deploy` execution proof;
5. `tests/integration/applicationops.db.test.ts` real PostgreSQL execution;
6. the fresh npm security audit.

This is a **NETWORK GATE BLOCKED** condition, not a vulnerability finding and not a PostgreSQL schema failure.

## Integration suite status

The current source contains nine real DB integration tests, covering all seven required categories plus
two additional recovery-evidence/drift safeguards. They were inspected but **not executed in this sandbox**.
No 7/7 or 9/9 execution claim is made.

## Security statement

A source secret-pattern scan found no Neon password token, private key, or high-entropy secret-assignment
match in the reconciled source. `.env.example` contains only local placeholder credentials.

The checkpoint records a previous successful `npm audit --audit-level=high` with zero vulnerabilities,
but this report does not present that historical result as a fresh audit. A fresh audit remains required
for PASS 15 completion.

## Required remaining gate

PASS 15 can become RELEASE GREEN only in an execution environment with npm registry and PostgreSQL
connectivity, using the dedicated PASS 15 Neon branch, after all of the following succeed on this reconciled source:

- generate/recover real `package-lock.json` with Node 22.16.0 / npm 10.9.2;
- `npm ci`;
- `format:check`;
- `prisma generate`;
- `prisma validate`;
- `prisma migrate deploy`;
- real `tests/integration/applicationops.db.test.ts` execution;
- lint;
- typecheck;
- 84/84 unit tests (or an explicitly explained intentional count change);
- production build;
- `npm audit --audit-level=high` with no high/critical vulnerabilities;
- final secret-clean source ZIP and SHA-256.

Until then there must be no `PASS 15 = COMPLETE / RELEASE GREEN` claim.

## 2026-09-06 runner follow-up

A network-runner plugin was connected successfully at the ChatGPT product level, but its executable tool namespace was not exposed to the active tool runtime. The local execution sandbox remained unable to resolve the npm registry or the Neon hostname. No execution result was invented from the connection state.

Additional fail-closed release tooling was added:

- `scripts/pass15_finalize_linux.sh` for Linux/network runners;
- existing Windows finalizer retained;
- both require the exact Node/npm versions and the dedicated `applicationops_pass15_ci` target;
- both create the final report/archive only after real execution gates pass;
- stale blocked-report text is excluded from a successful final archive.

The Linux finalizer passed shell syntax validation. An attempted local invocation reached lockfile generation and then timed out on the blocked npm network path, so no final report or final ZIP was emitted.

## Secret-scan hardening correction

The first runner-ready packaging scan produced a false positive because it treated credentialed localhost PostgreSQL fixture URLs in `.env.example`, CI, and historical scope evidence as remote secrets. No Neon credential was found. The release scanner was corrected to allow explicit localhost/loopback test fixtures while still rejecting Neon token patterns, credentialed remote PostgreSQL URLs, private keys, and non-example `.env*` files. The corrected source scan passes.
