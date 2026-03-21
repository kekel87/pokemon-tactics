import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle } from "../testing/mock-battle";
import type { MoveDefinition } from "../types/move-definition";
import { checkAccuracy } from "./accuracy-check";

const move100: MoveDefinition = {
  id: "sure-hit",
  name: "Sure Hit",
  type: PokemonType.Normal,
  category: Category.Physical,
  power: 40,
  accuracy: 100,
  pp: 20,
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [{ kind: EffectKind.Damage }],
};

const move75: MoveDefinition = { ...move100, id: "risky", accuracy: 75 };

function fresh(base: typeof MockBattle.player1Fast, overrides?: Record<string, unknown>) {
  return {
    ...base,
    position: { ...base.position },
    baseStats: { ...base.baseStats },
    derivedStats: { ...base.derivedStats },
    statStages: { ...base.statStages, ...overrides },
    statusEffects: [...base.statusEffects],
    moveIds: [...base.moveIds],
    currentPp: { ...base.currentPp },
  };
}

describe("checkAccuracy", () => {
  it("always hits with accuracy 100 and no stage modifiers", () => {
    for (let i = 0; i < 20; i++) {
      expect(
        checkAccuracy(move100, fresh(MockBattle.player1Fast), fresh(MockBattle.player2Slow)),
      ).toBe(true);
    }
  });

  it("can miss with accuracy < 100", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const result = checkAccuracy(
      move75,
      fresh(MockBattle.player1Fast),
      fresh(MockBattle.player2Slow),
    );
    expect(result).toBe(false);

    vi.restoreAllMocks();
  });

  it("hits with accuracy < 100 when roll is low", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);

    const result = checkAccuracy(
      move75,
      fresh(MockBattle.player1Fast),
      fresh(MockBattle.player2Slow),
    );
    expect(result).toBe(true);

    vi.restoreAllMocks();
  });

  it("reduces hit rate when defender has evasion boost", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.6);

    const defender = fresh(MockBattle.player2Slow, { [StatName.Evasion]: 1 });
    const result = checkAccuracy(move75, fresh(MockBattle.player1Fast), defender);
    expect(result).toBe(false);

    vi.restoreAllMocks();
  });

  it("increases hit rate when attacker has accuracy boost", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const attackerBoosted = fresh(MockBattle.player1Fast, { [StatName.Accuracy]: 6 });
    const result = checkAccuracy(move75, attackerBoosted, fresh(MockBattle.player2Slow));
    expect(result).toBe(true);

    vi.restoreAllMocks();
  });
});
