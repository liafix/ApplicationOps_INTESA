import { describe, expect, it } from "vitest";
import { formatDuration, millisecondsBetween, rootCauseDisclosureState } from "@/lib/ui/release-evidence";

describe("release evidence disclosure", () => {
  it("keeps root-cause evidence locked before investigation starts", () => {
    expect(rootCauseDisclosureState("OPEN", null)).toBe("LOCKED");
  });

  it("shows only a hypothesis while investigating", () => {
    expect(rootCauseDisclosureState("INVESTIGATING", null)).toBe("HYPOTHESIS");
  });

  it("fails closed when the status advances without a persisted root-cause code", () => {
    expect(rootCauseDisclosureState("REGRESSION_CONFIRMED", null)).toBe("HYPOTHESIS");
  });

  it("reveals the confirmation only for the persisted release-regression code", () => {
    expect(rootCauseDisclosureState("REGRESSION_CONFIRMED", "INSUFFICIENT_EVIDENCE")).toBe("HYPOTHESIS");
    expect(rootCauseDisclosureState("REGRESSION_CONFIRMED", "RELEASE_TIMEOUT_REGRESSION")).toBe("CONFIRMED");
    expect(rootCauseDisclosureState("READY_FOR_VALIDATION", "RELEASE_TIMEOUT_REGRESSION")).toBe("CONFIRMED");
  });

  it("formats the canonical deployment-to-incident timing deterministically", () => {
    const delta = millisecondsBetween("2026-09-02T07:30:00.000Z", "2026-09-02T07:32:20.000Z");
    expect(delta).toBe(140000);
    expect(formatDuration(delta)).toBe("2m 20s");
  });
});
