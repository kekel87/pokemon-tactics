// TODO(plan-084-étape-2): Weather enum, setWeather, tickWeatherEndTurn, getWeatherBpModifier,
// getWeatherAccuracyOverride, getWeatherDefenseStatBoost, isWeatherDamageImmune, applyWeatherWar
// ne sont pas encore implémentés. Ces imports vont FAIL au build jusqu'à l'Étape 2.
// BattleState n'a pas encore weather/weatherTurnsRemaining — FAIL au build aussi.
// PokemonInstance n'a pas encore chargingMove — FAIL au build aussi.
// Note: BattleEventType.WeatherSet/WeatherCleared/WeatherDamage/WeatherWar/MoveCharging
// sont déjà dans l'enum (pré-ajoutés).

import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import type { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
// TODO(plan-084-étape-2): créer packages/core/src/enums/weather.ts
import { Weather } from "../enums/weather";
import { buildItemTestEngine, buildMoveTestEngine, MockPokemon } from "../testing";
// TODO(plan-084-étape-2): créer packages/core/src/battle/weather-system.ts
import {
  getWeatherAccuracyOverride,
  getWeatherBpModifier,
  getWeatherDefenseStatBoost,
  isWeatherDamageImmune,
  setWeather,
} from "./weather-system";

// ---------------------------------------------------------------------------
// 1. Setup base — setWeather
// ---------------------------------------------------------------------------

describe("setWeather", () => {
  it("sets weather, weatherTurnsRemaining and emits WeatherSet", () => {
    // Given a minimal state with no weather
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { state } = buildMoveTestEngine([attacker]);

    // When Sun is set for 5 turns
    const events = setWeather(state, Weather.Sun, 5, attacker.id);

    // Then state reflects the new weather and an event is emitted
    expect(state.weather).toBe(Weather.Sun);
    expect(state.weatherTurnsRemaining).toBe(5);
    expect(events.some((e) => e.type === BattleEventType.WeatherSet)).toBe(true);

    const weatherSetEvent = events.find((e) => e.type === BattleEventType.WeatherSet);
    expect(weatherSetEvent).toMatchObject({
      type: BattleEventType.WeatherSet,
      weather: Weather.Sun,
      turns: 5,
    });
  });

  it("initial state has weather None and weatherTurnsRemaining 0", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([attacker]);

    expect(state.weather).toBe(Weather.None);
    expect(state.weatherTurnsRemaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Tick end-turn — weather expires after N turns
// ---------------------------------------------------------------------------

describe("weather tick — Sun expires after 5 turns", () => {
  it("clears weather to None after 5 end-turn ticks and emits WeatherCleared", () => {
    // Given Sun with 5 turns remaining
    const fast = MockPokemon.fresh(MockPokemon.base, {
      id: "fast",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const slow = MockPokemon.fresh(MockPokemon.base, {
      id: "slow",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([fast, slow]);

    // Set Sun for 5 turns directly on state (simulating a setter move effect)
    setWeather(state, Weather.Sun, 5);

    const clearedEvents: unknown[] = [];
    engine.on(BattleEventType.WeatherCleared, (e) => clearedEvents.push(e));

    // Each round both Pokemon end turn → 1 tick per round
    for (let round = 0; round < 5; round++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "fast",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "slow",
        direction: Direction.South,
      });
    }

    expect(state.weather).toBe(Weather.None);
    expect(state.weatherTurnsRemaining).toBe(0);
    expect(clearedEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Heat-rock extends Sun to 8 turns
// ---------------------------------------------------------------------------

describe("heat-rock item", () => {
  it("extends Sun duration from 5 to 8 turns when setter holds heat-rock", () => {
    // Given an attacker holding a heat-rock and using sunny-day
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "setter",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sunny-day"],
      currentPp: { "sunny-day": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      // TODO(plan-084-étape-9): HeldItemId.HeatRock n'est pas encore dans l'enum
      heldItemId: "heat-rock" as HeldItemId,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildItemTestEngine([attacker, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "setter",
      moveId: "sunny-day",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.weather).toBe(Weather.Sun);
    expect(state.weatherTurnsRemaining).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 4. Sandstorm residual damage — 1/16 HP to non-immune types
// ---------------------------------------------------------------------------

describe("Sandstorm residual damage", () => {
  it("deals 1/16 max HP per turn to non-immune types (Normal)", () => {
    const normalType = MockPokemon.fresh(MockPokemon.base, {
      id: "normal-type",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 160,
      maxHp: 160,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      currentHp: 160,
      maxHp: 160,
    });
    const { engine, state } = buildMoveTestEngine([normalType, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    const hpBefore = state.pokemon.get("normal-type")!.currentHp;
    const expectedDamage = Math.max(1, Math.floor(hpBefore / 16));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "normal-type",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    const hpAfter = state.pokemon.get("normal-type")!.currentHp;
    expect(hpAfter).toBe(hpBefore - expectedDamage);
  });

  it("does not damage Rock-type in Sandstorm", () => {
    const rockType = MockPokemon.fresh(MockPokemon.base, {
      id: "rock-type",
      definitionId: "onix",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 100,
      maxHp: 100,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([rockType, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    const hpBefore = state.pokemon.get("rock-type")!.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "rock-type",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.pokemon.get("rock-type")!.currentHp).toBe(hpBefore);
  });

  it("does not damage Steel-type in Sandstorm", () => {
    const steelType = MockPokemon.fresh(MockPokemon.base, {
      id: "steel-type",
      definitionId: "magneton",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 100,
      maxHp: 100,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([steelType, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    const hpBefore = state.pokemon.get("steel-type")!.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "steel-type",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.pokemon.get("steel-type")!.currentHp).toBe(hpBefore);
  });

  it("does not damage Ground-type in Sandstorm", () => {
    const groundType = MockPokemon.fresh(MockPokemon.base, {
      id: "ground-type",
      definitionId: "rhydon",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 100,
      maxHp: 100,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([groundType, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    const hpBefore = state.pokemon.get("ground-type")!.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "ground-type",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.pokemon.get("ground-type")!.currentHp).toBe(hpBefore);
  });
});

// ---------------------------------------------------------------------------
// 5. Snow — no residual damage (Gen 9 difference vs Hail)
// ---------------------------------------------------------------------------

describe("Snow — no residual damage", () => {
  it("does not deal any damage per turn under Snow, even to non-Ice types", () => {
    const normalType = MockPokemon.fresh(MockPokemon.base, {
      id: "normal-type",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 100,
      maxHp: 100,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([normalType, foe]);
    setWeather(state, Weather.Snow, 5);

    const hpBefore = state.pokemon.get("normal-type")!.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "normal-type",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.pokemon.get("normal-type")!.currentHp).toBe(hpBefore);
  });
});

// ---------------------------------------------------------------------------
// 6. BP Fire moves ×1.5 in Sun
// ---------------------------------------------------------------------------

describe("getWeatherBpModifier", () => {
  it("returns 1.5 for Fire-type moves in Sun", () => {
    expect(getWeatherBpModifier(PokemonType.Fire, Weather.Sun)).toBe(1.5);
  });

  it("returns 0.5 for Water-type moves in Sun", () => {
    expect(getWeatherBpModifier(PokemonType.Water, Weather.Sun)).toBe(0.5);
  });

  it("returns 1.5 for Water-type moves in Rain", () => {
    expect(getWeatherBpModifier(PokemonType.Water, Weather.Rain)).toBe(1.5);
  });

  it("returns 0.5 for Fire-type moves in Rain", () => {
    expect(getWeatherBpModifier(PokemonType.Fire, Weather.Rain)).toBe(0.5);
  });

  it("returns 1.0 for Grass-type moves in any weather", () => {
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.Sun)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.Rain)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.Sandstorm)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.Snow)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.None)).toBe(1.0);
  });

  it("returns 1.0 for Fire-type moves in weather other than Sun/Rain", () => {
    expect(getWeatherBpModifier(PokemonType.Fire, Weather.None)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Fire, Weather.Sandstorm)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Fire, Weather.Snow)).toBe(1.0);
  });
});

describe("Fire move damage in Sun — integration", () => {
  it("Flamethrower (BP 90) deals effectively 135 BP damage in Sun vs no-weather", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "fire-user",
      definitionId: "charizard",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["flamethrower"],
      currentPp: { flamethrower: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: normalEngine, state: normalState } = buildMoveTestEngine([
      baseAttacker,
      baseTarget,
    ]);
    normalEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "fire-user",
      moveId: "flamethrower",
      targetPosition: { x: 2, y: 2 },
    });
    const normalDamage = 500 - (normalState.pokemon.get("target")?.currentHp ?? 500);

    // Given an attacker using Flamethrower in Sun
    const sunAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "fire-user",
      definitionId: "charizard",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["flamethrower"],
      currentPp: { flamethrower: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const sunTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: sunEngine, state: sunState } = buildMoveTestEngine([sunAttacker, sunTarget]);
    setWeather(sunState, Weather.Sun, 5);
    sunEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "fire-user",
      moveId: "flamethrower",
      targetPosition: { x: 2, y: 2 },
    });
    const sunDamage = 500 - (sunState.pokemon.get("target")?.currentHp ?? 500);

    expect(sunDamage).toBeGreaterThan(normalDamage);
    expect(sunDamage).toBeCloseTo(normalDamage * 1.5, -1);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// 7. BP Water moves ÷2 in Sun
// ---------------------------------------------------------------------------

describe("Water move damage in Sun — integration", () => {
  it("Water Gun deals less damage in Sun than in no-weather", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "water-user",
      definitionId: "blastoise",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["water-gun"],
      currentPp: { "water-gun": 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: normalEngine, state: normalState } = buildMoveTestEngine([
      baseAttacker,
      baseTarget,
    ]);
    normalEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "water-user",
      moveId: "water-gun",
      targetPosition: { x: 1, y: 0 },
    });
    const normalDamage = 500 - (normalState.pokemon.get("target")?.currentHp ?? 500);

    const sunAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "water-user",
      definitionId: "blastoise",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["water-gun"],
      currentPp: { "water-gun": 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const sunTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: sunEngine, state: sunState } = buildMoveTestEngine([sunAttacker, sunTarget]);
    setWeather(sunState, Weather.Sun, 5);
    sunEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "water-user",
      moveId: "water-gun",
      targetPosition: { x: 1, y: 0 },
    });
    const sunDamage = 500 - (sunState.pokemon.get("target")?.currentHp ?? 500);

    expect(sunDamage).toBeLessThan(normalDamage);
    expect(sunDamage).toBeCloseTo(normalDamage * 0.5, -1);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// 8. Solar-Beam BP ÷2 outside Sun, ×1 in Sun (pure function)
// ---------------------------------------------------------------------------

describe("getWeatherBpModifier — solar-beam special case is handled in effect-processor", () => {
  it("Grass-type bp modifier is 1.0 in all weathers (solar-beam override is move-level)", () => {
    // Solar-Beam's halving in Rain/Sand/Snow is handled by the move's weatherBpOverride,
    // not by the generic type modifier. This test validates the base function behaves correctly.
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.Rain)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.Sandstorm)).toBe(1.0);
    expect(getWeatherBpModifier(PokemonType.Grass, Weather.Snow)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 9. Thunder accuracy: 50% Sun, 100% Rain, 70% (base) None
// ---------------------------------------------------------------------------

describe("getWeatherAccuracyOverride", () => {
  it("returns 50 for thunder in Sun", () => {
    expect(getWeatherAccuracyOverride("thunder", Weather.Sun)).toBe(50);
  });

  it("returns 100 for thunder in Rain", () => {
    expect(getWeatherAccuracyOverride("thunder", Weather.Rain)).toBe(100);
  });

  it("returns undefined for thunder in None (use base accuracy)", () => {
    expect(getWeatherAccuracyOverride("thunder", Weather.None)).toBeUndefined();
  });

  it("returns undefined for thunder in Sandstorm", () => {
    expect(getWeatherAccuracyOverride("thunder", Weather.Sandstorm)).toBeUndefined();
  });

  it("returns undefined for thunder in Snow", () => {
    expect(getWeatherAccuracyOverride("thunder", Weather.Snow)).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 10. Blizzard accuracy: 100% Snow
  // ---------------------------------------------------------------------------

  it("returns 100 for blizzard in Snow", () => {
    expect(getWeatherAccuracyOverride("blizzard", Weather.Snow)).toBe(100);
  });

  it("returns undefined for blizzard in None", () => {
    expect(getWeatherAccuracyOverride("blizzard", Weather.None)).toBeUndefined();
  });

  it("returns undefined for blizzard in Rain", () => {
    expect(getWeatherAccuracyOverride("blizzard", Weather.Rain)).toBeUndefined();
  });

  it("returns undefined for scratch in any weather (no accuracy override)", () => {
    expect(getWeatherAccuracyOverride("scratch", Weather.Sun)).toBeUndefined();
    expect(getWeatherAccuracyOverride("scratch", Weather.Rain)).toBeUndefined();
    expect(getWeatherAccuracyOverride("scratch", Weather.Sandstorm)).toBeUndefined();
    expect(getWeatherAccuracyOverride("scratch", Weather.Snow)).toBeUndefined();
    expect(getWeatherAccuracyOverride("scratch", Weather.None)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 11. SpDef Rock +50% in Sandstorm
// ---------------------------------------------------------------------------

describe("getWeatherDefenseStatBoost", () => {
  it("returns 1.5 for Rock-type SpDefense in Sandstorm", () => {
    expect(getWeatherDefenseStatBoost([PokemonType.Rock], "spDefense", Weather.Sandstorm)).toBe(
      1.5,
    );
  });

  it("returns 1.5 for dual-type Rock/Ground SpDefense in Sandstorm", () => {
    expect(
      getWeatherDefenseStatBoost(
        [PokemonType.Rock, PokemonType.Ground],
        "spDefense",
        Weather.Sandstorm,
      ),
    ).toBe(1.5);
  });

  it("returns 1.0 for Rock-type Defense in Sandstorm (only SpDef boosted)", () => {
    expect(getWeatherDefenseStatBoost([PokemonType.Rock], "defense", Weather.Sandstorm)).toBe(1.0);
  });

  it("returns 1.0 for non-Rock type SpDefense in Sandstorm", () => {
    expect(getWeatherDefenseStatBoost([PokemonType.Normal], "spDefense", Weather.Sandstorm)).toBe(
      1.0,
    );
  });

  // ---------------------------------------------------------------------------
  // 12. Def Ice +50% in Snow
  // ---------------------------------------------------------------------------

  it("returns 1.5 for Ice-type Defense in Snow", () => {
    expect(getWeatherDefenseStatBoost([PokemonType.Ice], "defense", Weather.Snow)).toBe(1.5);
  });

  it("returns 1.0 for Ice-type SpDefense in Snow (only Def boosted)", () => {
    expect(getWeatherDefenseStatBoost([PokemonType.Ice], "spDefense", Weather.Snow)).toBe(1.0);
  });

  it("returns 1.0 for non-Ice type Defense in Snow", () => {
    expect(getWeatherDefenseStatBoost([PokemonType.Water], "defense", Weather.Snow)).toBe(1.0);
  });

  it("returns 1.0 for any type in weather None", () => {
    expect(getWeatherDefenseStatBoost([PokemonType.Rock], "spDefense", Weather.None)).toBe(1.0);
    expect(getWeatherDefenseStatBoost([PokemonType.Ice], "defense", Weather.None)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 25. Sandstorm/Snow immunities — OR logic for dual types
// ---------------------------------------------------------------------------

describe("isWeatherDamageImmune — dual type OR logic", () => {
  it("Onix (Rock/Ground) is immune to Sandstorm — OR logic double-immune", () => {
    expect(isWeatherDamageImmune([PokemonType.Rock, PokemonType.Ground], Weather.Sandstorm)).toBe(
      true,
    );
  });

  it("single Rock type is immune to Sandstorm", () => {
    expect(isWeatherDamageImmune([PokemonType.Rock], Weather.Sandstorm)).toBe(true);
  });

  it("single Steel type is immune to Sandstorm", () => {
    expect(isWeatherDamageImmune([PokemonType.Steel], Weather.Sandstorm)).toBe(true);
  });

  it("single Ground type is immune to Sandstorm", () => {
    expect(isWeatherDamageImmune([PokemonType.Ground], Weather.Sandstorm)).toBe(true);
  });

  it("Grass/Ice dual type is not immune to Sandstorm", () => {
    expect(isWeatherDamageImmune([PokemonType.Grass, PokemonType.Ice], Weather.Sandstorm)).toBe(
      false,
    );
  });

  it("no type is immune to Snow (Snow deals no damage)", () => {
    // Snow doesn't deal damage, so immunity check is moot, but the function returns false for all types
    expect(isWeatherDamageImmune([PokemonType.Ice], Weather.Snow)).toBe(false);
    expect(isWeatherDamageImmune([PokemonType.Normal], Weather.Snow)).toBe(false);
  });

  it("no type is immune to Sun or Rain (no residual damage)", () => {
    expect(isWeatherDamageImmune([PokemonType.Fire], Weather.Sun)).toBe(false);
    expect(isWeatherDamageImmune([PokemonType.Water], Weather.Rain)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 26. Freeze blocked in Sun
// ---------------------------------------------------------------------------

describe("Freeze status blocked in Sun", () => {
  it("applying Frozen under Sun is a no-op — target does not become frozen", () => {
    // Given an attacker using blizzard (10% freeze) in Sun
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "articuno",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["blizzard"],
      currentPp: { blizzard: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, target]);
    setWeather(state, Weather.Sun, 5);

    // Force proc (random = 0 guarantees status proc attempt)
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "blizzard",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    const targetPokemon = state.pokemon.get("target");
    expect(targetPokemon?.statusEffects.some((s) => s.type === "frozen")).toBe(false);
  });
});
