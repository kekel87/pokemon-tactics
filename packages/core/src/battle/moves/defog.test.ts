import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { EntryHazardKind } from "../../enums/entry-hazard-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postEntryHazard } from "../entry-hazard-system";

function setup() {
  const defogger = MockPokemon.fresh(MockPokemon.base, {
    id: "defogger",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: ["defog"],
    currentPp: { defog: 10 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 9, y: 9 },
  });
  return buildMoveTestEngine([defogger, foe], { gridSize: 10 });
}

describe("defog", () => {
  it("clears hazards within radius 2 of the user and keeps farther ones", () => {
    const { engine, state } = setup();
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 4, y: 5 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 5, y: 7 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 5, y: 1 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "defogger",
      moveId: "defog",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.EntryHazardRemoved)).toBe(true);
    expect(state.entryHazards).toHaveLength(1);
    expect(state.entryHazards[0]?.tile).toEqual({ x: 5, y: 1 });
  });
});
