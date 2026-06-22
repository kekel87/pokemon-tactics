import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import type { MoveDefinition } from "../types/move-definition";
import { checkAccuracy } from "./accuracy-check";

const { abilityRegistry } = loadData();

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

  it("terrainEvasionBonus reduces hit rate like +1 evasion stage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.6);

    const defender = fresh(MockBattle.player2Slow);
    const resultWithout = checkAccuracy(move75, fresh(MockBattle.player1Fast), defender, () => 0.6);
    const resultWith = checkAccuracy(move75, fresh(MockBattle.player1Fast), defender, () => 0.6, 1);

    expect(resultWithout).toBe(true);
    expect(resultWith).toBe(false);

    vi.restoreAllMocks();
  });

  it("terrainEvasionBonus stacks with existing evasion stages", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const defender = fresh(MockBattle.player2Slow, { [StatName.Evasion]: 1 });
    const result = checkAccuracy(move75, fresh(MockBattle.player1Fast), defender, () => 0.5, 1);
    expect(result).toBe(false);

    vi.restoreAllMocks();
  });
});

describe("checkAccuracy ability onEvasionModify", () => {
  const statusMove: MoveDefinition = {
    ...move100,
    id: "lull",
    category: Category.Status,
    power: 0,
    accuracy: 80,
    effects: [],
  };
  const damageMove80: MoveDefinition = { ...move100, id: "risky80", accuracy: 80 };

  it("tangled-feet halves incoming accuracy while the holder is confused", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const confusedHolder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      abilityId: "tangled-feet",
      volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
    });

    // Roll 0.5: 80% damage move vs confused holder → 80 * 0.5 = 40 < 50 → miss.
    expect(
      checkAccuracy(damageMove80, attacker, confusedHolder, () => 0.5, 0, abilityRegistry),
    ).toBe(false);
  });

  it("tangled-feet does not reduce accuracy when the holder is not confused", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const calmHolder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      abilityId: "tangled-feet",
    });

    // Roll 0.5: 80% damage move at full accuracy → 80 > 50 → hit.
    expect(checkAccuracy(damageMove80, attacker, calmHolder, () => 0.5, 0, abilityRegistry)).toBe(
      true,
    );
  });

  it("wonder-skin halves the accuracy of an incoming status move", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      abilityId: "wonder-skin",
    });

    // Roll 0.5: 80% status move vs Wonder Skin → 80 * 0.5 = 40 < 50 → miss.
    expect(checkAccuracy(statusMove, attacker, holder, () => 0.5, 0, abilityRegistry)).toBe(false);
  });

  it("wonder-skin does not affect damaging moves", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      abilityId: "wonder-skin",
    });

    // Roll 0.5: 80% damage move (not status) at full accuracy → 80 > 50 → hit.
    expect(checkAccuracy(damageMove80, attacker, holder, () => 0.5, 0, abilityRegistry)).toBe(true);
  });
});
