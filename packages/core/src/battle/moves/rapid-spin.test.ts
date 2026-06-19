import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { EntryHazardKind } from "../../enums/entry-hazard-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postEntryHazard } from "../entry-hazard-system";

function setup() {
  const spinner = MockPokemon.fresh(MockPokemon.base, {
    id: "spinner",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: ["rapid-spin"],
    currentPp: { "rapid-spin": 10 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 5, y: 6 },
  });
  return buildMoveTestEngine([spinner, foe], { gridSize: 10 });
}

describe("rapid-spin", () => {
  it("sweeps hazards within radius 1 of the user (r1 spin) and keeps farther ones", () => {
    const { engine, state } = setup();
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 4, y: 5 });
    postEntryHazard(state, EntryHazardKind.StealthRock, { x: 5, y: 7 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 5, y: 1 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "spinner",
      moveId: "rapid-spin",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.EntryHazardRemoved)).toBe(true);
    expect(state.entryHazards).toHaveLength(2);
    expect(state.entryHazards.some((cell) => cell.tile.x === 4 && cell.tile.y === 5)).toBe(false);
  });

  it("damages an adjacent enemy (r1 AoE)", () => {
    const { engine, state } = setup();
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "spinner",
      moveId: "rapid-spin",
      targetPosition: { x: 5, y: 5 },
    });
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(100);
  });
});
