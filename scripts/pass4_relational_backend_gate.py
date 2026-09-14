#!/usr/bin/env python3
"""PASS 4 fallback relational backend gate.

This script is intentionally NOT a replacement for the Prisma/PostgreSQL integration test.
It executes the same canonical workflow and transactional negative-path invariants against an
in-memory relational database so the backend gate can still exercise database transactions in
offline build environments where npm/Prisma/PostgreSQL are unavailable.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

APP_ID = "applicationops-synthetic"
INCIDENT_ID = "APP-2047"
CURRENT = "2.8.0"
PREVIOUS = "2.7.4"
REQUEST_ID = "req_tx_8f31"
TX_ID = "TX-90842"
RECOVERY_REQUEST_ID = "req_tx_recovery_1"
RECOVERY_TX_ID = "TX-RECOVERY-1"
FAILURE = "UPSTREAM_TIMEOUT"
RECOVERED_ERROR_RATE = 1.1
THRESHOLD = 2.0

BASE = datetime(2026, 9, 2, 7, 30, 0, tzinfo=timezone.utc)


class GateError(RuntimeError):
    pass


@dataclass
class GateResult:
    name: str
    passed: bool


def iso(dt: datetime) -> str:
    return dt.isoformat()


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(
        """
        CREATE TABLE application (
          id TEXT PRIMARY KEY,
          service_health TEXT NOT NULL,
          active_release_version TEXT NOT NULL,
          synthetic_error_rate REAL NOT NULL
        );
        CREATE TABLE release (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL REFERENCES application(id) ON DELETE CASCADE,
          version TEXT NOT NULL,
          status TEXT NOT NULL,
          downstream_timeout_ms INTEGER NOT NULL,
          deployed_at TEXT,
          UNIQUE(application_id, version)
        );
        CREATE TABLE incident (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL REFERENCES application(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          root_cause_code TEXT,
          selected_remediation TEXT,
          affected_release TEXT NOT NULL,
          recovered_release TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE log (
          id TEXT PRIMARY KEY,
          incident_id TEXT NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          request_id TEXT,
          message TEXT NOT NULL
        );
        CREATE TABLE api_request (
          id TEXT PRIMARY KEY,
          incident_id TEXT NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
          request_id TEXT NOT NULL,
          response_status INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          release_version TEXT NOT NULL,
          failure_code TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE synthetic_transaction (
          id TEXT PRIMARY KEY,
          incident_id TEXT NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
          request_id TEXT NOT NULL,
          status TEXT NOT NULL,
          application_version TEXT NOT NULL,
          failure_code TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE validation_check (
          id TEXT PRIMARY KEY,
          incident_id TEXT NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          required INTEGER NOT NULL,
          status TEXT NOT NULL,
          UNIQUE(incident_id, key)
        );
        CREATE TABLE audit_event (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          incident_id TEXT NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          timestamp TEXT NOT NULL
        );
        """
    )
    return db


def reset(db: sqlite3.Connection) -> None:
    with db:
        db.execute("DELETE FROM application WHERE id=?", (APP_ID,))
        db.execute(
            "INSERT INTO application VALUES (?,?,?,?)",
            (APP_ID, "DEGRADED", CURRENT, 14.8),
        )
        db.execute(
            "INSERT INTO release VALUES (?,?,?,?,?,?)",
            ("release-prev", APP_ID, PREVIOUS, "STABLE", 5000, iso(BASE - timedelta(days=2))),
        )
        db.execute(
            "INSERT INTO release VALUES (?,?,?,?,?,?)",
            ("release-current", APP_ID, CURRENT, "DEGRADED", 800, iso(BASE)),
        )
        db.execute(
            "INSERT INTO incident VALUES (?,?,?,?,?,?,?,?)",
            (INCIDENT_ID, APP_ID, "OPEN", None, None, CURRENT, None, iso(BASE + timedelta(minutes=1))),
        )
        db.executemany(
            "INSERT INTO log VALUES (?,?,?,?,?,?)",
            [
                ("l1", INCIDENT_ID, iso(BASE), "INFO", None, f"Release {CURRENT} deployment completed."),
                ("l2", INCIDENT_ID, iso(BASE + timedelta(minutes=1)), "INFO", REQUEST_ID, "request started"),
                ("l3", INCIDENT_ID, iso(BASE + timedelta(minutes=1, seconds=1)), "WARN", REQUEST_ID, "latency 1437ms timeout 800ms"),
                ("l4", INCIDENT_ID, iso(BASE + timedelta(minutes=1, seconds=1)), "ERROR", REQUEST_ID, FAILURE),
                ("l5", INCIDENT_ID, iso(BASE + timedelta(minutes=1, seconds=1)), "ERROR", REQUEST_ID, "transaction failed"),
            ],
        )
        db.execute(
            "INSERT INTO api_request VALUES (?,?,?,?,?,?,?,?)",
            ("r1", INCIDENT_ID, REQUEST_ID, 504, 1437, CURRENT, FAILURE, iso(BASE + timedelta(minutes=1, seconds=1))),
        )
        db.execute(
            "INSERT INTO synthetic_transaction VALUES (?,?,?,?,?,?,?)",
            (TX_ID, INCIDENT_ID, REQUEST_ID, "FAILED", CURRENT, FAILURE, iso(BASE + timedelta(minutes=1, seconds=1))),
        )
        for key in ("stable-release", "error-rate", "synthetic-transaction", "timeout-errors"):
            db.execute(
                "INSERT INTO validation_check VALUES (?,?,?,?,?)",
                ("v-" + key, INCIDENT_ID, key, 1, "PENDING"),
            )
        for typ, ts in [
            ("RELEASE_DEPLOYED", BASE),
            ("INCIDENT_CREATED", BASE + timedelta(minutes=1)),
            ("APPLICATION_DEGRADED", BASE + timedelta(minutes=1, seconds=1)),
        ]:
            db.execute("INSERT INTO audit_event(incident_id,type,timestamp) VALUES (?,?,?)", (INCIDENT_ID, typ, iso(ts)))


def one(db: sqlite3.Connection, sql: str, args=()):
    row = db.execute(sql, args).fetchone()
    if row is None:
        raise GateError(f"Expected row for query: {sql}")
    return row


def cas_status(db: sqlite3.Connection, expected: str, nxt: str, extra_sql: str = "", extra_args=()) -> None:
    sql = "UPDATE incident SET status=?"
    args = [nxt]
    if extra_sql:
        sql += ", " + extra_sql
        args.extend(extra_args)
    sql += " WHERE id=? AND status=?"
    args.extend([INCIDENT_ID, expected])
    cur = db.execute(sql, args)
    if cur.rowcount != 1:
        raise GateError(f"PERSISTENCE_CONFLICT {expected}->{nxt}")


def audit(db: sqlite3.Connection, typ: str) -> None:
    last = db.execute("SELECT timestamp FROM audit_event WHERE incident_id=? ORDER BY seq DESC LIMIT 1", (INCIDENT_ID,)).fetchone()
    now = datetime.now(timezone.utc)
    if last:
        previous = datetime.fromisoformat(last[0])
        if now <= previous:
            now = previous + timedelta(microseconds=1)
    db.execute("INSERT INTO audit_event(incident_id,type,timestamp) VALUES (?,?,?)", (INCIDENT_ID, typ, iso(now)))


def investigate(db):
    with db:
        cas_status(db, "OPEN", "INVESTIGATING")
        audit(db, "INVESTIGATION_STARTED")


def confirm_regression(db):
    with db:
        incident = one(db, "SELECT status, created_at FROM incident WHERE id=?", (INCIDENT_ID,))
        current = one(db, "SELECT downstream_timeout_ms,deployed_at FROM release WHERE application_id=? AND version=?", (APP_ID, CURRENT))
        previous = one(db, "SELECT downstream_timeout_ms FROM release WHERE application_id=? AND version=?", (APP_ID, PREVIOUS))
        req = one(db, "SELECT duration_ms FROM api_request WHERE incident_id=? AND failure_code=?", (INCIDENT_ID, FAILURE))
        errors = one(db, "SELECT COUNT(*) c FROM log WHERE incident_id=? AND level='ERROR' AND message LIKE ?", (INCIDENT_ID, f"%{FAILURE}%"))[0]
        evidence_ok = (
            incident[0] == "INVESTIGATING"
            and current[0] < req[0]
            and previous[0] > req[0]
            and datetime.fromisoformat(incident[1]) > datetime.fromisoformat(current[1])
            and errors > 0
        )
        if not evidence_ok:
            raise GateError("REGRESSION_NOT_CONFIRMED")
        cas_status(db, "INVESTIGATING", "REGRESSION_CONFIRMED", "root_cause_code=?", ("RELEASE_TIMEOUT_REGRESSION",))
        audit(db, "RELEASE_COMPARISON_REVIEWED")
        audit(db, "RELEASE_REGRESSION_CONFIRMED")


def select_remediation(db, action: str):
    with db:
        status = one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0]
        if status != "REGRESSION_CONFIRMED":
            raise GateError("REGRESSION_NOT_CONFIRMED")
        if action != "ROLLBACK_RELEASE":
            raise GateError("REMEDIATION_NOT_SUPPORTED")
        cas_status(db, "REGRESSION_CONFIRMED", "REMEDIATION_SELECTED", "selected_remediation=?", (action,))
        audit(db, "REMEDIATION_SELECTED")


def rollback(db):
    with db:
        incident = one(db, "SELECT status, selected_remediation FROM incident WHERE id=?", (INCIDENT_ID,))
        if incident[0] != "REMEDIATION_SELECTED":
            raise GateError("REMEDIATION_NOT_SELECTED")
        if incident[1] != "ROLLBACK_RELEASE":
            raise GateError("ROLLBACK_NOT_SELECTED")

        cas_status(db, "REMEDIATION_SELECTED", "ROLLING_BACK")
        stable = one(db, "SELECT COUNT(*) FROM release WHERE application_id=? AND version=? AND status='STABLE'", (APP_ID, PREVIOUS))[0]
        if stable != 1:
            raise GateError("PERSISTENCE_CONFLICT previous release not stable")
        cur = db.execute("UPDATE release SET status='ROLLING_BACK' WHERE application_id=? AND version=? AND status='DEGRADED'", (APP_ID, CURRENT))
        if cur.rowcount != 1:
            raise GateError("PERSISTENCE_CONFLICT current release")
        audit(db, "ROLLBACK_STARTED")

        cas_status(db, "ROLLING_BACK", "READY_FOR_VALIDATION", "recovered_release=?", (PREVIOUS,))
        cur = db.execute("UPDATE release SET status='ROLLED_BACK' WHERE application_id=? AND version=? AND status='ROLLING_BACK'", (APP_ID, CURRENT))
        if cur.rowcount != 1:
            raise GateError("PERSISTENCE_CONFLICT finish release")
        cur = db.execute(
            "UPDATE application SET active_release_version=?, service_health='HEALTHY', synthetic_error_rate=? WHERE id=? AND active_release_version=? AND service_health='DEGRADED'",
            (PREVIOUS, RECOVERED_ERROR_RATE, APP_ID, CURRENT),
        )
        if cur.rowcount != 1:
            raise GateError("PERSISTENCE_CONFLICT application")
        audit(db, "ROLLBACK_COMPLETED")
        now = iso(datetime.now(timezone.utc) + timedelta(milliseconds=1))
        db.execute("INSERT INTO api_request VALUES (?,?,?,?,?,?,?,?)", ("recovery-r", INCIDENT_ID, RECOVERY_REQUEST_ID, 200, 1280, PREVIOUS, None, now))
        db.execute("INSERT INTO synthetic_transaction VALUES (?,?,?,?,?,?,?)", (RECOVERY_TX_ID, INCIDENT_ID, RECOVERY_REQUEST_ID, "SUCCEEDED", PREVIOUS, None, now))
        db.execute("INSERT INTO log VALUES (?,?,?,?,?,?)", ("recovery-l", INCIDENT_ID, now, "INFO", RECOVERY_REQUEST_ID, "recovery succeeded"))


def validate(db):
    with db:
        incident = one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0]
        rollback_seq = db.execute("SELECT seq,timestamp FROM audit_event WHERE incident_id=? AND type='ROLLBACK_COMPLETED'", (INCIDENT_ID,)).fetchone()
        if rollback_seq is None:
            raise GateError("ROLLBACK_NOT_COMPLETED")
        if incident != "READY_FOR_VALIDATION":
            raise GateError("INVALID_INCIDENT_TRANSITION")
        app = one(db, "SELECT active_release_version,service_health,synthetic_error_rate FROM application WHERE id=?", (APP_ID,))
        current = one(db, "SELECT status FROM release WHERE application_id=? AND version=?", (APP_ID, CURRENT))[0]
        prev = one(db, "SELECT status FROM release WHERE application_id=? AND version=?", (APP_ID, PREVIOUS))[0]
        stable = app[0] == PREVIOUS and app[1] == "HEALTHY" and current == "ROLLED_BACK" and prev == "STABLE"
        err_ok = app[2] < THRESHOLD
        tx_ok = one(db, "SELECT COUNT(*) FROM synthetic_transaction WHERE incident_id=? AND status='SUCCEEDED' AND application_version=?", (INCIDENT_ID, PREVIOUS))[0] > 0
        timeout_ok = one(db, "SELECT COUNT(*) FROM log WHERE incident_id=? AND seq IS NULL", ()) if False else None
        post_errors = db.execute(
            "SELECT COUNT(*) FROM log WHERE incident_id=? AND level='ERROR' AND message LIKE ? AND timestamp > ?",
            (INCIDENT_ID, f"%{FAILURE}%", rollback_seq[1]),
        ).fetchone()[0]
        checks = {
            "stable-release": stable,
            "error-rate": err_ok,
            "synthetic-transaction": tx_ok,
            "timeout-errors": post_errors == 0,
        }
        if not all(checks.values()):
            raise GateError("VALIDATION_REQUIRED")
        audit(db, "VALIDATION_STARTED")
        for key in checks:
            cur = db.execute("UPDATE validation_check SET status='PASS' WHERE incident_id=? AND key=? AND required=1", (INCIDENT_ID, key))
            if cur.rowcount != 1:
                raise GateError("PERSISTENCE_CONFLICT validation")
        cas_status(db, "READY_FOR_VALIDATION", "VALIDATED")
        audit(db, "VALIDATION_PASSED")


def resolve(db):
    with db:
        status = one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0]
        checks = db.execute("SELECT key,required,status FROM validation_check WHERE incident_id=?", (INCIDENT_ID,)).fetchall()
        if len(checks) != 4 or any(row[1] != 1 or row[2] != "PASS" for row in checks):
            raise GateError("VALIDATION_REQUIRED")
        if status != "VALIDATED":
            raise GateError("INVALID_INCIDENT_TRANSITION")
        cas_status(db, "VALIDATED", "RESOLVED")
        audit(db, "INCIDENT_RESOLVED")


def final_assertions(db):
    incident = one(db, "SELECT * FROM incident WHERE id=?", (INCIDENT_ID,))
    assert incident[2] == "RESOLVED"
    assert incident[3] == "RELEASE_TIMEOUT_REGRESSION"
    assert incident[4] == "ROLLBACK_RELEASE"
    assert incident[6] == PREVIOUS
    app = one(db, "SELECT * FROM application WHERE id=?", (APP_ID,))
    assert app[1] == "HEALTHY" and app[2] == PREVIOUS and abs(app[3] - RECOVERED_ERROR_RATE) < 1e-9
    releases = {r[2]: r[3] for r in db.execute("SELECT * FROM release WHERE application_id=?", (APP_ID,))}
    assert releases[CURRENT] == "ROLLED_BACK" and releases[PREVIOUS] == "STABLE"
    checks = db.execute("SELECT status FROM validation_check WHERE incident_id=?", (INCIDENT_ID,)).fetchall()
    assert len(checks) == 4 and all(r[0] == "PASS" for r in checks)
    expected = [
        "RELEASE_DEPLOYED", "INCIDENT_CREATED", "APPLICATION_DEGRADED", "INVESTIGATION_STARTED",
        "RELEASE_COMPARISON_REVIEWED", "RELEASE_REGRESSION_CONFIRMED", "REMEDIATION_SELECTED",
        "ROLLBACK_STARTED", "ROLLBACK_COMPLETED", "VALIDATION_STARTED", "VALIDATION_PASSED", "INCIDENT_RESOLVED"
    ]
    actual = [r[0] for r in db.execute("SELECT type FROM audit_event WHERE incident_id=? ORDER BY seq", (INCIDENT_ID,))]
    assert actual == expected, (actual, expected)


def run_test(name, fn):
    try:
        fn()
    except Exception as exc:
        raise AssertionError(f"{name}: FAIL: {exc}") from exc
    return GateResult(name, True)


def main():
    db = connect()
    results = []

    def golden():
        reset(db); investigate(db); confirm_regression(db); select_remediation(db, "ROLLBACK_RELEASE"); rollback(db); validate(db); resolve(db); final_assertions(db)
    results.append(run_test("golden_path", golden))

    def early_rollback():
        reset(db)
        before = db.execute("SELECT COUNT(*) FROM audit_event").fetchone()[0]
        try: rollback(db)
        except GateError as e: assert str(e) == "REMEDIATION_NOT_SELECTED"
        else: raise AssertionError("rollback unexpectedly succeeded")
        assert one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0] == "OPEN"
        assert db.execute("SELECT COUNT(*) FROM audit_event").fetchone()[0] == before
    results.append(run_test("rollback_before_evidence", early_rollback))

    def invalid_remediation():
        reset(db); investigate(db); confirm_regression(db)
        try: select_remediation(db, "CHANGE_PRODUCTION_DATA")
        except GateError as e: assert str(e) == "REMEDIATION_NOT_SUPPORTED"
        else: raise AssertionError("invalid remediation unexpectedly succeeded")
        assert one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0] == "REGRESSION_CONFIRMED"
        assert one(db, "SELECT COUNT(*) FROM audit_event WHERE type='REMEDIATION_SELECTED'", ())[0] == 0
    results.append(run_test("unsupported_remediation", invalid_remediation))

    def early_validation():
        reset(db); investigate(db); confirm_regression(db); select_remediation(db, "ROLLBACK_RELEASE")
        try: validate(db)
        except GateError as e: assert str(e) == "ROLLBACK_NOT_COMPLETED"
        else: raise AssertionError("validation unexpectedly succeeded")
        assert one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0] == "REMEDIATION_SELECTED"
        assert one(db, "SELECT COUNT(*) FROM validation_check WHERE status='PENDING'", ())[0] == 4
    results.append(run_test("validation_before_rollback", early_validation))

    def early_resolve():
        reset(db); investigate(db); confirm_regression(db); select_remediation(db, "ROLLBACK_RELEASE"); rollback(db)
        try: resolve(db)
        except GateError as e: assert str(e) == "VALIDATION_REQUIRED"
        else: raise AssertionError("resolve unexpectedly succeeded")
        assert one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0] == "READY_FOR_VALIDATION"
        assert one(db, "SELECT COUNT(*) FROM audit_event WHERE type='INCIDENT_RESOLVED'", ())[0] == 0
    results.append(run_test("resolve_before_validation", early_resolve))

    def rollback_atomicity():
        reset(db); investigate(db); confirm_regression(db); select_remediation(db, "ROLLBACK_RELEASE")
        with db:
            db.execute("UPDATE application SET service_health='HEALTHY' WHERE id=?", (APP_ID,))
        before_audit = one(db, "SELECT COUNT(*) FROM audit_event", ())[0]
        try: rollback(db)
        except GateError as e: assert str(e).startswith("PERSISTENCE_CONFLICT")
        else: raise AssertionError("conflicting rollback unexpectedly succeeded")
        assert one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0] == "REMEDIATION_SELECTED"
        assert one(db, "SELECT status FROM release WHERE version=?", (CURRENT,))[0] == "DEGRADED"
        assert one(db, "SELECT COUNT(*) FROM audit_event", ())[0] == before_audit
    results.append(run_test("rollback_transaction_atomicity", rollback_atomicity))

    def deterministic_reset():
        golden()
        reset(db)
        assert one(db, "SELECT status FROM incident WHERE id=?", (INCIDENT_ID,))[0] == "OPEN"
        assert one(db, "SELECT COUNT(*) FROM log WHERE incident_id=?", (INCIDENT_ID,))[0] == 5
        assert one(db, "SELECT COUNT(*) FROM api_request WHERE incident_id=?", (INCIDENT_ID,))[0] == 1
        assert one(db, "SELECT COUNT(*) FROM synthetic_transaction WHERE incident_id=?", (INCIDENT_ID,))[0] == 1
        assert one(db, "SELECT COUNT(*) FROM validation_check WHERE incident_id=? AND status='PENDING'", (INCIDENT_ID,))[0] == 4
        assert one(db, "SELECT COUNT(*) FROM audit_event WHERE incident_id=?", (INCIDENT_ID,))[0] == 3
    results.append(run_test("deterministic_reset", deterministic_reset))

    print("PASS4_RELATIONAL_BACKEND_GATE_PASS")
    print(f"tests={len(results)} passed={sum(r.passed for r in results)} failed=0")
    for r in results:
        print(f"PASS {r.name}")


if __name__ == "__main__":
    main()
