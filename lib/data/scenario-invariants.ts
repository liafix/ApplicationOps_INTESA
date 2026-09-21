import { SCENARIO, type SyntheticScenarioSeed } from "./synthetic-scenario";
import { REQUIRED_VALIDATION_DEFINITIONS } from "../domain/validation";

export class ScenarioInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioInvariantError";
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ScenarioInvariantError(message);
}

export function assertSyntheticScenarioSeedInvariants(seed: SyntheticScenarioSeed): void {
  assert(seed.application.id === SCENARIO.applicationId, "Unexpected synthetic application id.");
  assert(seed.application.serviceHealth === "DEGRADED", "Initial application health must be DEGRADED.");
  assert(
    seed.application.activeReleaseVersion === SCENARIO.currentRelease.version,
    "The degraded current release must be active initially."
  );

  assert(seed.releases.length === 2, "The scenario must contain exactly two releases.");
  const previous = seed.releases.find((release) => release.version === SCENARIO.previousRelease.version);
  const current = seed.releases.find((release) => release.version === SCENARIO.currentRelease.version);
  assert(previous?.status === "STABLE", "Previous release must be STABLE.");
  assert(current?.status === "DEGRADED", "Current release must be DEGRADED.");
  assert(
    current.downstreamTimeoutMs < SCENARIO.observedDownstreamLatencyMs,
    "Current release timeout must be below observed latency for the deterministic regression."
  );
  assert(
    previous.downstreamTimeoutMs > SCENARIO.observedDownstreamLatencyMs,
    "Previous stable timeout must remain above observed latency."
  );

  assert(seed.incident.status === "OPEN", "Reset incident must start OPEN.");
  assert(seed.incident.rootCauseCode === null, "Reset incident must not pre-populate root cause.");
  assert(seed.incident.selectedRemediation === null, "Reset incident must not pre-select remediation.");
  assert(seed.incident.recoveredRelease === null, "Reset incident must not claim recovery.");
  assert(
    seed.incident.createdAt.getTime() > new Date(SCENARIO.timeline.currentReleaseDeployedAt).getTime(),
    "Incident must start after the problematic release deployment."
  );

  const request = seed.requests[0];
  const transaction = seed.transactions[0];
  assert(seed.requests.length === 1, "The MVP scenario must contain exactly one failed API request.");
  assert(seed.transactions.length === 1, "The MVP scenario must contain exactly one failed synthetic transaction.");
  assert(request.requestId === SCENARIO.requestId, "API request correlation id drifted.");
  assert(transaction.requestId === SCENARIO.requestId, "Transaction correlation id drifted.");
  assert(request.releaseVersion === SCENARIO.currentRelease.version, "Request release version drifted.");
  assert(transaction.applicationVersion === SCENARIO.currentRelease.version, "Transaction release version drifted.");
  assert(request.failureCode === SCENARIO.failureCode, "Request failure code drifted.");
  assert(transaction.failureCode === SCENARIO.failureCode, "Transaction failure code drifted.");

  const correlatedLogs = seed.logs.filter((log) => log.requestId === SCENARIO.requestId);
  assert(correlatedLogs.length >= 4, "Expected correlated INFO/WARN/ERROR evidence is missing.");
  assert(correlatedLogs.some((log) => log.level === "ERROR"), "Timeout ERROR evidence is required.");

  assert(
    seed.validationChecks.length === REQUIRED_VALIDATION_DEFINITIONS.length,
    "Reset must create exactly the canonical validation checks."
  );
  for (const definition of REQUIRED_VALIDATION_DEFINITIONS) {
    const matching = seed.validationChecks.filter((check) => check.key === definition.id);
    assert(matching.length === 1, `Validation check ${definition.id} must exist exactly once.`);
    assert(matching[0].required === true, `Validation check ${definition.id} must be required.`);
    assert(matching[0].status === "PENDING", `Validation check ${definition.id} must reset to PENDING.`);
  }

  assert(seed.auditEvents.length >= 3, "Initial audit context is incomplete.");
  assert(
    seed.auditEvents.some((event) => event.type === "INCIDENT_CREATED"),
    "Initial audit trail must include INCIDENT_CREATED."
  );
}
