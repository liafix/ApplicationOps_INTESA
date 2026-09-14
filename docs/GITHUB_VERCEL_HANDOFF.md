# GitHub → Vercel Handoff

## Repository

Recommended public repository name:

`applicationops-intesa-candidate-demo`

The repository root should be the root of this ZIP (the folder containing `README.md`, `vercel.json`, `recruiter-demo/`, `app/`, `lib/`, etc.).

## GitHub

The default push/PR workflow is `.github/workflows/recruiter-demo.yml`.

It does **not** install npm dependencies. It runs:

- Node syntax checks
- dependency-free recruiter-demo state tests
- static release validation
- recruiter-demo build
- secret scan

The dependency-backed Next.js/Prisma engineering workflow is preserved as **manual-only** in `.github/workflows/ci.yml`.

## Vercel

Import the GitHub repository as a new Vercel project.

No environment variables are required for the public recruiter demo.

`vercel.json` already configures:

- no npm dependency installation (`node --version` only)
- build command: `node scripts/build-recruiter-demo.mjs`
- output directory: `dist`
- static security headers

Do not configure `DATABASE_URL` for the recruiter deployment.

## Post-deploy smoke check

The public page should:

1. load with `ApplicationOps — Release & Incident Support Console`;
2. show `APP-2047`, `DEGRADED`, v2.8.0 and 14.8%;
3. complete five explicit actions;
4. end at `RESOLVED`;
5. show 4/4 validation;
6. show technical + business handoff;
7. show `INCIDENT RESOLVED` in the audit trail;
8. retain the synthetic/candidate disclaimer.

Only after this smoke check should the live Vercel URL be added to the CV.
