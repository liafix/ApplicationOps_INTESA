import type { IncidentStatus } from "../domain/types";

export type RootCauseDisclosureState = "LOCKED" | "HYPOTHESIS" | "CONFIRMED";

const investigationStatuses: readonly IncidentStatus[] = [
  "INVESTIGATING",
  "REGRESSION_CONFIRMED",
  "REMEDIATION_SELECTED",
  "ROLLING_BACK",
  "READY_FOR_VALIDATION",
  "VALIDATED",
  "RESOLVED"
];

export function rootCauseDisclosureState(
  status: IncidentStatus,
  persistedRootCauseCode: string | null | undefined
): RootCauseDisclosureState {
  if (!investigationStatuses.includes(status)) return "LOCKED";
  if (persistedRootCauseCode !== "RELEASE_TIMEOUT_REGRESSION") return "HYPOTHESIS";
  return "CONFIRMED";
}

export function millisecondsBetween(earlierIso: string, laterIso: string): number {
  const earlier = new Date(earlierIso).getTime();
  const later = new Date(laterIso).getTime();
  if (!Number.isFinite(earlier) || !Number.isFinite(later) || later < earlier) return 0;
  return later - earlier;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${remainder}s`;
}
