// TODO(plan-084-étape-2): Weather enum, setWeather non encore implémentés — FAIL au build.
// TODO(plan-084-étape-3): tickWeatherEndTurn integration in processEndTurn pas encore fait — FAIL au run.
// BattleState n'a pas encore weather/weatherTurnsRemaining — FAIL au build aussi.
// Note: BattleEventType.WeatherDamage est déjà dans l'enum.

import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
// TODO(plan-084-étape-2): créer packages/core/src/enums/weather.ts
import { Weather } from "../enums/weather";
import { buildItemTestEngine, MockPokemon } from "../testing";
// TODO(plan-084-étape-2): créer packages/core/src/battle/weather-system.ts
import { setWeather } from "./weather-system";

// ---------------------------------------------------------------------------
// 27. Hook order — Sandstorm damage tick BEFORE Leftovers heal (canon Gen 5+)
// ---------------------------------------------------------------------------

describe("end-turn hook order: Sandstorm damage then Leftovers heal", () => {
  it("Sandstorm damage event appears before HpRestored event in the same end-turn", () => {
    // Given a Normal-type Pokemon holding Leftovers in Sandstorm
    const pokemon = MockPokemon.fresh(MockPokemon.base, {
      id: "normal-type",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      heldItemId: HeldItemId.Leftovers,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 100,
      maxHp: 160,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildItemTestEngine([pokemon, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    const endTurnResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "normal-type",
      direction: Direction.South,
    });

    // Verify both events are present
    const weatherDamageIndex = endTurnResult.events.findIndex(
      (e) => e.type === BattleEventType.WeatherDamage,
    );
    const leftoversHealIndex = endTurnResult.events.findIndex(
      (e) => e.type === BattleEventType.HpRestored,
    );

    expect(weatherDamageIndex).toBeGreaterThanOrEqual(0);
    expect(leftoversHealIndex).toBeGreaterThanOrEqual(0);
    // Canon order: weather tick (damage) BEFORE items (leftovers heal)
    expect(weatherDamageIndex).toBeLessThan(leftoversHealIndex);
  });

  it("net HP after Sandstorm tick + Leftovers heal is: HP - (maxHp/16) + (maxHp/16)", () => {
    // Sandstorm deals 1/16 maxHp, Leftovers heals 1/16 maxHp — net zero for full HP
    const pokemon = MockPokemon.fresh(MockPokemon.base, {
      id: "normal-type",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      heldItemId: HeldItemId.Leftovers,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 160,
      maxHp: 160,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildItemTestEngine([pokemon, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    const hpBefore = state.pokemon.get("normal-type")!.currentHp;
    const sandDamage = Math.max(1, Math.floor(hpBefore / 16));
    const leftoversHeal = Math.max(1, Math.floor(hpBefore / 16));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "normal-type",
      direction: Direction.South,
    });

    // Net effect: damage applied first, then heal. At 160HP both are 10.
    expect(state.pokemon.get("normal-type")!.currentHp).toBe(hpBefore - sandDamage + leftoversHeal);
  });

  it("White Herb stat restoration is not affected by weather damage tick", () => {
    // Given a Pokemon with White Herb about to have a stat lowered — Sandstorm damage
    // should not interact with White Herb's stat-restoration trigger
    const pokemon = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      heldItemId: HeldItemId.WhiteHerb,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      currentHp: 100,
      maxHp: 160,
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "magneton",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildItemTestEngine([attacker, pokemon]);
    setWeather(state, Weather.Sandstorm, 5);

    // Attacker uses growl to lower target's Attack (triggers White Herb)
    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "growl",
      targetPosition: { x: 2, y: 2 },
    });

    // White Herb should have fired and restored Attack to 0
    const targetAfterMove = engine.getGameState(PlayerId.Player1).pokemon.get("target");
    expect(targetAfterMove?.statStages.attack).toBe(0);
    expect(moveResult.events.some((e) => e.type === BattleEventType.HeldItemConsumed)).toBe(true);
    expect(targetAfterMove?.heldItemId).toBeUndefined();

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "attacker",
      direction: Direction.South,
    });
    const targetEndTurnResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "target",
      direction: Direction.South,
    });

    expect(targetEndTurnResult.events.some((e) => e.type === BattleEventType.WeatherDamage)).toBe(
      true,
    );
    expect(
      targetEndTurnResult.events.some((e) => e.type === BattleEventType.HeldItemConsumed),
    ).toBe(false);
  });
});
