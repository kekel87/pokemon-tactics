import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { MockPokemon } from "../../testing";
import { buildMoveTestEngine } from "../../testing/build-move-test-engine";

describe("Flinch volatile status", () => {
  it("blocks Move and UseMove actions for the flinched Pokemon", () => {
    const flinched = MockPokemon.fresh(MockPokemon.base, {
      id: "flinched",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Flinch, remainingTurns: 1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([flinched, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "flinched",
      moveId: "tackle",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(false);
    expect(result.events.some((e) => e.type === BattleEventType.Flinched)).toBe(true);
  });

  it("emits Flinched and StatusRemoved events on first submit", () => {
    const flinched = MockPokemon.fresh(MockPokemon.base, {
      id: "flinched",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Flinch, remainingTurns: 1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([flinched, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "flinched",
      direction: Direction.East,
    });

    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toContain(BattleEventType.Flinched);
    expect(eventTypes).toContain(BattleEventType.StatusRemoved);
  });

  it("removes Flinch volatile after the flinched Pokemon's turn", () => {
    const flinched = MockPokemon.fresh(MockPokemon.base, {
      id: "flinched",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Flinch, remainingTurns: 1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([flinched, enemy]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "flinched",
      direction: Direction.East,
    });

    expect(
      state.pokemon.get("flinched")?.volatileStatuses.some((v) => v.type === StatusType.Flinch),
    ).toBe(false);
  });

  it("allows EndTurn so the flinched Pokemon can pass and rotate", () => {
    const flinched = MockPokemon.fresh(MockPokemon.base, {
      id: "flinched",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Flinch, remainingTurns: 1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([flinched, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "flinched",
      direction: Direction.North,
    });

    expect(result.success).toBe(true);
  });
});
