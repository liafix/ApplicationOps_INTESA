import { describe, expect, it } from "vitest";
import {
  allRequiredValidationPassed,
  assertCanResolve,
  createPendingValidationChecks
} from "@/lib/domain";

describe("validation gate", () => {
  it("blocks resolution before 4/4 required checks pass", () => {
    const checks = createPendingValidationChecks().map((check, index) => ({
      ...check,
      status: index < 3 ? ("PASS" as const) : ("PENDING" as const)
    }));
    expect(allRequiredValidationPassed(checks)).toBe(false);
    expect(() => assertCanResolve(checks)).toThrow();
  });

  it("allows resolution when all canonical required checks pass", () => {
    const checks = createPendingValidationChecks().map((check) => ({
      ...check,
      status: "PASS" as const
    }));
    expect(allRequiredValidationPassed(checks)).toBe(true);
    expect(() => assertCanResolve(checks)).not.toThrow();
  });

  it("cannot be bypassed with a partial check set", () => {
    const [onlyOne] = createPendingValidationChecks();
    expect(allRequiredValidationPassed([{ ...onlyOne, status: "PASS" }])).toBe(false);
  });

  it("cannot be bypassed with duplicate canonical checks", () => {
    const checks = createPendingValidationChecks().map((check) => ({
      ...check,
      status: "PASS" as const
    }));
    expect(allRequiredValidationPassed([...checks, { ...checks[0] }])).toBe(false);
  });

  it("returns fresh check objects instead of shared mutable state", () => {
    const first = createPendingValidationChecks();
    first[0].status = "PASS";
    const second = createPendingValidationChecks();
    expect(second[0].status).toBe("PENDING");
  });
});
