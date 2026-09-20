# ApplicationOps — Release & Incident Support Console

**Independent candidate demonstrator for an Application Support Associate application.**

ApplicationOps models a deterministic, synthetic release incident from alert to safe closure:

`OPEN → INVESTIGATING → REGRESSION_CONFIRMED → REMEDIATION_SELECTED → ROLLING_BACK → READY_FOR_VALIDATION → VALIDATED → RESOLVED`

> **Safety boundary:** this is not an Intesa Sanpaolo product, internal system, architecture representation, or real banking environment. It uses public role/company context and synthetic data only.

## Recruiter demo — default deployment path

The public recruiter demo is intentionally **zero-dependency at deploy time**. It lives in `recruiter-demo/`, runs fully in the browser, and does not require PostgreSQL, environment secrets, npm registry access, or external APIs.

The five-step walkthrough demonstrates:

1. **Investigate** — correlate deployment timing, failed request and timeout evidence.
2. **Confirm regression** — compare v2.7.4 and v2.8.0 and confirm the evidence-supported timeout regression.
3. **Choose remediation** — record a reversible rollback decision; unsupported production-data mutation remains rejected.
4. **Recover & validate** — restore v2.7.4, record synthetic recovery evidence, and require all **4/4** validation checks.
5. **Resolve** — produce separate technical/business handoff summaries and an audit-trail-backed explicit closure.

### Zero-dependency local verification

These commands use Node built-ins only; no package installation is required:

```bash
node --test tests/recruiter-demo/state.test.mjs
node scripts/validate-recruiter-demo.mjs
node scripts/build-recruiter-demo.mjs
```

### Vercel

`vercel.json` deliberately bypasses dependency installation for the recruiter deployment and builds only the browser-safe demo:

- install: Node runtime check only
- build: `node scripts/build-recruiter-demo.mjs`
- output: `dist/`
- external runtime services: none

This keeps the CV/demo link reliable even if the optional engineering stack is not provisioned.

## Engineering implementation — preserved in the repository

The original implementation remains in the repository for technical review:

- Next.js + React + TypeScript UI
- guarded domain/state-machine logic
- Prisma/PostgreSQL persistence implementation
- API routes for incident evidence and guarded workflow actions
- unit test source
- real PostgreSQL integration test source
- migrations, CI definitions, security boundaries and historical PASS evidence

The database-backed mode is optional and separate from the recruiter live deployment. It requires a valid `DATABASE_URL` and installed npm dependencies.

## Canonical synthetic scenario

| Signal                      | Value                                                   |
| --------------------------- | ------------------------------------------------------- |
| Incident                    | `APP-2047`                                              |
| Failed transaction          | `TX-90842`                                              |
| Failed request              | `req_tx_8f31`                                           |
| Stable release              | `v2.7.4`                                                |
| Problem release             | `v2.8.0`                                                |
| Timeout change              | `5000 ms → 800 ms`                                      |
| Observed downstream latency | `1437 ms`                                               |
| Synthetic error rate        | `1.2% → 14.8%`                                          |
| Failure                     | `UPSTREAM_TIMEOUT / HTTP 504`                           |
| Recovery                    | rollback to `v2.7.4`, error rate `1.1%`, 4/4 validation |

## Repository layout

- `recruiter-demo/` — dependency-free public demo used by Vercel
- `tests/recruiter-demo/` — Node built-in state-machine tests for the public demo
- `app/`, `components/`, `lib/` — original Next.js implementation
- `prisma/` — schema and committed migrations
- `tests/unit/` — original unit test source
- `tests/integration/` — Prisma/PostgreSQL integration suite source
- `docs/` — CI/security docs and historical engineering evidence
- `.github/workflows/recruiter-demo.yml` — default push/PR gate for the public demo
- `.github/workflows/ci.yml` — optional/manual full engineering CI requiring npm dependencies + lockfile

## Verification policy

The repository distinguishes two claims:

### Recruiter demo release

Can be independently verified with Node only. It is the default GitHub/Vercel release path.

### Full engineering runtime

Requires npm registry access, a dependency lockfile, Prisma generation and a PostgreSQL target. Historical evidence and source are preserved, but the public demo does **not** pretend that a browser walkthrough is equivalent to a production banking backend.

## Candidate value

The project is meant to show the reasoning expected in application support rather than imitate a real bank system: correlate evidence, avoid premature root-cause claims, prefer reversible recovery, validate after remediation, and keep a clear audit trail through closure.
