import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

// Vent Arrière (tailwind) — move integration tests.

function firstIndexOf(timeline: { pokemonId: string }[], id: string): number {
  return timeline.findIndex((entry) => entry.pokemonId === id);
}

describe("tailwind — directional wind", () => {
  it("sets the wind toward the targeted cardinal-adjacent tile", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["tailwind"],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 9, y: 9 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], { gridSize: 12 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tailwind",
      targetPosition: { x: 6, y: 5 },
    });

    expect(result.success).toBe(true);
    const set = result.events.find((e) => e.type === BattleEventType.TailwindSet);
    expect(set).toBeDefined();
    if (set && set.type === BattleEventType.TailwindSet) {
      expect(set.direction).toBe(Direction.East);
    }
    expect(state.tailwind?.direction).toBe(Direction.East);
  });

  it("schedules a wind-aligned mon before an equal-speed mon oriented away", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["tailwind"],
    });
    const aligned = MockPokemon.fresh(MockPokemon.base, {
      id: "aligned",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 6 },
      orientation: Direction.East,
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 80 },
    });
    const away = MockPokemon.fresh(MockPokemon.base, {
      id: "away",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 4 },
      orientation: Direction.West,
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 80 },
    });
    const { engine } = buildMoveTestEngine([caster, aligned, away], { gridSize: 12 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tailwind",
      targetPosition: { x: 6, y: 5 },
    });

    const timeline = engine.predictCtTimeline(30);
    expect(firstIndexOf(timeline, "aligned")).toBeLessThan(firstIndexOf(timeline, "away"));
  });
});
