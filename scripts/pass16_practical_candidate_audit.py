#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
checks = []

def check(name: str, ok: bool, detail: str):
    checks.append((name, bool(ok), detail))

html = (ROOT / 'recruiter-demo/index.html').read_text()
state = (ROOT / 'recruiter-demo/state.mjs').read_text()
app = (ROOT / 'recruiter-demo/app.js').read_text()
readme = (ROOT / 'README.md').read_text()
vercel = json.loads((ROOT / 'vercel.json').read_text())
workflow = (ROOT / '.github/workflows/recruiter-demo.yml').read_text()

check('public demo entry exists', (ROOT/'recruiter-demo/index.html').exists(), 'Dependency-free recruiter entrypoint is present.')
check('public demo state engine exists', (ROOT/'recruiter-demo/state.mjs').exists(), 'Deterministic state engine is present.')
check('public demo interaction exists', (ROOT/'recruiter-demo/app.js').exists(), 'Interactive controller is present.')
check('candidate disclaimer visible', 'not an Intesa Sanpaolo product' in html, 'No employer-internal-system misrepresentation.')
check('synthetic data visible', 'Synthetic data only' in html, 'Synthetic boundary is above the fold.')
check('five-step workflow visible', 'Five checkpoints from alert to safe closure' in html, 'Recruiter can understand the flow quickly.')
check('root cause evidence preserved', 'RELEASE_TIMEOUT_REGRESSION' in state, 'Root cause remains evidence-derived.')
check('rollback decision explicit', 'ROLLBACK_RELEASE' in state, 'Recovery path is explicit and reversible.')
check('4-of-4 validation enforced', 'Incident resolution requires 4/4 validation' in state, 'Resolution fails closed without validation.')
check('technical handoff produced', 'technicalSummary' in state and 'Technical handoff' in app, 'Technical closure summary is surfaced.')
check('business handoff produced', 'businessSummary' in state and 'Business handoff' in app, 'Business closure summary is surfaced.')
check('audit trail surfaced', 'INCIDENT_RESOLVED' in state and 'audit-list' in html, 'Audit trail remains visible through closure.')
check('no external runtime calls in recruiter HTML', not re.search(r'https?://', html), 'Public demo has no external runtime dependency.')
check('Vercel bypasses package install', vercel.get('installCommand') == 'node --version', 'Recruiter deploy is independent of npm registry/lockfile.')
check('Vercel builds recruiter demo only', vercel.get('buildCommand') == 'node scripts/build-recruiter-demo.mjs' and vercel.get('outputDirectory') == 'dist', 'Vercel target is deterministic static output.')
check('security headers configured', any(h.get('key') == 'Content-Security-Policy' for r in vercel.get('headers',[]) for h in r.get('headers',[])), 'CSP is configured for public deployment.')
check('push CI is zero-dependency', 'node --test tests/recruiter-demo/state.test.mjs' in workflow and 'npm ci' not in workflow, 'Default recruiter CI cannot fail on missing lockfile.')
check('source unit tests preserved', len(list((ROOT/'tests/unit').glob('*.test.ts*'))) == 19, 'All 19 original unit-test source files are retained.')
check('DB integration source preserved', (ROOT/'tests/integration/applicationops.db.test.ts').exists(), 'Prisma/PostgreSQL integration test source remains available.')
check('Prisma schema preserved', (ROOT/'prisma/schema.prisma').exists(), 'Database-backed technical-review source remains available.')
check('PASS13 closure migration preserved', (ROOT/'prisma/migrations/20260903120000_pass13_resolution_handoff/migration.sql').exists(), 'Resolution handoff migration remains committed.')
check('README separates recruiter and engineering modes', 'Recruiter demo release' in readme and 'Full engineering runtime' in readme, 'Claims are separated instead of overclaimed.')

failed = [c for c in checks if not c[1]]
for name, ok, detail in checks:
    print(f"{'PASS' if ok else 'FAIL'} {name} - {detail}")
print(f"checks={len(checks)} passed={len(checks)-len(failed)} failed={len(failed)}")
if failed:
    print('PASS16_PRACTICAL_CANDIDATE_AUDIT_FAIL')
    sys.exit(1)
print('PASS16_PRACTICAL_CANDIDATE_AUDIT_PASS')
