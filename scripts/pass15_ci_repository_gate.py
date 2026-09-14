from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks: list[tuple[str, bool]] = []

def add(name: str, ok: bool) -> None:
    checks.append((name, ok))

pkg = json.loads((ROOT / "package.json").read_text())
workflow = (ROOT / ".github/workflows/ci.yml").read_text()
gitignore = (ROOT / ".gitignore").read_text()

add("package-lock committed", (ROOT / "package-lock.json").exists())
add("Node 22 engine locked", pkg.get("engines", {}).get("node") == ">=22 <23")
add("npm 10 engine locked", pkg.get("engines", {}).get("npm") == ">=10 <11")
add("packageManager pinned", pkg.get("packageManager") == "npm@10.9.2")
add("Next patched backport", pkg.get("dependencies", {}).get("next") == "15.5.25")
add("React patched line", pkg.get("dependencies", {}).get("react") == "19.2.8")
add("Prisma client hardened", pkg.get("dependencies", {}).get("@prisma/client") == "6.12.0")
add("Prisma CLI hardened", pkg.get("devDependencies", {}).get("prisma") == "6.12.0")
add("Vitest hardened", pkg.get("devDependencies", {}).get("vitest") == "3.2.7")
add("PostCSS dev dependency hardened", pkg.get("devDependencies", {}).get("postcss") == "8.5.26")
add("PostCSS override hardened", pkg.get("overrides", {}).get("postcss") == "8.5.26")
add("Sharp override hardened", pkg.get("overrides", {}).get("sharp") == "0.35.4")
add("full audit is a hard gate", pkg.get("scripts", {}).get("security:audit") == "npm audit --audit-level=high")
add("quality CI script exists", "ci:quality" in pkg.get("scripts", {}))
add("database CI script exists", "ci:db" in pkg.get("scripts", {}))
add("CI uses npm ci", workflow.count("npm ci") >= 2)
add("CI runs lint", "npm run lint" in workflow)
add("CI runs typecheck", "npm run typecheck" in workflow)
add("CI runs unit tests", "npm test" in workflow)
add("CI runs production build", "npm run build" in workflow)
add("CI runs security audit", "npm run security:audit" in workflow)
add("CI runs PostgreSQL integration", "npm run test:integration:db" in workflow)
add("CI applies migrations", "npm run prisma:migrate:deploy" in workflow)
add("CI pins PostgreSQL 18", "image: postgres:18" in workflow)
add("CI permissions read-only", "permissions:\n  contents: read" in workflow)
add("Dependabot npm configured", (ROOT / ".github/dependabot.yml").exists())
add("env files ignored", ".env.*" in gitignore and "!.env.example" in gitignore)
add("node_modules ignored", "node_modules/" in gitignore)
add("Next build output ignored", ".next/" in gitignore)
add("next-env lint ignored", "next-env.d.ts" in (ROOT / "eslint.config.mjs").read_text())
add("PASS 13 closure migration committed", (ROOT / "prisma/migrations/20260903120000_pass13_resolution_handoff/migration.sql").exists())

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(("PASS" if ok else "FAIL") + " " + name)
print(f"checks={len(checks)}")
print(f"passed={len(checks)-len(failed)}")
print(f"failed={len(failed)}")
if failed:
    raise SystemExit(1)
print("PASS15_CI_REPOSITORY_GATE_PASS")
