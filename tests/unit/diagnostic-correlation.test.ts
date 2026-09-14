import { describe, expect, it } from "vitest";

import {
  buildDiagnosticCorrelation,
  type DiagnosticLogEvidence,
  type DiagnosticRequestEvidence,
  type DiagnosticTransactionEvidence
} from "@/lib/ui/diagnostic-correlation";

const expected = {
  requestId: "req_tx_8f31",
  transactionId: "TX-90842",
  releaseVersion: "2.8.0",
  failureCode: "UPSTREAM_TIMEOUT",
  httpStatus: 504,
  observedLatencyMs: 1437
};

const logs: DiagnosticLogEvidence[] = [
  {
    id: "deploy",
    timestamp: "2026-09-02T07:30:00.000Z",
    level: "INFO",
    requestId: null,
    service: "Transaction Processing Service",
    message: "Release 2.8.0 deployment completed."
  },
  {
    id: "started",
    timestamp: "2026-09-02T07:32:10.000Z",
    level: "INFO",
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "POST /transactions/process started on release 2.8.0."
  },
  {
    id: "latency",
    timestamp: "2026-09-02T07:32:11.437Z",
    level: "WARN",
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "Observed downstream latency 1437ms exceeds configured timeout 800ms."
  },
  {
    id: "timeout",
    timestamp: "2026-09-02T07:32:11.437Z",
    level: "ERROR",
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "UPSTREAM_TIMEOUT · HTTP 504."
  },
  {
    id: "transaction",
    timestamp: "2026-09-02T07:32:11.437Z",
    level: "ERROR",
    requestId: expected.requestId,
    service: "Transaction Processing Service",
    message: "Synthetic transaction TX-90842 processing failed."
  }
];

const requests: DiagnosticRequestEvidence[] = [
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

const transactions: DiagnosticTransactionEvidence[] = [
  {
    id: expected.transactionId,
    requestId: expected.requestId,
    status: "FAILED",
    applicationVersion: "2.8.0",
    failureCode: "UPSTREAM_TIMEOUT",
    createdAt: "2026-09-02T07:32:11.437Z"
  }
];

describe("diagnostic evidence correlation", () => {
  it("builds one complete evidence trail across request, logs, transaction and release", () => {
    const result = buildDiagnosticCorrelation({ logs, requests, transactions, expected });

    expect(result.status).toBe("COMPLETE");
    expect(result.request?.requestId).toBe("req_tx_8f31");
    expect(result.transaction?.id).toBe("TX-90842");
    expect(result.request?.releaseVersion).toBe("2.8.0");
    expect(result.transaction?.applicationVersion).toBe("2.8.0");
    expect(result.correlatedLogs).toHaveLength(4);
    expect(result.trail.map((item) => item.key)).toEqual([
      "DEPLOYMENT",
      "REQUEST",
      "LATENCY",
      "TIMEOUT",
      "TRANSACTION"
    ]);
    expect(result.checks.every((item) => item.status === "PASS")).toBe(true);
  });

  it("fails closed when the persisted transaction points to another request", () => {
    const result = buildDiagnosticCorrelation({
      logs,
      requests,
      transactions: [{ ...transactions[0], requestId: "req_other" }],
      expected
    });

    expect(result.status).toBe("MISMATCH");
    expect(result.checks.find((item) => item.key === "transaction-request")?.status).toBe("FAIL");
  });

  it("marks the trail partial when a required timeout log is missing", () => {
    const result = buildDiagnosticCorrelation({
      logs: logs.filter((log) => log.id !== "timeout"),
      requests,
      transactions,
      expected
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.timeoutLog).toBeNull();
  });

  it("ignores later recovery evidence when building the canonical failure trail", () => {
    const result = buildDiagnosticCorrelation({
      logs: [
        ...logs,
        {
          id: "recovery",
          timestamp: "2026-09-02T07:40:00.000Z",
          level: "INFO",
          requestId: "req_tx_recovery",
          service: "Transaction Processing Service",
          message: "Synthetic recovery request completed successfully."
        }
      ],
      requests: [
        ...requests,
        {
          ...requests[0],
          id: "recovery-request",
          requestId: "req_tx_recovery",
          responseStatus: 200,
          durationMs: 250,
          releaseVersion: "2.7.4",
          failureCode: null
        }
      ],
      transactions: [
        ...transactions,
        {
          id: "TX-90843",
          requestId: "req_tx_recovery",
          status: "SUCCEEDED",
          applicationVersion: "2.7.4",
          failureCode: null,
          createdAt: "2026-09-02T07:40:00.000Z"
        }
      ],
      expected
    });

    expect(result.status).toBe("COMPLETE");
    expect(result.request?.requestId).toBe(expected.requestId);
    expect(result.transaction?.id).toBe(expected.transactionId);
    expect(result.correlatedLogs.every((log) => log.requestId === expected.requestId)).toBe(true);
  });
});
