import { describe, expect, it } from "vitest";
import { loadStatusRulesFromReference } from "./load-status-rules";

describe("loadStatusRulesFromReference", () => {
  it("loads Champions values from full file", () => {
    const rules = loadStatusRulesFromReference({
      source: "test",
      fetchedAt: "2026-04-15",
      status: {
        paralysis: { skipRate: 0.125, speedMult: 0.5 },
        freeze: { thawRate: 0.25, maxTurns: 3 },
        sleep: { minTurns: 2, maxTurns: 3, sampleTurns: [2, 3, 3] },
      },
    });

    expect(rules.paralysis.skipRate).toBe(0.125);
    expect(rules.paralysis.speedMult).toBe(0.5);
    expect(rules.freeze.thawRate).toBe(0.25);
    expect(rules.freeze.maxTurns).toBe(3);
    expect(rules.sleep.sampleTurns).toEqual([2, 3, 3]);
  });

  it("falls back to Champions defaults for missing fields", () => {
    const rules = loadStatusRulesFromReference({
      source: "test",
      fetchedAt: "2026-04-15",
      status: {},
    });

    expect(rules.paralysis.skipRate).toBe(1 / 8);
    expect(rules.freeze.thawRate).toBe(1 / 4);
    expect(rules.freeze.maxTurns).toBe(3);
    expect(rules.sleep.sampleTurns).toEqual([2, 3, 3]);
  });

  it("ignores minTurns/maxTurns when sampleTurns is provided", () => {
    const rules = loadStatusRulesFromReference({
      source: "test",
      fetchedAt: "2026-04-15",
      status: {
        sleep: { minTurns: 1, maxTurns: 5, sampleTurns: [2, 4] },
      },
    });

    expect(rules.sleep.sampleTurns).toEqual([2, 4]);
  });
});
