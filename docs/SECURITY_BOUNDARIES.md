# Security boundaries

ApplicationOps is a synthetic candidate demonstrator.

- No real customer, account, card, IBAN, payment, or bank-system data is used.
- No external bank API is contacted.
- Presentation Mode is browser-only synthetic state.
- Database-backed mode uses only the committed synthetic scenario.
- Client code cannot set arbitrary incident status, root cause, validation PASS, or closure summaries.
- Dependency versions are lockfile-pinned for CI and audited at high severity.
- PostCSS and Sharp are explicitly overridden to patched dependency lines because older transitive versions have had security advisories.
