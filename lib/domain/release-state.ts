import { DomainError } from "./errors";
import type { ReleaseStatus } from "./types";

export interface ReleasePairState {
  currentReleaseStatus: ReleaseStatus;
  previousReleaseStatus: ReleaseStatus;
  activeRelease: "CURRENT" | "PREVIOUS";
}

export const INITIAL_RELEASE_PAIR: Readonly<ReleasePairState> = Object.freeze({
  currentReleaseStatus: "DEGRADED",
  previousReleaseStatus: "STABLE",
  activeRelease: "CURRENT"
});

export function startRollback(state: ReleasePairState): ReleasePairState {
  if (
    state.currentReleaseStatus !== "DEGRADED" ||
    state.previousReleaseStatus !== "STABLE" ||
    state.activeRelease !== "CURRENT"
  ) {
    throw new DomainError(
      "INVALID_RELEASE_TRANSITION",
      "Rollback can start only while the degraded current release is active and the previous release is stable."
    );
  }

  return {
    currentReleaseStatus: "ROLLING_BACK",
    previousReleaseStatus: "STABLE",
    activeRelease: "CURRENT"
  };
}

export function completeRollback(state: ReleasePairState): ReleasePairState {
  if (
    state.currentReleaseStatus !== "ROLLING_BACK" ||
    state.previousReleaseStatus !== "STABLE" ||
    state.activeRelease !== "CURRENT"
  ) {
    throw new DomainError(
      "INVALID_RELEASE_TRANSITION",
      "Rollback can complete only from a valid rolling-back state."
    );
  }

  return {
    currentReleaseStatus: "ROLLED_BACK",
    previousReleaseStatus: "STABLE",
    activeRelease: "PREVIOUS"
  };
}
