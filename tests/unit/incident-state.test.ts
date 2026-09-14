import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain";
import { transitionIncident } from "@/lib/domain/incident-state";

const happyPath = [
  ["OPEN", "INVESTIGATING"],
  ["INVESTIGATING", "REGRESSION_CONFIRMED"],
  ["REGRESSION_CONFIRMED", "REMEDIATION_SELECTED"],
  ["REMEDIATION_SELECTED", "ROLLING_BACK"],
  ["ROLLING_BACK", "READY_FOR_VALIDATION"],
  ["READY_FOR_VALIDATION", "VALIDATED"],
  ["VALIDATED", "RESOLVED"]
] as const;

describe("low-level incident state machine", () => {
  it.each(happyPath)("allows %s → %s", (from, to) => {
    expect(transitionIncident(from, to)).toBe(to);
  });

  it("rejects OPEN → RESOLVED", () => {
    expect(() => transitionIncident("OPEN", "RESOLVED")).toThrow(DomainError);
  });

  it("rejects transitions from RESOLVED with the expected code", () => {
    try {
      transitionIncident("RESOLVED", "OPEN");
      throw new Error("Expected DomainError");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ code: "INVALID_INCIDENT_TRANSITION" });
    }
  });
});
