import { describe, expect, it } from "vitest";
import { buildSyntheticScenarioSeed } from "@/lib/data/synthetic-scenario";
import { assertSyntheticScenarioSeedInvariants } from "@/lib/data/scenario-invariants";

describe("scenario invariant protection", () => {
  it("rejects an already progressed reset incident", () => {
    const seed = buildSyntheticScenarioSeed();
    const invalid = { ...seed, incident: { ...seed.incident, status: "INVESTIGATING" as never } };
    expect(() => assertSyntheticScenarioSeedInvariants(invalid)).toThrow(/OPEN/);
  });

  it("rejects validation check deletion", () => {
    const seed = buildSyntheticScenarioSeed();
    const invalid = { ...seed, validationChecks: seed.validationChecks.slice(0, 3) };
    expect(() => assertSyntheticScenarioSeedInvariants(invalid)).toThrow(/canonical validation checks/);
  });

  it("rejects correlation id drift", () => {
    const seed = buildSyntheticScenarioSeed();
    const invalid = {
      ...seed,
      requests: [{ ...seed.requests[0], requestId: "req_drifted" }]
    };
    expect(() => assertSyntheticScenarioSeedInvariants(invalid)).toThrow(/correlation id drifted/);
  });
});
