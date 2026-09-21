# ApplicationOps — PASS 0 + PASS 1 MVP Audit

## Audit verdict

PASS 0 + PASS 1 had a sound direction but was **not safe to carry unchanged into persistence/API work**. The audit found two domain blockers and one dependency-security blocker. All three are fixed in this hardened source snapshot.

## Blockers found and fixed

### B1 — Validation gate could be bypassed with an incomplete check set — FIXED
The original `allRequiredValidationPassed()` only checked the required checks that happened to be supplied. A caller could provide a single required `PASS` check and receive `true`.

Hardening:
- canonical validation IDs are typed
- all four canonical checks must exist exactly once
- every canonical check must be required and PASS
- duplicate IDs fail closed
- any additional required check must also PASS
- pending checks are created by a factory, eliminating shared mutable global objects

### B2 — Release rollback helpers had no transition guards — FIXED
The original `startRollback()` / `completeRollback()` returned states without validating their input. Persistence/API code could therefore create impossible release state transitions.

Hardening:
- introduced `ReleasePairState`
- rollback starts only from `DEGRADED + STABLE + active CURRENT`
- completion is allowed only from `ROLLING_BACK`
- active release moves to `PREVIOUS` only after completion
- invalid transitions throw `INVALID_RELEASE_TRANSITION`

### B3 — PostCSS 8.5.6 is below current security fixes — FIXED IN MANIFEST
The source pinned PostCSS 8.5.6. Current 2026 advisories affect versions through 8.5.22, including a HIGH path-traversal/source-map disclosure issue. The manifest is now pinned to PostCSS 8.5.26.

A fresh lockfile and `npm audit` still require registry access and remain a release/CI gate, not a PASS 2 domain blocker.

## High-priority weaknesses fixed

### Guarded workflow commands
A low-level sequential state machine alone does not enforce evidence. The public domain API now exposes guarded commands:
- `startInvestigation`
- `confirmReleaseRegression`
- `chooseRemediation`
- `beginRollback`
- `finishRollback`
- `validateRecovery`
- `resolveValidatedIncident`

The low-level `transitionIncident()` remains in its module for focused state-machine testing but is no longer re-exported from the domain barrel. PASS 2/3 services should use the guarded workflow functions.

### Root-cause evidence validation
Impossible numeric evidence (negative/NaN timings, fractional/negative error counts) is rejected before classification.

### Error taxonomy
Added precise error codes for invalid release transitions, invalid evidence, unsupported remediation and missing remediation selection. This prevents misleading API errors later.

### Remediation wording
Rollback is no longer labeled universally “LOW risk”. It is described as a controlled reversible action with MEDIUM change risk for this deterministic evidence set.

## Test hardening
Added source tests for:
- release-state invariants
- validation partial-set bypass
- duplicate validation IDs
- validation factory isolation
- invalid root-cause evidence
- full guarded workflow
- regression-confirmation guard

## Tooling hardening
- `next` remains pinned to 15.5.24
- `postcss` pinned to 8.5.26
- Node constrained to 22.x; `.nvmrc` added and `@types/node` aligned to the Node 22 line
- npm constrained to 10.x and package manager declared
- `build` now runs `prisma generate` first
- `quality` and `security:audit` scripts added
- CSP gains `object-src 'none'`

## Remaining gates before release
These are **not blockers for starting PASS 2**, but must be closed before GitHub/production release:
1. generate and commit `package-lock.json`
2. run `npm ci`
3. run production dependency audit
4. run ESLint, full TypeScript typecheck and Vitest
5. run production build

The current execution environment could not reliably reach the npm registry, so those package-backed gates are not claimed as passed.

## Verification performed after hardening

Without installing external packages, the hardened domain layer was compiled with strict TypeScript and executed through a standalone Node smoke path covering:
- root-cause classification
- guarded incident progression
- remediation selection
- guarded rollback start/completion
- incomplete validation bypass rejection
- duplicate validation rejection
- successful 4/4 validation and resolution
- invalid numeric evidence rejection
- invalid release transition rejection

Result: `AUDIT_HARDENED_DOMAIN_SMOKE_PASS`.

A static secret/PII-pattern scan of the source found no embedded credentials or real banking/customer data.
