import { SCENARIO } from "../lib/data/synthetic-scenario";
import {
  rollbackRecoveryEvidence,
  rollbackRecoveryMode,
  type RollbackRecoveryInput
} from "../lib/ui/rollback-recovery";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

function recoveredInput(): RollbackRecoveryInput {
  return {
    incident: {
      status: "READY_FOR_VALIDATION",
      selectedRemediation: "ROLLBACK_RELEASE",
      recoveredRelease: SCENARIO.previousRelease.version,
      application: {
        serviceHealth: "HEALTHY",
        activeReleaseVersion: SCENARIO.previousRelease.version,
        syntheticErrorRate: SCENARIO.recoveredErrorRatePct
      }
    },
    releases: {
      previous: {
        version: SCENARIO.previousRelease.version,
        status: "STABLE",
        downstreamTimeoutMs: 5000,
        syntheticErrorRate: 1.2
      },
      current: {
        version: SCENARIO.currentRelease.version,
        status: "ROLLED_BACK",
        downstreamTimeoutMs: 800,
        syntheticErrorRate: 14.8
      },
      activeReleaseVersion: SCENARIO.previousRelease.version
    },
    requests: [
      {
        requestId: SCENARIO.recoveryRequestId,
        responseStatus: 200,
        releaseVersion: SCENARIO.previousRelease.version,
        failureCode: null
      }
    ],
    transactions: [
      {
        id: SCENARIO.recoveryTransactionId,
        requestId: SCENARIO.recoveryRequestId,
        status: "SUCCEEDED",
        applicationVersion: SCENARIO.previousRelease.version,
        failureCode: null
      }
    ],
    logs: [
      {
        level: "INFO",
        requestId: SCENARIO.recoveryRequestId,
        message: `Synthetic recovery transaction ${SCENARIO.recoveryTransactionId} completed successfully on release ${SCENARIO.previousRelease.version}.`
      }
    ],
    audit: [{ type: "ROLLBACK_STARTED" }, { type: "ROLLBACK_COMPLETED" }]
  };
}

const ready = recoveredInput();
ready.incident = {
  ...ready.incident!,
  status: "REMEDIATION_SELECTED",
  recoveredRelease: null,
  application: {
    serviceHealth: "DEGRADED",
    activeReleaseVersion: SCENARIO.currentRelease.version,
    syntheticErrorRate: 14.8
  }
};
ready.releases = {
  ...ready.releases!,
  current: { ...ready.releases!.current, status: "DEGRADED" },
  activeReleaseVersion: SCENARIO.currentRelease.version
};
ready.requests = [];
ready.transactions = [];
ready.logs = [];
ready.audit = [];
assert(
  rollbackRecoveryMode(ready) === "READY",
  "persisted rollback decision exposes READY execution state"
);

const recovered = recoveredInput();
assert(
  rollbackRecoveryMode(recovered) === "RECOVERED",
  "complete persisted rollback evidence exposes RECOVERED state"
);
const evidence = rollbackRecoveryEvidence(recovered);
assert(
  Object.values(evidence).every(Boolean),
  "all controlled rollback and recovery evidence checks pass"
);
assert(
  recovered.incident?.application.activeReleaseVersion === "2.7.4",
  "active release changes from v2.8.0 to v2.7.4"
);
assert(
  recovered.incident?.application.serviceHealth === "HEALTHY",
  "service health changes from DEGRADED to HEALTHY"
);
assert(
  recovered.incident?.application.syntheticErrorRate === 1.1,
  "synthetic error rate changes from 14.8% to 1.1%"
);
assert(
  recovered.incident?.status === "READY_FOR_VALIDATION",
  "rollback stops at READY_FOR_VALIDATION rather than auto-validating"
);

const incomplete = recoveredInput();
incomplete.transactions = [];
assert(
  rollbackRecoveryMode(incomplete) === "INCONSISTENT",
  "missing recovery transaction fails closed"
);
console.log("PASS11_ROLLBACK_RECOVERY_SMOKE_PASS");
