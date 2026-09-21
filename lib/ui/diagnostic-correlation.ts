export type DiagnosticCorrelationStatus = "COMPLETE" | "PARTIAL" | "MISMATCH";

export interface DiagnosticLogEvidence {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  requestId: string | null;
  service: string;
  message: string;
}

export interface DiagnosticRequestEvidence {
  id: string;
  requestId: string;
  method: string;
  path: string;
  responseStatus: number;
  durationMs: number;
  releaseVersion: string;
  failureCode: string | null;
  createdAt: string;
}

export interface DiagnosticTransactionEvidence {
  id: string;
  requestId: string;
  status: "FAILED" | "SUCCEEDED";
  applicationVersion: string;
  failureCode: string | null;
  createdAt: string;
}

export interface DiagnosticCorrelationExpectation {
  requestId: string;
  transactionId: string;
  releaseVersion: string;
  failureCode: string;
  httpStatus: number;
  observedLatencyMs: number;
}

export interface DiagnosticIntegrityCheck {
  key: string;
  label: string;
  status: "PASS" | "FAIL" | "MISSING";
  detail: string;
}

export interface DiagnosticTrailItem {
  key: "DEPLOYMENT" | "REQUEST" | "LATENCY" | "TIMEOUT" | "TRANSACTION";
  label: string;
  timestamp: string | null;
  detail: string;
  correlation: string;
  tone: "neutral" | "warning" | "danger";
}

export interface DiagnosticCorrelationResult {
  status: DiagnosticCorrelationStatus;
  request: DiagnosticRequestEvidence | null;
  transaction: DiagnosticTransactionEvidence | null;
  correlatedLogs: DiagnosticLogEvidence[];
  deploymentLog: DiagnosticLogEvidence | null;
  requestStartLog: DiagnosticLogEvidence | null;
  latencyLog: DiagnosticLogEvidence | null;
  timeoutLog: DiagnosticLogEvidence | null;
  transactionLog: DiagnosticLogEvidence | null;
  checks: DiagnosticIntegrityCheck[];
  trail: DiagnosticTrailItem[];
}

function hasText(value: string, expected: string): boolean {
  return value.toLowerCase().includes(expected.toLowerCase());
}

function findLog(
  logs: DiagnosticLogEvidence[],
  predicate: (log: DiagnosticLogEvidence) => boolean
): DiagnosticLogEvidence | null {
  return logs.find(predicate) ?? null;
}

function check(
  key: string,
  label: string,
  value: boolean | null,
  detail: string
): DiagnosticIntegrityCheck {
  return {
    key,
    label,
    status: value === null ? "MISSING" : value ? "PASS" : "FAIL",
    detail
  };
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function buildDiagnosticCorrelation(input: {
  logs: DiagnosticLogEvidence[];
  requests: DiagnosticRequestEvidence[];
  transactions: DiagnosticTransactionEvidence[];
  expected: DiagnosticCorrelationExpectation;
}): DiagnosticCorrelationResult {
  const { expected } = input;
  const request = input.requests.find((item) => item.requestId === expected.requestId) ?? null;
  const transaction = input.transactions.find((item) => item.id === expected.transactionId) ?? null;
  const correlatedLogs = input.logs.filter((log) => log.requestId === expected.requestId);

  const deploymentLog = findLog(
    input.logs,
    (log) =>
      log.requestId === null &&
      log.level === "INFO" &&
      hasText(log.message, `release ${expected.releaseVersion}`) &&
      hasText(log.message, "deployment completed")
  );
  const requestStartLog = findLog(
    correlatedLogs,
    (log) =>
      log.level === "INFO" &&
      hasText(log.message, "started on release") &&
      hasText(log.message, expected.releaseVersion)
  );
  const latencyLog = findLog(
    correlatedLogs,
    (log) =>
      log.level === "WARN" &&
      hasText(log.message, `${expected.observedLatencyMs}ms`)
  );
  const timeoutLog = findLog(
    correlatedLogs,
    (log) =>
      log.level === "ERROR" &&
      hasText(log.message, expected.failureCode) &&
      hasText(log.message, `HTTP ${expected.httpStatus}`)
  );
  const transactionLog = findLog(
    correlatedLogs,
    (log) =>
      log.level === "ERROR" &&
      hasText(log.message, expected.transactionId) &&
      hasText(log.message, "failed")
  );

  const checks: DiagnosticIntegrityCheck[] = [
    check(
      "request-present",
      "Canonical request exists",
      request ? true : null,
      request ? `${request.method} ${request.path} · ${request.requestId}` : expected.requestId
    ),
    check(
      "request-release",
      "Request points to the affected release",
      request ? request.releaseVersion === expected.releaseVersion : null,
      request ? `v${request.releaseVersion}` : `expected v${expected.releaseVersion}`
    ),
    check(
      "request-failure",
      "HTTP failure matches the timeout evidence",
      request
        ? request.responseStatus === expected.httpStatus &&
          request.failureCode === expected.failureCode &&
          request.durationMs === expected.observedLatencyMs
        : null,
      request
        ? `HTTP ${request.responseStatus} · ${request.durationMs} ms · ${request.failureCode ?? "NO_CODE"}`
        : `expected HTTP ${expected.httpStatus}`
    ),
    check(
      "transaction-present",
      "Canonical synthetic transaction exists",
      transaction ? true : null,
      transaction ? transaction.id : expected.transactionId
    ),
    check(
      "transaction-request",
      "Transaction is linked by the same request ID",
      transaction ? transaction.requestId === expected.requestId : null,
      transaction ? transaction.requestId : expected.requestId
    ),
    check(
      "transaction-release",
      "Transaction records the same application version",
      transaction ? transaction.applicationVersion === expected.releaseVersion : null,
      transaction ? `v${transaction.applicationVersion}` : `expected v${expected.releaseVersion}`
    ),
    check(
      "transaction-failure",
      "Transaction failure matches the request failure",
      transaction
        ? transaction.status === "FAILED" && transaction.failureCode === expected.failureCode
        : null,
      transaction ? `${transaction.status} · ${transaction.failureCode ?? "NO_CODE"}` : expected.failureCode
    ),
    check(
      "request-start-log",
      "Request start log carries the same release context",
      requestStartLog ? true : null,
      requestStartLog?.message ?? `${expected.requestId} start log for v${expected.releaseVersion} missing`
    ),
    check(
      "latency-log",
      "Correlated latency warning exists",
      latencyLog ? true : null,
      latencyLog?.message ?? `${expected.observedLatencyMs} ms warning missing`
    ),
    check(
      "timeout-log",
      "Correlated timeout error exists",
      timeoutLog ? true : null,
      timeoutLog?.message ?? `${expected.failureCode} / HTTP ${expected.httpStatus} error missing`
    ),
    check(
      "transaction-log",
      "Correlated transaction failure log exists",
      transactionLog ? true : null,
      transactionLog?.message ?? `${expected.transactionId} failure log missing`
    )
  ];

  const hasFailure = checks.some((item) => item.status === "FAIL");
  const hasMissing = checks.some((item) => item.status === "MISSING") || !deploymentLog;
  const status: DiagnosticCorrelationStatus = hasFailure
    ? "MISMATCH"
    : hasMissing
      ? "PARTIAL"
      : "COMPLETE";

  const trail: DiagnosticTrailItem[] = [
    {
      key: "DEPLOYMENT",
      label: "Release deployed",
      timestamp: formatTimestamp(deploymentLog?.timestamp),
      detail: deploymentLog?.message ?? `Deployment marker for v${expected.releaseVersion} is unavailable.`,
      correlation: `release v${expected.releaseVersion}`,
      tone: "neutral"
    },
    {
      key: "REQUEST",
      label: "Request entered the service",
      timestamp: formatTimestamp(requestStartLog?.timestamp ?? request?.createdAt),
      detail: request
        ? `${request.method} ${request.path} · request ${request.requestId} · release v${request.releaseVersion}`
        : `Persisted request ${expected.requestId} is unavailable.`,
      correlation: expected.requestId,
      tone: "neutral"
    },
    {
      key: "LATENCY",
      label: "Latency exceeded the configured boundary",
      timestamp: formatTimestamp(latencyLog?.timestamp),
      detail: latencyLog?.message ?? `No correlated latency warning was found for ${expected.requestId}.`,
      correlation: expected.requestId,
      tone: "warning"
    },
    {
      key: "TIMEOUT",
      label: "Request failed with timeout evidence",
      timestamp: formatTimestamp(timeoutLog?.timestamp),
      detail: timeoutLog?.message ?? `No ${expected.failureCode} error was found for ${expected.requestId}.`,
      correlation: `${expected.requestId} · v${expected.releaseVersion}`,
      tone: "danger"
    },
    {
      key: "TRANSACTION",
      label: "Synthetic transaction persisted as failed",
      timestamp: formatTimestamp(transaction?.createdAt),
      detail: transaction
        ? `${transaction.id} · ${transaction.status} · ${transaction.failureCode ?? "NO_CODE"}`
        : `Persisted transaction ${expected.transactionId} is unavailable.`,
      correlation: `${expected.transactionId} · ${expected.requestId}`,
      tone: "danger"
    }
  ];

  return {
    status,
    request,
    transaction,
    correlatedLogs,
    deploymentLog,
    requestStartLog,
    latencyLog,
    timeoutLog,
    transactionLog,
    checks,
    trail
  };
}
