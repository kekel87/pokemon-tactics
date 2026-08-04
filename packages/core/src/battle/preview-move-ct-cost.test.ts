import { describe, expect, it } from "vitest";
import { MockPokemon } from "../testing";
import { buildMoveTestEngine } from "../testing/build-move-test-engine";
import { CT_START, computeMoveCost } from "./ct-costs";

function engineWith(targetAbilityId?: string) {
  const caster = {
    ...MockPokemon.base,
    id: "caster",
    moveIds: ["tackle", "earthquake"],
    position: { x: 0, y: 0 },
  };
  const foe = {
    ...MockPokemon.base,
    id: "foe",
    playerId: "player-2" as const,
    abilityId: targetAbilityId,
    position: { x: 1, y: 0 },
  };
  const other = {
    ...MockPokemon.base,
    id: "other",
    playerId: "player-2" as const,
    abilityId: targetAbilityId,
    position: { x: 0, y: 1 },
  };
  return buildMoveTestEngine([caster, foe, other], { activePokemonId: "caster" });
}

describe("BattleEngine.previewMoveCtCost", () => {
  it("returns the base cost alone when no target is given", () => {
    const { engine } = engineWith();

    const cost = engine.previewMoveCtCost("tackle");

    expect(cost.base).toBe(computeMoveCost(35, 40, undefined));
    expect(cost.pressureBonus).toBe(0);
    expect(cost.total).toBe(cost.base);
  });

  it("adds the Pression surcharge for a target carrying it", () => {
    const { engine } = engineWith("pressure");

    const cost = engine.previewMoveCtCost("tackle", ["foe"]);

    expect(cost.pressureBonus).toBeGreaterThan(0);
    expect(cost.total).toBe(cost.base + cost.pressureBonus);
  });

  it("stacks the Pression surcharge once per carrying target", () => {
    const { engine } = engineWith("pressure");

    const single = engine.previewMoveCtCost("earthquake", ["foe"]);
    const both = engine.previewMoveCtCost("earthquake", ["foe", "other"]);

    expect(both.pressureBonus).toBe(single.pressureBonus * 2);
    expect(both.base).toBe(single.base);
  });

  it("bills no surcharge when the targets carry no Pression", () => {
    const { engine } = engineWith();

    const cost = engine.previewMoveCtCost("tackle", ["foe", "other"]);

    expect(cost.pressureBonus).toBe(0);
  });

  it("falls back to the CT start value for an unknown move", () => {
    const { engine } = engineWith("pressure");

    const cost = engine.previewMoveCtCost("not-a-move", ["foe"]);

    expect(cost).toEqual({ base: CT_START, pressureBonus: 0, total: CT_START });
  });
});
