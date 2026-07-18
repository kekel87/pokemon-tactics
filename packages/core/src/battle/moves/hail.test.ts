import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { Weather } from "../../enums/weather";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["hail"],
    currentPp: { hail: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 4, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("hail", () => {
  it("sets the Snow weather for 5 turns", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "hail",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((event) => event.type === BattleEventType.WeatherSet)).toBe(true);
    expect(state.weather).toBe(Weather.Snow);
    expect(state.weatherTurnsRemaining).toBe(5);
  });
});
