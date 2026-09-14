#!/usr/bin/env python3
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

EXCLUDED_PARTS = {'node_modules', '.next', '.git', '.vercel', 'coverage', 'dist'}
SAFE_LOCAL_HOSTS = {'127.0.0.1', 'localhost', '::1'}
TOKEN_RE = re.compile(rb'npg_[A-Za-z0-9]{8,}')
PRIVATE_KEY_RE = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
PG_URL_RE = re.compile(rb'postgres(?:ql)?://[^\s\"\'<>]+', re.I)


def scan(root: Path) -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    for p in root.rglob('*'):
        if not p.is_file():
            continue
        rel = p.relative_to(root)
        if any(part in EXCLUDED_PARTS for part in rel.parts):
            continue
        if p.name.startswith('.env') and p.name != '.env.example':
            findings.append((rel.as_posix(), 'forbidden-env-file'))
            continue
        try:
            data = p.read_bytes()
        except OSError:
            continue
        if TOKEN_RE.search(data):
            findings.append((rel.as_posix(), 'neon-token-pattern'))
        if PRIVATE_KEY_RE.search(data):
            findings.append((rel.as_posix(), 'private-key-pattern'))
        for match in PG_URL_RE.finditer(data):
            raw = match.group(0).decode('utf-8', errors='ignore').rstrip('),.;]}`')
            try:
                parsed = urlsplit(raw)
            except ValueError:
                findings.append((rel.as_posix(), 'unparseable-postgres-url'))
                continue
            # A credentialed PostgreSQL URL is acceptable only for explicit local test fixtures.
            if parsed.password is not None and (parsed.hostname or '').lower() not in SAFE_LOCAL_HOSTS:
                findings.append((rel.as_posix(), 'remote-credential-postgres-url'))
    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    args = ap.parse_args()
    root = Path(args.root).resolve()
    findings = scan(root)
    if findings:
        print('SECRET_SCAN_FAIL')
        for path, kind in sorted(set(findings)):
            print(f'{kind}: {path}')
        return 1
    print('SECRET_SCAN_PASS')
    print('No Neon token, remote credential PostgreSQL URL, private key, or forbidden env file detected.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
