import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("wish", () => {
  it("posts a WishPosted event and stores pendingWish on the target ally", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["wish"],
      currentPp: { wish: 10 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      currentHp: 50,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wish",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.WishPosted);
    expect(state.pokemon.get(ally.id)?.pendingWish).toBeDefined();
    expect(state.pokemon.get(ally.id)?.pendingWish?.healAmount).toBe(100);
  });

  it("does not fire on the cast turn — ally HP unchanged immediately after cast", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["wish"],
      currentPp: { wish: 10 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wish",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(ally.id)?.currentHp).toBe(50);
    expect(state.pokemon.get(ally.id)?.pendingWish).toBeDefined();
  });

  it("fires on the target's next turn start (round-based): caster EndTurn triggers ally start-of-turn", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["wish"],
      currentPp: { wish: 10 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wish",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(ally.id)?.currentHp).toBe(50);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.South,
    });

    expect(state.pokemon.get(ally.id)?.currentHp).toBe(150);
    expect(state.pokemon.get(ally.id)?.pendingWish).toBeUndefined();
  });

  it("heal amount is capped by the target's remaining HP (no overheal)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["wish"],
      currentPp: { wish: 10 },
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      currentHp: 10,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wish",
      targetPosition: { x: 1, y: 0 },
    });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.South,
    });

    expect(state.pokemon.get(ally.id)?.currentHp).toBe(100);
  });

  it("self-cast: caster targets own position, pendingWish is placed on the caster itself", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["wish"],
      currentPp: { wish: 10 },
      currentHp: 80,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wish",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.WishPosted);

    const pending = state.pokemon.get(caster.id)?.pendingWish;
    expect(pending).toBeDefined();
    expect(pending?.healAmount).toBe(100);

    expect(state.pokemon.get(caster.id)?.currentHp).toBe(80);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.South,
    });

    expect(state.pokemon.get(caster.id)?.currentHp).toBe(180);
    expect(state.pokemon.get(caster.id)?.pendingWish).toBeUndefined();
  });

  it("overwriting a pending Wish replaces it — second castAtAction is strictly later", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["wish"],
      currentPp: { wish: 10 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe, ally]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wish",
      targetPosition: { x: 1, y: 0 },
    });
    const firstCastAtAction = state.pokemon.get(ally.id)?.pendingWish?.castAtAction;
    expect(firstCastAtAction).toBeDefined();

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: ally.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wish",
      targetPosition: { x: 1, y: 0 },
    });

    const secondPendingWish = state.pokemon.get(ally.id)?.pendingWish;
    expect(secondPendingWish).toBeDefined();
    expect(secondPendingWish?.castAtAction).toBeGreaterThan(firstCastAtAction ?? 0);
  });
});
