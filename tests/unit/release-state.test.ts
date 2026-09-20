import { describe, expect, it } from "vitest";
import { DomainError, INITIAL_RELEASE_PAIR, completeRollback, startRollback } from "@/lib/domain";

describe("release rollback state", () => {
  it("moves a valid degraded release into rollback and activates the previous release on completion", () => {
    const rolling = startRollback({ ...INITIAL_RELEASE_PAIR });
    expect(rolling).toEqual({
      currentReleaseStatus: "ROLLING_BACK",
      previousReleaseStatus: "STABLE",
      activeRelease: "CURRENT"
    });

    expect(completeRollback(rolling)).toEqual({
      currentReleaseStatus: "ROLLED_BACK",
      previousReleaseStatus: "STABLE",
      activeRelease: "PREVIOUS"
    });
  });

  it("rejects rollback from an invalid release state", () => {
    expect(() =>
      startRollback({
        currentReleaseStatus: "STABLE",
        previousReleaseStatus: "STABLE",
        activeRelease: "CURRENT"
      })
    ).toThrow(DomainError);
  });
});
