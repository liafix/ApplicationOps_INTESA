# CI and release gates

ApplicationOps uses two independent CI jobs.

- **Quality / Build / Security** installs the committed lockfile with `npm ci`, validates repository invariants, checks formatting, generates and validates Prisma, runs ESLint, TypeScript, unit tests, a production Presentation Mode build, and a high-severity dependency audit.
- **PostgreSQL Integration** starts PostgreSQL 18, applies the committed migrations, and executes the real database-backed golden-path and negative-path suite.

The default live Presentation Mode does not need PostgreSQL at runtime. PostgreSQL exists to prove the separate technical implementation and transactional invariants.
