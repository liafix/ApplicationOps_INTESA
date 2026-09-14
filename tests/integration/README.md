# Database-backed backend MVP gate

`applicationops.db.test.ts` executes the actual ApplicationOps service layer against the configured Prisma/PostgreSQL database.

The suite covers:

- complete guarded golden path,
- final release/application/incident persistence,
- 4/4 validation persistence,
- append-only ordered audit evidence,
- rollback-before-evidence rejection,
- unsupported remediation rejection,
- validation-before-rollback rejection,
- resolution-before-validation rejection,
- transactional rollback on persisted release conflict,
- deterministic full scenario reset after completion.

Run only against a disposable test database:

```bash
DATABASE_URL="postgresql://...test..." npm run test:integration:db
```

The suite calls the real Prisma-backed reset before every test. Never point it at production data.
