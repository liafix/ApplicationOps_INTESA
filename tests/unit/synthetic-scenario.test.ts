import { describe, expect, it } from "vitest";
import { buildSyntheticScenarioSeed, SCENARIO } from "@/lib/data/synthetic-scenario";
import { assertSyntheticScenarioSeedInvariants } from "@/lib/data/scenario-invariants";

function normalized(seed: ReturnType<typeof buildSyntheticScenarioSeed>) {
  return JSON.parse(JSON.stringify(seed));
}

describe("synthetic ApplicationOps scenario", () => {
  it("is deterministic across fresh builds", () => {
    expect(normalized(buildSyntheticScenarioSeed())).toEqual(normalized(buildSyntheticScenarioSeed()));
  });

  it("passes the canonical PASS 2 invariants", () => {
    expect(() => assertSyntheticScenarioSeedInvariants(buildSyntheticScenarioSeed())).not.toThrow();
  });

  it("correlates request, transaction and log evidence to the same request id", () => {
    const seed = buildSyntheticScenarioSeed();
    expect(seed.requests).toHaveLength(1);
    expect(seed.transactions).toHaveLength(1);
    expect(seed.requests[0].requestId).toBe(SCENARIO.requestId);
    expect(seed.transactions[0].requestId).toBe(SCENARIO.requestId);
    expect(seed.logs.filter((log) => log.requestId === SCENARIO.requestId)).toHaveLength(4);
  });

  it("starts with exactly four required PENDING validation checks", () => {
    const checks = buildSyntheticScenarioSeed().validationChecks;
    expect(checks).toHaveLength(4);
    expect(new Set(checks.map((check) => check.key)).size).toBe(4);
    expect(checks.every((check) => check.required && check.status === "PENDING")).toBe(true);
  });

  it("contains only synthetic identifiers and no bank/customer PII fields", () => {
    const serialized = JSON.stringify(buildSyntheticScenarioSeed()).toLowerCase();
    for (const forbidden of ["iban", "cardnumber", "accountnumber", "customername", "personalnumber"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
