import { typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { buildItemTestEngine, MockPokemon } from "../testing";
import { getTypeEffectiveness } from "./damage-calculator";

// Famille Type manip (plan 143): mutation runtime du type via PokemonInstance.typeOverride.

describe("Type manip — Conversion", () => {
  it("sets the caster's type to its first move's type and routes through every type read", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thunderbolt", "conversion"],
    });
    const { engine, state } = buildItemTestEngine([caster]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "conversion",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.typeOverride).toEqual([PokemonType.Electric]);
    expect(engine.getPokemonTypes(caster.id)).toEqual([PokemonType.Electric]);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.TypeChanged);
  });

  it("fails when the first move's type is already a current type", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["water-gun", "conversion"],
    });
    const { engine, state } = buildItemTestEngine([caster]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "conversion",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.typeOverride).toBeUndefined();
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveFailed);
  });
});

describe("Type manip — Conversion 2", () => {
  it("becomes a type that resists the target's last-used move", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["conversion-2"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      lastUsedMoveId: "thunderbolt",
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "conversion-2",
      targetPosition: { x: 1, y: 0 },
    });

    const chosen = state.pokemon.get(caster.id)?.typeOverride;
    expect(chosen).toHaveLength(1);
    expect(getTypeEffectiveness(PokemonType.Electric, chosen ?? [], typeChart)).toBeLessThan(1);
  });

  it("fails when the target has not acted yet", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["conversion-2"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      lastUsedMoveId: undefined,
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "conversion-2",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.typeOverride).toBeUndefined();
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveFailed);
  });
});

describe("Type manip — Copie-Type (reflect-type)", () => {
  it("copies the target's effective types onto the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["reflect-type"],
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "reflect-type",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.typeOverride).toEqual(engine.getPokemonTypes(target.id));
  });

  it("copies a type override already carried by the target", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["reflect-type"],
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      typeOverride: [PokemonType.Ghost],
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "reflect-type",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.typeOverride).toEqual([PokemonType.Ghost]);
  });
});

describe("Type manip — Détrempage (soak)", () => {
  it("turns the target into pure Water", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["soak"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "soak",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.typeOverride).toEqual([PokemonType.Water]);
    expect(engine.getPokemonTypes(target.id)).toEqual([PokemonType.Water]);
  });

  it("fails on a target that is already pure Water", () => {
    const caster = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["soak"],
    });
    const target = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "soak",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.typeOverride).toBeUndefined();
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveFailed);
  });

  it("is blocked by the target's Clone (Substitute)", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["soak"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      substituteHp: 999,
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "soak",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.typeOverride).toBeUndefined();
  });
});

describe("Type manip — Flamme Ultime (burn-up)", () => {
  it("deals damage then strips the caster's Fire type (typeless when mono-Fire)", () => {
    const caster = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["burn-up"],
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "burn-up",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.typeOverride).toEqual([]);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(target.maxHp);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.TypeChanged);
  });

  it("fails wholesale (no damage) when the user is not Fire", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["burn-up"],
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "burn-up",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.currentHp).toBe(target.maxHp);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveFailed);
  });
});

describe("Type manip — damage path reads the override end-to-end", () => {
  function thunderboltDamage(targetOverride?: PokemonType[]): number {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thunderbolt"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      maxHp: 400,
      currentHp: 400,
      ...(targetOverride ? { typeOverride: targetOverride } : {}),
    });
    const { engine, state } = buildItemTestEngine([caster, target]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "thunderbolt",
      targetPosition: { x: 1, y: 0 },
    });
    return 400 - (state.pokemon.get(target.id)?.currentHp ?? 400);
  }

  it("recomputes effectiveness from a soaked target's Water type (×2 vs the Fire default)", () => {
    const vsFire = thunderboltDamage();
    const vsSoakedWater = thunderboltDamage([PokemonType.Water]);
    expect(vsSoakedWater).toBeGreaterThan(vsFire);
  });

  it("grants STAB when the caster's type is overridden to the move's type", () => {
    const noStab = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thunderbolt"],
    });
    const withStab = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thunderbolt"],
      typeOverride: [PokemonType.Electric],
    });
    const makeTarget = () =>
      MockPokemon.fresh(MockPokemon.charmander, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        maxHp: 400,
        currentHp: 400,
      });

    const baseTarget = makeTarget();
    const base = buildItemTestEngine([noStab, baseTarget]);
    base.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: noStab.id,
      moveId: "thunderbolt",
      targetPosition: { x: 1, y: 0 },
    });
    const baseDamage = 400 - (base.state.pokemon.get(baseTarget.id)?.currentHp ?? 400);

    const stabTarget = makeTarget();
    const boosted = buildItemTestEngine([withStab, stabTarget]);
    boosted.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: withStab.id,
      moveId: "thunderbolt",
      targetPosition: { x: 1, y: 0 },
    });
    const stabDamage = 400 - (boosted.state.pokemon.get(stabTarget.id)?.currentHp ?? 400);

    expect(stabDamage).toBeGreaterThan(baseDamage);
  });
});

describe("Type manip — KO cleanup", () => {
  it("clears the type override when the mon faints", () => {
    const caster = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["burn-up"],
      currentHp: 1,
      typeOverride: [PokemonType.Water],
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["vine-whip"],
    });
    const { engine, state } = buildItemTestEngine([caster, target], 6, target.id);

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: target.id,
      moveId: "vine-whip",
      targetPosition: { x: 0, y: 0 },
    });

    const fainted = state.pokemon.get(caster.id);
    expect(fainted?.currentHp).toBeLessThanOrEqual(0);
    expect(fainted?.typeOverride).toBeUndefined();
  });
});
