import { describe, expect, it } from "vitest";
import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle, MockPokemon } from "../testing";
import type { AbilityDefinition } from "../types/ability-definition";
import type { MoveDefinition } from "../types/move-definition";
import { AbilityHandlerRegistry } from "./ability-handler-registry";
import { computePressureBonus, isOffensiveMove } from "./pressure";

const pressureAbility: AbilityDefinition = {
  id: "pressure",
  targetedCtBonus: 50,
  name: { fr: "Pression", en: "Pressure" },
  shortDescription: { fr: "", en: "" },
};

const tackle: MoveDefinition = {
  id: "tackle",
  name: "Tackle",
  type: PokemonType.Normal,
  category: Category.Physical,
  power: 40,
  accuracy: 100,
  pp: 35,
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [{ kind: EffectKind.Damage }],
};

const earthquake: MoveDefinition = {
  id: "earthquake",
  name: "Earthquake",
  type: PokemonType.Ground,
  category: Category.Physical,
  power: 100,
  accuracy: 100,
  pp: 10,
  targeting: { kind: TargetingKind.Zone, radius: 2 },
  effects: [{ kind: EffectKind.Damage }],
};

const recover: MoveDefinition = {
  id: "recover",
  name: "Recover",
  type: PokemonType.Normal,
  category: Category.Status,
  power: 0,
  accuracy: 100,
  pp: 5,
  targeting: { kind: TargetingKind.Self },
  effects: [{ kind: EffectKind.HealSelf, percent: 0.5 }],
};

const swordsDance: MoveDefinition = {
  id: "swords-dance",
  name: "Swords Dance",
  type: PokemonType.Normal,
  category: Category.Status,
  power: 0,
  accuracy: 100,
  pp: 20,
  targeting: { kind: TargetingKind.Self },
  effects: [
    { kind: EffectKind.StatChange, stat: StatName.Attack, stages: 2, target: EffectTarget.Self },
  ],
};

describe("isOffensiveMove", () => {
  it("returns true for Damage effects", () => {
    expect(isOffensiveMove(tackle)).toBe(true);
  });

  it("returns true for Drain effects", () => {
    const drainMove: MoveDefinition = {
      ...tackle,
      effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
    };
    expect(isOffensiveMove(drainMove)).toBe(true);
  });

  it("returns false for HealSelf-only moves", () => {
    expect(isOffensiveMove(recover)).toBe(false);
  });

  it("returns false for StatChange-only moves", () => {
    expect(isOffensiveMove(swordsDance)).toBe(false);
  });
});

describe("computePressureBonus", () => {
  it("returns 50 for a single Pressure target hit by an offensive move", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, { id: "attacker" });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      abilityId: "pressure",
    });
    const state = MockBattle.stateFrom([attacker, target]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(computePressureBonus("attacker", tackle, ["target"], state, registry)).toBe(50);
  });

  it("returns 0 when target has no Pressure ability", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, { id: "attacker" });
    const target = MockPokemon.fresh(MockBattle.player2Slow, { id: "target" });
    const state = MockBattle.stateFrom([attacker, target]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(computePressureBonus("attacker", tackle, ["target"], state, registry)).toBe(0);
  });

  it("returns 0 when no abilityRegistry is provided", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, { id: "attacker" });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      abilityId: "pressure",
    });
    const state = MockBattle.stateFrom([attacker, target]);

    expect(computePressureBonus("attacker", tackle, ["target"], state, null)).toBe(0);
  });

  it("returns 0 for non-offensive moves (HealSelf)", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "attacker",
      abilityId: "pressure",
    });
    const state = MockBattle.stateFrom([attacker]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(computePressureBonus("attacker", recover, ["attacker"], state, registry)).toBe(0);
  });

  it("returns 0 for non-offensive moves (StatChange)", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, { id: "attacker" });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      abilityId: "pressure",
    });
    const state = MockBattle.stateFrom([attacker, target]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(computePressureBonus("attacker", swordsDance, ["target"], state, registry)).toBe(0);
  });

  it("stacks the bonus across multiple Pressure targets in an AoE", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, { id: "attacker" });
    const t1 = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "t1",
      position: { x: 1, y: 1 },
      abilityId: "pressure",
    });
    const t2 = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "t2",
      position: { x: 2, y: 2 },
      abilityId: "pressure",
    });
    const state = MockBattle.stateFrom([attacker, t1, t2]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(computePressureBonus("attacker", earthquake, ["t1", "t2"], state, registry)).toBe(100);
  });

  it("counts only Pressure-bearers in a mixed AoE", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, { id: "attacker" });
    const t1 = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "t1",
      abilityId: "pressure",
    });
    const t2 = MockPokemon.fresh(MockBattle.player2Slow, { id: "t2" });
    const t3 = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "t3",
      abilityId: "pressure",
    });
    const state = MockBattle.stateFrom([attacker, t1, t2, t3]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(computePressureBonus("attacker", earthquake, ["t1", "t2", "t3"], state, registry)).toBe(
      100,
    );
  });

  it("ignores the attacker even if they have Pressure (self-hit AoE)", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "attacker",
      abilityId: "pressure",
    });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      abilityId: "pressure",
    });
    const state = MockBattle.stateFrom([attacker, target]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(
      computePressureBonus("attacker", earthquake, ["attacker", "target"], state, registry),
    ).toBe(50);
  });

  it("returns 0 when target is dead or removed from state", () => {
    const attacker = MockPokemon.fresh(MockBattle.player1Fast, { id: "attacker" });
    const state = MockBattle.stateFrom([attacker]);
    const registry = new AbilityHandlerRegistry([pressureAbility]);

    expect(computePressureBonus("attacker", tackle, ["ghost"], state, registry)).toBe(0);
  });
});
