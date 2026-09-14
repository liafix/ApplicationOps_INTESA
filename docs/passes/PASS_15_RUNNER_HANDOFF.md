# PASS 15 — Network Runner Handoff

Status: **execution pending; not RELEASE GREEN**.

Use only the dedicated PASS 15 Neon target:

- project: `lively-lab-44822886`
- branch: `br-cool-dew-arbi7wvh` (`pass15-real-integration`)
- compute: `ep-plain-shape-ar1x8bmp`
- database: `applicationops_pass15_ci`

The database was created as a clean target and verified with zero public tables before the required migration run.
Do not use the Neon main branch or production data.

Required exact runtime:

- Node `v22.16.0`
- npm `10.9.2`

Provide `DATABASE_URL` only as a secure process/environment secret. Do not write it to files, logs, reports, shell history, or the release archive.

Run the fail-closed finalizer appropriate to the runner:

- Linux/macOS/network sandbox: `bash scripts/pass15_finalize_linux.sh`
- Windows PowerShell: `powershell -ExecutionPolicy Bypass -File scripts/pass15_finalize_windows.ps1`

The finalizer must stop on the first failed gate. It generates `PASS_15_FINAL_REPORT.md`, `ApplicationOps_PASS15_FINAL.zip`, and its SHA-256 only after all of these are proven in the same run:

1. exact Node/npm runtime;
2. real `package-lock.json` generated/recovered and lock consistency PASS;
3. `npm ci` PASS;
4. repository gate PASS;
5. formatting PASS;
6. Prisma generate + validate PASS;
7. committed migrations applied to `applicationops_pass15_ci`;
8. real PostgreSQL integration suite **9/9 PASS**, covering all seven required scenarios plus two recovery safeguards;
9. lint PASS;
10. typecheck PASS;
11. unit tests **19/19 files and 84/84 tests PASS**;
12. production build PASS;
13. fresh npm audit with **0 high / 0 critical** vulnerabilities;
14. secret-clean final staging and archive verification.

A registry/network timeout is `NETWORK GATE BLOCKED`, never a zero-vulnerability result.
Final Candidate Audit must not be started by this handoff.
