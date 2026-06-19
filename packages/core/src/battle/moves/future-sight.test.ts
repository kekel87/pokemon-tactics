import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../../testing";

function makeCaster() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["future-sight"],
    currentPp: { "future-sight": 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function makeFoe(position: { x: number; y: number }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position,
    currentHp: 300,
    maxHp: 300,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

function landStrike(
  engine: ReturnType<typeof buildMoveTestEngine>["engine"],
  state: ReturnType<typeof buildMoveTestEngine>["state"],
): boolean {
  for (let turn = 0; turn < 10; turn += 1) {
    const activeId = state.activePokemonId;
    const player = state.pokemon.get(activeId)?.playerId ?? PlayerId.Player1;
    const result = engine.submitAction(player, {
      kind: ActionKind.EndTurn,
      pokemonId: activeId,
      direction: Direction.South,
    });
    if (result.events.some((event) => event.type === BattleEventType.FutureSightStruck)) {
      return true;
    }
  }
  return false;
}

describe("future-sight", () => {
  it("locks a tile and does not strike on the cast turn", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 2, y: 0 })]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "future-sight",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.FutureSightPosted);
    expect(state.pendingStrikes).toHaveLength(1);
    expect(state.pokemon.get("foe")?.currentHp).toBe(300);
  });

  it("strikes the occupant of the locked tile after the delay", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 2, y: 0 })]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "future-sight",
      targetPosition: { x: 2, y: 0 },
    });

    const landed = landStrike(engine, state);

    expect(landed).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(300);
    expect(state.pendingStrikes).toHaveLength(0);
  });

  it("fizzles when the locked tile is empty at landing (no occupant)", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 5, y: 5 })]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "future-sight",
      targetPosition: { x: 2, y: 0 },
    });

    const landed = landStrike(engine, state);

    expect(landed).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(300);
    expect(state.pendingStrikes).toHaveLength(0);
  });

  it("fails when a strike is already locked on the tile", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 2, y: 0 })]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "future-sight",
      targetPosition: { x: 2, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });
    endTurnUntilActor(engine, state, "caster");

    const second = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "future-sight",
      targetPosition: { x: 2, y: 0 },
    });

    expect(second.events.map((event) => event.type)).toContain(BattleEventType.FutureSightFailed);
    expect(state.pendingStrikes).toHaveLength(1);
  });
});
