import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { Weather } from "../../enums/weather";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("rain-dance", () => {
  it("sets weather to Rain and emits WeatherSet", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["rain-dance"],
      currentPp: { "rain-dance": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "rain-dance",
      targetPosition: user.position,
    });

    expect(result.success).toBe(true);
    expect(state.weather).toBe(Weather.Rain);
    expect(state.weatherTurnsRemaining).toBe(5);
    expect(result.events.some((e) => e.type === BattleEventType.WeatherSet)).toBe(true);
  });

  it("does not affect foe HP", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["rain-dance"],
      currentPp: { "rain-dance": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      currentHp: 100,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "rain-dance",
      targetPosition: user.position,
    });

    expect(state.pokemon.get(foe.id)?.currentHp).toBe(100);
  });
});
