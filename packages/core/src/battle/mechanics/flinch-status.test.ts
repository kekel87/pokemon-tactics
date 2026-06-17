import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

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
    const { engine, state } = buildMoveTestEngine([flinched, enemy], { activePokemonId: "enemy" });

    const flinchedEvents: BattleEvent[] = [];
    engine.on(BattleEventType.Flinched, (e) => flinchedEvents.push(e));

    endTurnUntilActor(engine, state, "flinched");

    expect(flinchedEvents.some((e) => e.type === BattleEventType.Flinched)).toBe(true);

    const legalActions = engine.getLegalActions(PlayerId.Player1);
    expect(legalActions.some((a) => a.kind === ActionKind.Move)).toBe(false);
    expect(legalActions.some((a) => a.kind === ActionKind.UseMove)).toBe(false);
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
    const { engine, state } = buildMoveTestEngine([flinched, enemy], { activePokemonId: "enemy" });

    const eventTypes: string[] = [];
    engine.on(BattleEventType.Flinched, (e) => eventTypes.push(e.type));
    engine.on(BattleEventType.StatusRemoved, (e) => eventTypes.push(e.type));

    endTurnUntilActor(engine, state, "flinched");

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
