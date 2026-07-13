import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { isEffectivelyFlying, resolveBaseTypes } from "./effective-flying";
import { effectiveMoveIds } from "./effective-move-ids";

// Morphing / Imposteur (plan 157): the caster becomes a live copy of its target.

describe("Morphing (transform)", () => {
  it("copies the target's combat stats and moves while keeping the caster's HP", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["transform"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["ember", "scratch", "growl", "smokescreen"],
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);
    const originalHp = caster.currentHp;
    const originalMaxHp = caster.maxHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "transform",
      targetPosition: { x: 1, y: 0 },
    });

    const morphed = state.pokemon.get(caster.id);
    expect(morphed?.transformState?.definitionId).toBe("charmander");
    expect(morphed?.transformState?.combatStats).toEqual(target.combatStats);
    expect(effectiveMoveIds(morphed as NonNullable<typeof morphed>)).toEqual(target.moveIds);
    expect(morphed?.currentHp).toBe(originalHp);
    expect(morphed?.maxHp).toBe(originalMaxHp);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.Transformed);
  });

  it("copies the target's effective types so the morph inherits its terrain behaviour", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["transform"],
    });
    const target = MockPokemon.fresh(MockPokemon.gyarados, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "transform",
      targetPosition: { x: 1, y: 0 },
    });

    const morphed = state.pokemon.get(caster.id);
    expect(morphed?.transformState?.types).toEqual([PokemonType.Water, PokemonType.Flying]);
    expect(morphed && resolveBaseTypes(morphed, new Map())).toEqual([
      PokemonType.Water,
      PokemonType.Flying,
    ]);
    // The copied Flying type levitates the morph over terrain (#659).
    expect(morphed && isEffectivelyFlying(morphed, morphed.transformState?.types ?? [])).toBe(true);
  });

  it("fails against a Substitute without transforming", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["transform"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      substituteHp: 20,
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "transform",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.transformState).toBeUndefined();
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
  });
});

describe("Imposteur (imposter)", () => {
  it("transforms into the nearest enemy at battle start", () => {
    const ditto = MockPokemon.fresh(MockPokemon.base, {
      id: "ditto-1",
      definitionId: "ditto",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["transform"],
      abilityId: "imposter",
    });
    const enemy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { state } = buildMoveTestEngine([ditto, enemy]);

    expect(state.pokemon.get("ditto-1")?.transformState?.definitionId).toBe("charmander");
  });

  it("does not copy an enemy that is itself Imposteur (anti-loop)", () => {
    const ditto = MockPokemon.fresh(MockPokemon.base, {
      id: "ditto-1",
      definitionId: "ditto",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["transform"],
      abilityId: "imposter",
    });
    const otherDitto = MockPokemon.fresh(MockPokemon.base, {
      id: "ditto-2",
      definitionId: "ditto",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["transform"],
      abilityId: "imposter",
    });
    const { state } = buildMoveTestEngine([ditto, otherDitto]);

    expect(state.pokemon.get("ditto-1")?.transformState).toBeUndefined();
    expect(state.pokemon.get("ditto-2")?.transformState).toBeUndefined();
  });
});
