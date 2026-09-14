#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXPECTED_NODE='v22.16.0'
EXPECTED_NPM='10.9.2'
EXPECTED_DB='applicationops_pass15_ci'
EXPECTED_COMPUTE='ep-plain-shape-ar1x8bmp'

[[ "$(node -v)" == "$EXPECTED_NODE" ]] || { echo "Node mismatch: expected $EXPECTED_NODE, got $(node -v)" >&2; exit 1; }
[[ "$(npm -v)" == "$EXPECTED_NPM" ]] || { echo "npm mismatch: expected $EXPECTED_NPM, got $(npm -v)" >&2; exit 1; }
[[ -n "${DATABASE_URL:-}" ]] || { echo 'DATABASE_URL must be provided only through the process environment.' >&2; exit 1; }
[[ "$DATABASE_URL" == *"$EXPECTED_COMPUTE"* ]] || { echo 'Refusing DB gate: wrong Neon compute.' >&2; exit 1; }
[[ "$DATABASE_URL" =~ /${EXPECTED_DB}(\?|$) ]] || { echo 'Refusing DB gate: wrong database.' >&2; exit 1; }

EVIDENCE="$ROOT/docs/passes/evidence/pass15-final"
rm -rf "$EVIDENCE"
mkdir -p "$EVIDENCE"

run_gate() {
  local slug="$1"; shift
  echo "== $slug =="
  set +e
  "$@" 2>&1 | tee "$EVIDENCE/$slug.log"
  local rc=${PIPESTATUS[0]}
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "$slug failed with exit code $rc (see $EVIDENCE/$slug.log)" >&2
    exit "$rc"
  fi
}

{
  echo "Node=$(node -v)"
  echo "npm=$(npm -v)"
  echo "ExecutedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Database=$EXPECTED_DB"
  echo "Compute=$EXPECTED_COMPUTE"
} > "$EVIDENCE/runtime.txt"

if [[ ! -f package-lock.json ]]; then
  run_gate '01-generate-package-lock' npm install --package-lock-only --ignore-scripts --no-audit --no-fund
fi
run_gate '02-lock-check' npm run lock:check
run_gate '03-npm-ci' npm ci
run_gate '04-pass15-repository-gate' npm run pass15:gate
run_gate '05-format-check' npm run format:check
run_gate '06-prisma-generate' npm run prisma:generate
run_gate '07-prisma-validate' npm run prisma:validate
run_gate '08-prisma-migrate-deploy' npm run prisma:migrate:deploy
run_gate '09-postgresql-integration-tests' npm run test:integration:db
run_gate '10-lint' npm run lint
run_gate '11-typecheck' npm run typecheck
run_gate '12-unit-tests' npm test
run_gate '13-production-build' npm run build

echo '== 14-npm-audit =='
set +e
npm audit --audit-level=high --json > "$EVIDENCE/14-npm-audit.json" 2> "$EVIDENCE/14-npm-audit.stderr.log"
audit_rc=$?
set -e
if [[ $audit_rc -ne 0 ]]; then
  echo "npm audit failed with exit code $audit_rc; do not interpret this as 0 vulnerabilities." >&2
  exit "$audit_rc"
fi
node - <<'NODE'
const fs = require('node:fs');
const a = JSON.parse(fs.readFileSync('docs/passes/evidence/pass15-final/14-npm-audit.json','utf8'));
const v = a?.metadata?.vulnerabilities ?? {};
if ((v.high ?? 0) !== 0 || (v.critical ?? 0) !== 0) {
  console.error(`Security audit gate failed: high=${v.high ?? 'unknown'} critical=${v.critical ?? 'unknown'}`);
  process.exit(1);
}
console.log(`AUDIT_PASS high=${v.high ?? 0} critical=${v.critical ?? 0}`);
NODE

grep -Eq 'Test Files[[:space:]]+19 passed|19[[:space:]]+passed' "$EVIDENCE/12-unit-tests.log" || { echo 'Unit evidence missing 19 passed files.' >&2; exit 1; }
grep -Eq 'Tests[[:space:]]+84 passed|84[[:space:]]+passed' "$EVIDENCE/12-unit-tests.log" || { echo 'Unit evidence missing 84 passed tests.' >&2; exit 1; }
grep -Eq 'Tests[[:space:]]+9 passed|9[[:space:]]+passed' "$EVIDENCE/09-postgresql-integration-tests.log" || { echo 'Integration evidence missing 9 passed tests.' >&2; exit 1; }

for bad in node_modules .next .git .vercel coverage dist; do
  : # excluded from staging below
 done

if find . -type f \( -name '.env' -o -name '.env.*' \) ! -name '.env.example' -print -quit | grep -q .; then
  echo 'Secret env files are present in workspace.' >&2
  exit 1
fi

run_gate '15-secret-scan-workspace' python3 scripts/pass15_secret_scan.py --root .

LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
cat > PASS_15_FINAL_REPORT.md <<REPORT
# PASS 15 FINAL REPORT

Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)

Verdict: **PASS 15 = COMPLETE / RELEASE GREEN**

Runtime:
- Node v22.16.0
- npm 10.9.2

Database execution:
- dedicated PASS 15 Neon integration compute: \`$EXPECTED_COMPUTE\`
- dedicated clean database: \`$EXPECTED_DB\`
- committed Prisma migrations applied successfully
- real PostgreSQL integration suite: **9/9 PASS**
- required scenario coverage: golden path, early rollback rejection, unsupported remediation rejection, pre-rollback validation rejection, pre-4/4 resolution rejection, rollback atomicity conflict, deterministic reset
- additional safeguards: persisted recovery evidence tamper rejection and post-validation evidence-drift rejection

Release gates:
- package-lock generation/recovery: PASS
- lockfile consistency: PASS
- npm ci: PASS
- PASS 15 repository gate: PASS
- format:check: PASS
- prisma generate: PASS
- prisma validate: PASS
- prisma migrate deploy: PASS
- PostgreSQL integration: PASS (9/9)
- lint: PASS
- typecheck: PASS
- unit tests: **19/19 files, 84/84 tests PASS**
- production build: PASS
- npm audit high/critical: **0 high / 0 critical**
- secret-pattern scan: PASS

package-lock.json SHA-256: \`$LOCK_HASH\`

Raw gate evidence is stored under \`docs/passes/evidence/pass15-final/\`.
No database password or DATABASE_URL is stored in the source or report.
Final Candidate Audit was **not started**.
REPORT

STAGE="$(mktemp -d)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

# Copy source while explicitly excluding generated outputs, VCS metadata, local secrets and prior release archives.
tar \
  --exclude='./node_modules' --exclude='./.next' --exclude='./.git' --exclude='./.vercel' \
  --exclude='./coverage' --exclude='./dist' --exclude='./ApplicationOps_PASS15_FINAL.zip' \
  --exclude='./ApplicationOps_PASS15_FINAL.zip.sha256' \
  --exclude='./.env' --exclude='./.env.*' --exclude-vcs \
  -cf - . | tar -xf - -C "$STAGE"
# .env.example is intentionally safe and should be included.
[[ -f .env.example ]] && cp .env.example "$STAGE/.env.example"
rm -f \
  "$STAGE/docs/passes/PASS_15_BLOCKED_REPORT.md" \
  "$STAGE/docs/passes/PASS_15_RUNNER_HANDOFF.md" \
  "$STAGE/docs/passes/evidence/PASS_15_LOCAL_NETWORK_PROBE.txt" \
  "$STAGE/docs/passes/evidence/PASS_15_LOCKFILE_REGEN_ATTEMPT.txt" \
  "$STAGE/docs/passes/evidence/PASS_15_NEON_READONLY_EVIDENCE.txt" \
  "$STAGE/docs/passes/evidence/PASS_15_RECONCILED_FILE_MANIFEST.sha256" \
  "$STAGE/docs/passes/evidence/PASS_15_REPOSITORY_GATE.txt" \
  "$STAGE/docs/passes/evidence/PASS_15_SECRET_SCAN.txt" \
  "$STAGE/docs/passes/evidence/PASS_15_REPOSITORY_GATE_RUNNER_READY.txt" \
  "$STAGE/docs/passes/evidence/PASS_15_RUNNER_READY_FILE_MANIFEST.sha256" \
  "$STAGE/docs/passes/evidence/PASS_15_SECRET_SCAN_RUNNER_READY.txt"

python3 scripts/pass15_secret_scan.py --root "$STAGE" > "$EVIDENCE/16-secret-scan-staging.log"

rm -f ApplicationOps_PASS15_FINAL.zip ApplicationOps_PASS15_FINAL.zip.sha256
(
  cd "$STAGE"
  # Python stdlib avoids relying on a system zip binary.
  python3 - <<'PY'
from pathlib import Path
import zipfile
root = Path('.')
paths = sorted(p for p in root.rglob('*') if p.is_file())
with zipfile.ZipFile('/tmp/ApplicationOps_PASS15_FINAL.zip', 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for p in paths:
        zf.write(p, p.as_posix())
PY
)
mv /tmp/ApplicationOps_PASS15_FINAL.zip "$ROOT/ApplicationOps_PASS15_FINAL.zip"
ZIP_HASH="$(sha256sum ApplicationOps_PASS15_FINAL.zip | awk '{print $1}')"
printf '%s  %s\n' "$ZIP_HASH" 'ApplicationOps_PASS15_FINAL.zip' > ApplicationOps_PASS15_FINAL.zip.sha256

# Verify the just-created archive independently and prove forbidden paths are absent.
python3 - <<'PY'
from pathlib import Path
import zipfile, re, sys
z = Path('ApplicationOps_PASS15_FINAL.zip')
forbidden_parts = {'node_modules','.next','.git','.vercel','coverage','dist'}
with zipfile.ZipFile(z) as f:
    names = f.namelist()
    bad = [n for n in names if any(part in forbidden_parts for part in Path(n).parts)]
    bad_env = [n for n in names if Path(n).name.startswith('.env') and Path(n).name != '.env.example']
    if bad or bad_env:
        print('Archive exclusion verification failed', bad[:10], bad_env[:10], file=sys.stderr)
        sys.exit(1)
print(f'ARCHIVE_VERIFY_PASS files={len(names)}')
PY

printf 'PASS 15 COMPLETE / RELEASE GREEN\nZIP SHA-256: %s\n' "$ZIP_HASH"
