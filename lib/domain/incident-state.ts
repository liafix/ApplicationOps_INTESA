import { DomainError } from "./errors";
import type { IncidentStatus } from "./types";

const NEXT_STATUS: Record<Exclude<IncidentStatus, "RESOLVED">, IncidentStatus> = {
  OPEN: "INVESTIGATING",
  INVESTIGATING: "REGRESSION_CONFIRMED",
  REGRESSION_CONFIRMED: "REMEDIATION_SELECTED",
  REMEDIATION_SELECTED: "ROLLING_BACK",
  ROLLING_BACK: "READY_FOR_VALIDATION",
  READY_FOR_VALIDATION: "VALIDATED",
  VALIDATED: "RESOLVED"
};

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === "RESOLVED") return false;
  return NEXT_STATUS[from] === to;
}

export function transitionIncident(from: IncidentStatus, to: IncidentStatus): IncidentStatus {
  if (!canTransitionIncident(from, to)) {
    throw new DomainError(
      "INVALID_INCIDENT_TRANSITION",
      `Incident cannot transition from ${from} to ${to}.`
    );
  }
  return to;
}
