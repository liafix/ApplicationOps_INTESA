$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Equal([string]$Actual, [string]$Expected, [string]$Name) {
  if ($Actual.Trim() -ne $Expected) { throw "$Name mismatch: expected '$Expected', got '$Actual'" }
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Assert-Equal ((node -v) | Out-String) 'v22.16.0' 'Node'
Assert-Equal ((npm -v) | Out-String) '10.9.2' 'npm'

if (-not $env:DATABASE_URL) { throw 'DATABASE_URL must be set only in the process environment.' }
if ($env:DATABASE_URL -notmatch 'ep-plain-shape-ar1x8bmp' -or $env:DATABASE_URL -notmatch '/applicationops_pass15_ci(?:\?|$)') {
  throw 'Refusing DB gate: DATABASE_URL must target applicationops_pass15_ci on the dedicated PASS 15 Neon integration compute.'
}

$evidence = Join-Path $root 'docs\passes\evidence\pass15-final'
if (Test-Path $evidence) { Remove-Item -Recurse -Force $evidence }
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

function Invoke-Gate([string]$Slug, [scriptblock]$Command) {
  $log = Join-Path $evidence ("$Slug.log")
  Write-Host "== $Slug =="
  & $Command 2>&1 | Tee-Object -FilePath $log
  $exit = $LASTEXITCODE
  if ($exit -ne 0) { throw "$Slug failed with exit code $exit (see $log)" }
}

"Node=$(node -v)`nnpm=$(npm -v)`nExecutedAt=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK')" | Set-Content -Encoding UTF8 (Join-Path $evidence 'runtime.txt')

if (-not (Test-Path (Join-Path $root 'package-lock.json'))) {
  Invoke-Gate '01-generate-package-lock' { npm install --package-lock-only --ignore-scripts --no-audit --no-fund }
}
Invoke-Gate '02-lock-check' { npm run lock:check }
Invoke-Gate '03-npm-ci' { npm ci }
Invoke-Gate '04-pass15-repository-gate' { npm run pass15:gate }
Invoke-Gate '05-format-check' { npm run format:check }
Invoke-Gate '06-prisma-generate' { npm run prisma:generate }
Invoke-Gate '07-prisma-validate' { npm run prisma:validate }
Invoke-Gate '08-prisma-migrate-deploy' { npm run prisma:migrate:deploy }
Invoke-Gate '09-postgresql-integration-tests' { npm run test:integration:db }
Invoke-Gate '10-lint' { npm run lint }
Invoke-Gate '11-typecheck' { npm run typecheck }
Invoke-Gate '12-unit-tests' { npm test }
Invoke-Gate '13-production-build' { npm run build }

$auditJson = Join-Path $evidence '14-npm-audit.json'
Write-Host '== 14-npm-audit =='
npm audit --audit-level=high --json | Set-Content -Encoding UTF8 $auditJson
$auditExit = $LASTEXITCODE
if ($auditExit -ne 0) { throw "npm audit failed with exit code $auditExit (see $auditJson)" }
$audit = Get-Content -Raw $auditJson | ConvertFrom-Json
$high = [int]$audit.metadata.vulnerabilities.high
$critical = [int]$audit.metadata.vulnerabilities.critical
if ($high -ne 0 -or $critical -ne 0) { throw "Security audit gate failed: high=$high critical=$critical" }

$unitLog = Get-Content -Raw (Join-Path $evidence '12-unit-tests.log')
if ($unitLog -notmatch '19\s+passed' -or $unitLog -notmatch '84\s+passed') {
  throw 'Unit-test evidence does not prove 19 passed files and 84 passed tests.'
}
$integrationLog = Get-Content -Raw (Join-Path $evidence '09-postgresql-integration-tests.log')
if ($integrationLog -notmatch '9\s+passed') {
  throw 'Integration-test evidence does not prove 9 passed PostgreSQL tests.'
}

$forbiddenDirs = @('node_modules', '.next', '.git', '.vercel', 'coverage', 'dist')
$badEnv = Get-ChildItem -Recurse -Force -File | Where-Object { $_.Name -like '.env*' -and $_.Name -ne '.env.example' }
if ($badEnv) { throw "Secret env files present: $($badEnv.FullName -join ', ')" }

Invoke-Gate '15-secret-scan-workspace' { python3 scripts/pass15_secret_scan.py --root . }

$lockHash = (Get-FileHash (Join-Path $root 'package-lock.json') -Algorithm SHA256).Hash.ToLowerInvariant()
$report = Join-Path $root 'PASS_15_FINAL_REPORT.md'
@"
# PASS 15 FINAL REPORT

Date: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK')

Verdict: **PASS 15 = COMPLETE / RELEASE GREEN**

Runtime:
- Node v22.16.0
- npm 10.9.2

Database execution:
- dedicated PASS 15 Neon integration compute: `ep-plain-shape-ar1x8bmp`
- dedicated clean database: `applicationops_pass15_ci`
- committed Prisma migrations applied successfully
- real PostgreSQL integration suite: **9/9 PASS**
- required scenario coverage: golden path, early rollback rejection, unsupported remediation rejection,
  pre-rollback validation rejection, pre-4/4 resolution rejection, rollback atomicity conflict, deterministic reset
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

package-lock.json SHA-256: `$lockHash`

Raw gate evidence is stored under `docs/passes/evidence/pass15-final/`.
No database password or DATABASE_URL is stored in the source or report.
Final Candidate Audit was **not started**.
"@ | Set-Content -Encoding UTF8 $report

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("applicationops-pass15-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  Get-ChildItem -Force | ForEach-Object {
    if ($forbiddenDirs -contains $_.Name) { return }
    if ($_.Name -like '.env*' -and $_.Name -ne '.env.example') { return }
    if ($_.Name -eq 'ApplicationOps_PASS15_FINAL.zip' -or $_.Name -like '*.sha256') { return }
    Copy-Item -Recurse -Force $_.FullName -Destination $stage
  }

  $stalePass15Files = @(
    'docs\passes\PASS_15_BLOCKED_REPORT.md',
    'docs\passes\PASS_15_RUNNER_HANDOFF.md',
    'docs\passes\evidence\PASS_15_LOCAL_NETWORK_PROBE.txt',
    'docs\passes\evidence\PASS_15_LOCKFILE_REGEN_ATTEMPT.txt',
    'docs\passes\evidence\PASS_15_NEON_READONLY_EVIDENCE.txt',
    'docs\passes\evidence\PASS_15_RECONCILED_FILE_MANIFEST.sha256',
    'docs\passes\evidence\PASS_15_REPOSITORY_GATE.txt',
    'docs\passes\evidence\PASS_15_SECRET_SCAN.txt',
    'docs\passes\evidence\PASS_15_REPOSITORY_GATE_RUNNER_READY.txt',
    'docs\passes\evidence\PASS_15_RUNNER_READY_FILE_MANIFEST.sha256',
    'docs\passes\evidence\PASS_15_SECRET_SCAN_RUNNER_READY.txt'
  )
  foreach ($relative in $stalePass15Files) {
    $candidate = Join-Path $stage $relative
    if (Test-Path $candidate) { Remove-Item -Force $candidate }
  }

  Invoke-Gate '16-secret-scan-staging' { python3 scripts/pass15_secret_scan.py --root $stage }

  $zip = Join-Path $root 'ApplicationOps_PASS15_FINAL.zip'
  if (Test-Path $zip) { Remove-Item -Force $zip }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
  $zipHash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  "$zipHash  ApplicationOps_PASS15_FINAL.zip" | Set-Content -Encoding ASCII (Join-Path $root 'ApplicationOps_PASS15_FINAL.zip.sha256')
  Write-Host 'PASS 15 COMPLETE / RELEASE GREEN'
  Write-Host "ZIP SHA-256: $zipHash"
} finally {
  Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
}
