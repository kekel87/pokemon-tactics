import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("aqua-ring", () => {
  it("applies AquaRing volatile on self", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["aqua-ring"],
      currentPp: { "aqua-ring": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "aqua-ring",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.volatileStatuses.some((v) => v.type === StatusType.AquaRing)).toBe(true);
  });

  it("heals 1/16 maxHp on end-turn unconditionally", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["aqua-ring"],
      currentPp: { "aqua-ring": 20 },
      currentHp: 80,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "aqua-ring",
      targetPosition: { x: 0, y: 0 },
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.South,
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    // 1/16 of 160 = 10
    expect(state.pokemon.get(user.id)?.currentHp).toBe(90);
  });

  it("heals even after the mon moved this turn", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["aqua-ring"],
      currentPp: { "aqua-ring": 20 },
      currentHp: 80,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "aqua-ring",
      targetPosition: { x: 0, y: 0 },
    });

    // Simulate movement by setting the flag directly
    const userPokemon = state.pokemon.get(user.id)!;
    userPokemon.movedThisTurn = true;
    const hpBeforeEndTurn = userPokemon.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.South,
    });

    const healEvents = result.events.filter((e) => e.type === BattleEventType.HpRestored);
    expect(healEvents.length).toBeGreaterThan(0);
    expect(state.pokemon.get(user.id)?.currentHp).toBeGreaterThan(hpBeforeEndTurn);
  });

  it("does not overheal above maxHp", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["aqua-ring"],
      currentPp: { "aqua-ring": 20 },
      currentHp: 159,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "aqua-ring",
      targetPosition: { x: 0, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.South,
    });

    expect(state.pokemon.get(user.id)?.currentHp).toBe(160);
  });
});
