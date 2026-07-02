import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("speed-swap (Permuvitesse)", () => {
  it("swaps the raw Speed via speedStatOverride and recomputes movement, leaving the stage intact", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["speed-swap"],
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 40 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 120 },
      derivedStats: { movement: 5, jump: 1, initiative: 120 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "speed-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.SpeedSwapped)).toBe(true);
    const casterAfter = state.pokemon.get("caster");
    const targetAfter = state.pokemon.get("target");
    expect(casterAfter?.speedStatOverride).toBe(120);
    expect(targetAfter?.speedStatOverride).toBe(40);
    expect(casterAfter?.derivedStats.movement).toBe(5);
    expect(targetAfter?.derivedStats.movement).toBe(3);
    expect(casterAfter?.statStages[StatName.Speed]).toBe(0);
    expect(targetAfter?.statStages[StatName.Speed]).toBe(0);
  });

  it("is blocked by the target's Substitute", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["speed-swap"],
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 40 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      substituteHp: 25,
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 120 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "speed-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("caster")?.speedStatOverride).toBeUndefined();
    expect(state.pokemon.get("target")?.speedStatOverride).toBeUndefined();
  });

  it("clears speedStatOverride on KO", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 1,
      speedStatOverride: 120,
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("target")?.currentHp).toBe(0);
    expect(state.pokemon.get("target")?.speedStatOverride).toBeUndefined();
  });
});
