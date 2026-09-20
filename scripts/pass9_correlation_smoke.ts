import { buildDiagnosticCorrelation } from "../lib/ui/diagnostic-correlation";

const expected = {
  requestId: "req_tx_8f31",
  transactionId: "TX-90842",
  releaseVersion: "2.8.0",
  failureCode: "UPSTREAM_TIMEOUT",
  httpStatus: 504,
  observedLatencyMs: 1437
};

const logs = [
  {
    id: "deploy",
    timestamp: "2026-09-02T07:30:00.000Z",
    level: "INFO" as const,
    requestId: null,
    service: "Transaction Processing Service",
    message: "Release 2.8.0 deployment completed."
  },
  {
    id: "started",
    timestamp: "2026-09-02T07:32:10.000Z",
    level: "INFO" as const,
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "POST /transactions/process started on release 2.8.0."
  },
  {
    id: "latency",
    timestamp: "2026-09-02T07:32:11.437Z",
    level: "WARN" as const,
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "Observed downstream latency 1437ms exceeds configured timeout 800ms."
  },
  {
    id: "timeout",
    timestamp: "2026-09-02T07:32:11.437Z",
    level: "ERROR" as const,
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "UPSTREAM_TIMEOUT · HTTP 504."
  },
  {
    id: "tx",
    timestamp: "2026-09-02T07:32:11.437Z",
    level: "ERROR" as const,
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "Synthetic transaction TX-90842 processing failed."
  }
];

const requests = [
  {
    id: "api-request-failed-1",
    requestId: expected.requestId,
    method: "POST",
    path: "/transactions/process",
    responseStatus: 504,
    durationMs: 1437,
    releaseVersion: "2.8.0",
    failureCode: "UPSTREAM_TIMEOUT",
    createdAt: "2026-09-02T07:32:11.437Z"
  }
];

const transactions = [
  {
    id: expected.transactionId,
    requestId: expected.requestId,
    status: "FAILED" as const,
    applicationVersion: "2.8.0",
    failureCode: "UPSTREAM_TIMEOUT",
    createdAt: "2026-09-02T07:32:11.437Z"
  }
];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const complete = buildDiagnosticCorrelation({ logs, requests, transactions, expected });
assert(complete.status === "COMPLETE", "canonical correlation is COMPLETE");
assert(complete.request?.requestId === "req_tx_8f31", "request ID is linked");
assert(complete.transaction?.id === "TX-90842", "transaction ID is linked");
assert(complete.request?.releaseVersion === "2.8.0", "request points to v2.8.0");
assert(complete.transaction?.applicationVersion === "2.8.0", "transaction points to v2.8.0");
assert(complete.correlatedLogs.length === 4, "four request-correlated logs are selected");
assert(complete.trail.length === 5, "five-step evidence trail is built");

const mismatch = buildDiagnosticCorrelation({
  logs,
  requests,
  transactions: [{ ...transactions[0], requestId: "req_other" }],
  expected
});
assert(mismatch.status === "MISMATCH", "cross-request transaction mismatch fails closed");

const partial = buildDiagnosticCorrelation({
  logs: logs.filter((log) => log.id !== "timeout"),
  requests,
  transactions,
  expected
});
assert(partial.status === "PARTIAL", "missing timeout log produces PARTIAL trail");

console.log("PASS9_DIAGNOSTIC_CORRELATION_SMOKE_PASS");
