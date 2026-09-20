import { DomainError } from "./errors";
import type { RootCauseAssessment, RootCauseEvidence } from "./types";

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function assertValidRootCauseEvidence(evidence: RootCauseEvidence): void {
  if (
    !isPositiveFinite(evidence.currentTimeoutMs) ||
    !isPositiveFinite(evidence.previousTimeoutMs) ||
    !isPositiveFinite(evidence.observedDownstreamLatencyMs) ||
    !Number.isInteger(evidence.timeoutErrorCount) ||
    evidence.timeoutErrorCount < 0
  ) {
    throw new DomainError(
      "INVALID_EVIDENCE",
      "Root-cause evidence must contain positive finite timings and a non-negative integer timeout-error count."
    );
  }
}

export function assessRootCause(evidence: RootCauseEvidence): RootCauseAssessment {
  assertValidRootCauseEvidence(evidence);

  const currentTimeoutBelowObservedLatency =
    evidence.currentTimeoutMs < evidence.observedDownstreamLatencyMs;
  const previousTimeoutAboveObservedLatency =
    evidence.previousTimeoutMs > evidence.observedDownstreamLatencyMs;

  if (
    currentTimeoutBelowObservedLatency &&
    previousTimeoutAboveObservedLatency &&
    evidence.incidentStartedAfterDeployment &&
    evidence.timeoutErrorCount > 0
  ) {
    return {
      code: "RELEASE_TIMEOUT_REGRESSION",
      confidence: "HIGH",
      explanation:
        "The current release timeout is below observed downstream latency, timeout errors began after deployment, and the previous stable timeout was above the observed latency."
    };
  }

  return {
    code: "INSUFFICIENT_EVIDENCE",
    confidence: "LOW",
    explanation:
      "The available evidence does not establish the deterministic release timeout regression."
  };
}
