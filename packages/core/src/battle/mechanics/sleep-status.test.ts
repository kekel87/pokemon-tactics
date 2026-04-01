import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { MockPokemon, buildMoveTestEngine } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("sleep status", () => {
  it("skips the sleeping Pokemon's turn", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 3 }],
    });

    const { engine, state } = buildMoveTestEngine([charmander, bulbasaur]);

    const allEvents: BattleEvent[] = [];
    engine.on(BattleEventType.TurnStarted, (e) => allEvents.push(e));
    engine.on(BattleEventType.TurnEnded, (e) => allEvents.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    expect(state.roundNumber).toBe(2);
    expect(state.turnOrder[0]).toBe("charmander-1");

    const legalActions = engine.getLegalActions(PlayerId.Player2);
    expect(legalActions).toHaveLength(0);
  });

  it("wakes up after duration expires", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 1 }],
    });

    const { engine, state } = buildMoveTestEngine([charmander, bulbasaur]);
    const pokemon = state.pokemon.get("bulbasaur-1")!;

    const statusRemovedEvents: BattleEvent[] = [];
    engine.on(BattleEventType.StatusRemoved, (e) => statusRemovedEvents.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    expect(pokemon.statusEffects.some((s) => s.type === StatusType.Asleep)).toBe(false);
    expect(statusRemovedEvents.some((e) => {
      const event = e as Extract<BattleEvent, { type: typeof BattleEventType.StatusRemoved }>;
      return event.status === StatusType.Asleep;
    })).toBe(true);
  });
});
