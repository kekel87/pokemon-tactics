import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { ActionError } from "../../enums/action-error";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("leech-seed", () => {
  it("creates a LeechSeed link in state when used on a target in range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.LinkCreated);
    expect(state.activeLinks).toHaveLength(1);
    expect(state.activeLinks[0]).toMatchObject({
      sourceId: caster.id,
      targetId: target.id,
    });

    vi.restoreAllMocks();
  });

  it("drains target HP and heals source on EndTurn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 50,
      maxHp: 105,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 99,
      maxHp: 99,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });

    const casterHpAfterSeed = state.pokemon.get(caster.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.South,
    });

    const targetHpAfterEndTurn = state.pokemon.get(target.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: target.id,
      direction: Direction.South,
    });

    const targetHpAfterTargetEndTurn = state.pokemon.get(target.id)?.currentHp ?? 0;
    const casterHpAfterDrain = state.pokemon.get(caster.id)?.currentHp ?? 0;

    expect(targetHpAfterTargetEndTurn).toBeLessThan(targetHpAfterEndTurn);
    expect(casterHpAfterDrain).toBeGreaterThan(casterHpAfterSeed);

    vi.restoreAllMocks();
  });

  it("returns InvalidTarget when target is out of range", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.charmander, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, farTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "leech-seed",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });

  it("link breaks when source is KO", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const source = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 5,
      maxHp: 105,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const killer = MockPokemon.fresh(MockPokemon.base, {
      id: "killer-1",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 1 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: { hp: 100, attack: 200, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([source, target, killer]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: target.id,
      moveId: "scratch",
      targetPosition: { x: 0, y: 0 },
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: target.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: killer.id,
      moveId: "scratch",
      targetPosition: { x: 0, y: 0 },
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: killer.id,
      direction: Direction.South,
    });

    expect(state.pokemon.get(source.id)?.currentHp).toBe(0);
    expect(state.activeLinks).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("link breaks when distance exceeds maxRange", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    // source at (5,0), target at (5,2) — initial distance 2, maxRange 5
    // source will move north to (5,9) — distance from (5,9) to (5,2) is 7, exceeds maxRange 5
    const source = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 5, y: 0 },
      currentHp: 105,
      maxHp: 105,
      derivedStats: { movement: 5, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 2 },
      derivedStats: { movement: 5, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([source, target], 15);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "leech-seed",
      targetPosition: { x: 5, y: 2 },
    });

    // Move source 5 tiles north to (5,9) — y decreases going north — actually depends on grid orientation
    // Use South direction (y increases): source moves to (5,5), distance to target (5,2) = 3, still in range
    // Need to exceed maxRange 5: move source to where distance > 5
    // Move source south: (5,0) → (5,1) → (5,2) blocked by target, use east direction instead
    // Move source east 5 steps: (5,0) → (10,0), distance to (5,2) = 5+2 = 7 > maxRange 5
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: source.id,
      path: [
        { x: 6, y: 0 },
        { x: 7, y: 0 },
        { x: 8, y: 0 },
        { x: 9, y: 0 },
        { x: 10, y: 0 },
      ],
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: target.id,
      direction: Direction.South,
    });

    expect(state.activeLinks).toHaveLength(0);

    vi.restoreAllMocks();
  });
});
