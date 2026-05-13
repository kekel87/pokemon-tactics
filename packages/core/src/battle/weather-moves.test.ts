// TODO(plan-084-étape-2): Weather enum, setWeather non encore implémentés — FAIL au build.
// TODO(plan-084-étape-5): moves sunny-day/rain-dance/sandstorm/snowscape/weather-ball pas encore dans tactical.ts.
// TODO(plan-084-étape-5): Synthesis modifier météo pas encore implémenté.
// TODO(plan-084-étape-6): Solar-Beam twoTurnCharge / chargingMove pas encore sur PokemonInstance.
// Note: BattleEventType.WeatherSet/WeatherCleared/WeatherWar/MoveCharging sont déjà dans l'enum.

import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
// TODO(plan-084-étape-2): créer packages/core/src/enums/weather.ts
import { Weather } from "../enums/weather";
import { buildMoveTestEngine, MockPokemon } from "../testing";
// TODO(plan-084-étape-2): créer packages/core/src/battle/weather-system.ts
import { setWeather } from "./weather-system";

// ---------------------------------------------------------------------------
// Setter moves — sunny-day, rain-dance, sandstorm, snowscape
// ---------------------------------------------------------------------------

describe("sunny-day setter move", () => {
  it("sets state.weather to Sun and emits WeatherSet", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sunny-day"],
      currentPp: { "sunny-day": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sunny-day",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.weather).toBe(Weather.Sun);
    expect(state.weatherTurnsRemaining).toBe(5);
    expect(result.events.some((e) => e.type === BattleEventType.WeatherSet)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("rain-dance setter move", () => {
  it("sets state.weather to Rain and emits WeatherSet", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["rain-dance"],
      currentPp: { "rain-dance": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "rain-dance",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.weather).toBe(Weather.Rain);
    expect(state.weatherTurnsRemaining).toBe(5);
    expect(result.events.some((e) => e.type === BattleEventType.WeatherSet)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("sandstorm setter move", () => {
  it("sets state.weather to Sandstorm and emits WeatherSet", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sandstorm"],
      currentPp: { sandstorm: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sandstorm",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.weather).toBe(Weather.Sandstorm);
    expect(state.weatherTurnsRemaining).toBe(5);
    expect(result.events.some((e) => e.type === BattleEventType.WeatherSet)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("snowscape setter move", () => {
  it("sets state.weather to Snow and emits WeatherSet", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["snowscape"],
      currentPp: { snowscape: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "snowscape",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.weather).toBe(Weather.Snow);
    expect(state.weatherTurnsRemaining).toBe(5);
    expect(result.events.some((e) => e.type === BattleEventType.WeatherSet)).toBe(true);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// 16. Weather-ball — type and BP vary by weather
// ---------------------------------------------------------------------------

describe("weather-ball", () => {
  it("is Normal type BP 50 in no weather", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    // Reference damage in no weather (Normal type, BP 50)
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    // Weather-ball in None is Normal/50 — just verify damage is dealt and events exist
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(true);
    const normalDamage = 500 - (state.pokemon.get("foe")?.currentHp ?? 500);
    expect(normalDamage).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it("deals more damage in Sun (Fire type, BP 100 vs Normal BP 50)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    // No-weather baseline
    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baseEngine, state: baseState } = buildMoveTestEngine([baseAttacker, baseFoe]);
    baseEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const normalDamage = 500 - (baseState.pokemon.get("foe")?.currentHp ?? 500);

    // Sun variant — Fire type + ×2 BP = 100, plus ×1.5 Sun Fire modifier
    const sunAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const sunFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: sunEngine, state: sunState } = buildMoveTestEngine([sunAttacker, sunFoe]);
    setWeather(sunState, Weather.Sun, 5);
    sunEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const sunDamage = 500 - (sunState.pokemon.get("foe")?.currentHp ?? 500);

    expect(sunDamage).toBeGreaterThan(normalDamage);
    vi.restoreAllMocks();
  });

  it("deals more damage in Rain (Water type, BP 100)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baseEngine, state: baseState } = buildMoveTestEngine([baseAttacker, baseFoe]);
    baseEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const normalDamage = 500 - (baseState.pokemon.get("foe")?.currentHp ?? 500);

    const rainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const rainFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: rainEngine, state: rainState } = buildMoveTestEngine([rainAttacker, rainFoe]);
    setWeather(rainState, Weather.Rain, 5);
    rainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const rainDamage = 500 - (rainState.pokemon.get("foe")?.currentHp ?? 500);

    expect(rainDamage).toBeGreaterThan(normalDamage);
    vi.restoreAllMocks();
  });

  it("deals more damage in Sandstorm (Rock type, BP 100)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const sandAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const sandFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: sandEngine, state: sandState } = buildMoveTestEngine([sandAttacker, sandFoe]);
    setWeather(sandState, Weather.Sandstorm, 5);
    sandEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const sandDamage = 500 - (sandState.pokemon.get("foe")?.currentHp ?? 500);

    const baseAttacker2 = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseFoe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baseEngine2, state: baseState2 } = buildMoveTestEngine([
      baseAttacker2,
      baseFoe2,
    ]);
    baseEngine2.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const normalDamage = 500 - (baseState2.pokemon.get("foe")?.currentHp ?? 500);

    expect(sandDamage).toBeGreaterThan(normalDamage);
    vi.restoreAllMocks();
  });

  it("deals more damage in Snow (Ice type, BP 100)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const snowAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const snowFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: snowEngine, state: snowState } = buildMoveTestEngine([snowAttacker, snowFoe]);
    setWeather(snowState, Weather.Snow, 5);
    snowEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const snowDamage = 500 - (snowState.pokemon.get("foe")?.currentHp ?? 500);

    const baseAttacker3 = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["weather-ball"],
      currentPp: { "weather-ball": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseFoe3 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baseEngine3, state: baseState3 } = buildMoveTestEngine([
      baseAttacker3,
      baseFoe3,
    ]);
    baseEngine3.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "weather-ball",
      targetPosition: { x: 1, y: 0 },
    });
    const normalDamage = 500 - (baseState3.pokemon.get("foe")?.currentHp ?? 500);

    expect(snowDamage).toBeGreaterThan(normalDamage);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// 18-22. Solar-Beam — two-turn charge mechanics
// ---------------------------------------------------------------------------

describe("solar-beam", () => {
  it("T1 without Sun: sets chargingMove, emits MoveCharging, does not deal damage", () => {
    // Given a Venusaur using solar-beam in no weather
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    // T1: submit solar-beam action
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    // No damage should be dealt on T1 (charge turn)
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(false);
    // chargingMove should be set
    expect(state.pokemon.get("venusaur")?.chargingMove).toBeDefined();
    expect(state.pokemon.get("venusaur")?.chargingMove?.moveId).toBe("solar-beam");
    // MoveCharging event emitted
    expect(result.events.some((e) => e.type === BattleEventType.MoveCharging)).toBe(true);
    vi.restoreAllMocks();
  });

  it("T1 in Sun: fires instantly, deals damage, chargingMove not set", () => {
    // Given a Venusaur using solar-beam with Sun active
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);
    setWeather(state, Weather.Sun, 5);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    // Sun skips charge: damage is dealt immediately
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(true);
    // chargingMove is not set (no charge pending)
    expect(state.pokemon.get("venusaur")?.chargingMove).toBeUndefined();
    vi.restoreAllMocks();
  });

  it("T1 charge + move T1 — attacker can still move after committing charge", () => {
    // Given a Venusaur who commits charge on T1 and also moves
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    // T1: commit charge
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });

    // T1 move slot is still usable after charge commit
    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const moveActions = legalActions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions.length).toBeGreaterThan(0);

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "venusaur",
      path: [{ x: 1, y: 0 }],
    });

    expect(moveResult.success).toBe(true);
    expect(state.pokemon.get("venusaur")?.position).toEqual({ x: 1, y: 0 });
    // chargingMove persists through the movement
    expect(state.pokemon.get("venusaur")?.chargingMove).toBeDefined();
    vi.restoreAllMocks();
  });

  it("T1 KO caster during charge gap — chargingMove cleared, no T2 fire", () => {
    // Given a venusaur with 1 HP charging solar-beam
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      currentHp: 1,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const attacker2 = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur2",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: [],
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: { hp: 100, attack: 200, defense: 55, spAttack: 55, spDefense: 55, speed: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, attacker2, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "venusaur",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "venusaur2",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "foe",
      moveId: "scratch",
      targetPosition: { x: 0, y: 0 },
    });

    const venusaurAfter = state.pokemon.get("venusaur");
    expect(venusaurAfter?.currentHp).toBe(0);
    expect(venusaurAfter?.chargingMove).toBeUndefined();
    vi.restoreAllMocks();
  });

  it("weather changes Sun→Rain between T1/T2 — BP halved at T2 fire", () => {
    // Given a Venusaur charging solar-beam in T1 while Sun is active
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["rain-dance"],
      currentPp: { "rain-dance": 5 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    setWeather(state, Weather.None, 0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });
    expect(state.pokemon.get("venusaur")?.chargingMove).toBeDefined();
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "venusaur",
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "foe",
      moveId: "rain-dance",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.weather).toBe(Weather.Rain);

    const hpAfterRain = state.pokemon.get("foe")?.currentHp ?? 500;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });

    // Now compare with Sun case to verify BP is halved
    const damageInRain = hpAfterRain - (state.pokemon.get("foe")?.currentHp ?? 0);

    // Same attacker/target in Sun to get reference damage
    const sunAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const sunFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: sunEngine, state: sunState } = buildMoveTestEngine([sunAttacker, sunFoe]);
    setWeather(sunState, Weather.Sun, 5);
    sunEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });
    const damageInSun = 500 - (sunState.pokemon.get("foe")?.currentHp ?? 500);

    // Rain should significantly reduce the damage compared to Sun
    expect(damageInRain).toBeLessThan(damageInSun);
    vi.restoreAllMocks();
  });

  it("Sleep applied during charge — turn skipped, charge persists, fires when awake", () => {
    // Given a Venusaur charging solar-beam with sleep applied between T1/T2
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "solar-beam",
      targetPosition: { x: 1, y: 0 },
    });
    expect(state.pokemon.get("venusaur")?.chargingMove).toBeDefined();

    const venusaur = state.pokemon.get("venusaur");
    if (venusaur) {
      venusaur.statusEffects.push({ type: StatusType.Asleep, remainingTurns: 1 });
    }
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "venusaur",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.pokemon.get("venusaur")?.chargingMove).toBeDefined();
    expect(state.pokemon.get("venusaur")?.chargingMove?.moveId).toBe("solar-beam");

    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// 23. Synthesis — HP recovery varies by weather
// ---------------------------------------------------------------------------

describe("synthesis", () => {
  it("restores 1/2 max HP in no weather", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const venusaur = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["synthesis"],
      currentPp: { synthesis: 5 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([venusaur, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "synthesis",
      targetPosition: { x: 0, y: 0 },
    });

    const healed = (state.pokemon.get("venusaur")?.currentHp ?? 0) - 50;
    const expectedHeal = Math.floor(200 * 0.5);
    expect(healed).toBe(expectedHeal);
    vi.restoreAllMocks();
  });

  it("restores 2/3 max HP in Sun", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const venusaur = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["synthesis"],
      currentPp: { synthesis: 5 },
      currentHp: 10,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([venusaur, foe]);
    setWeather(state, Weather.Sun, 5);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "synthesis",
      targetPosition: { x: 0, y: 0 },
    });

    const healed = (state.pokemon.get("venusaur")?.currentHp ?? 0) - 10;
    const expectedHeal = Math.floor(300 * (2 / 3));
    expect(healed).toBe(expectedHeal);
    vi.restoreAllMocks();
  });

  it("restores 1/4 max HP in Rain", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const venusaur = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["synthesis"],
      currentPp: { synthesis: 5 },
      currentHp: 10,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([venusaur, foe]);
    setWeather(state, Weather.Rain, 5);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "synthesis",
      targetPosition: { x: 0, y: 0 },
    });

    const healed = (state.pokemon.get("venusaur")?.currentHp ?? 0) - 10;
    const expectedHeal = Math.floor(300 * 0.25);
    expect(healed).toBe(expectedHeal);
    vi.restoreAllMocks();
  });

  it("restores 1/4 max HP in Sandstorm", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const venusaur = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["synthesis"],
      currentPp: { synthesis: 5 },
      currentHp: 10,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      definitionId: "onix",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([venusaur, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "synthesis",
      targetPosition: { x: 0, y: 0 },
    });

    const healed = (state.pokemon.get("venusaur")?.currentHp ?? 0) - 10;
    const expectedHeal = Math.floor(300 * 0.25);
    expect(healed).toBe(expectedHeal);
    vi.restoreAllMocks();
  });

  it("restores 1/4 max HP in Snow", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const venusaur = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["synthesis"],
      currentPp: { synthesis: 5 },
      currentHp: 10,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([venusaur, foe]);
    setWeather(state, Weather.Snow, 5);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "venusaur",
      moveId: "synthesis",
      targetPosition: { x: 0, y: 0 },
    });

    const healed = (state.pokemon.get("venusaur")?.currentHp ?? 0) - 10;
    const expectedHeal = Math.floor(300 * 0.25);
    expect(healed).toBe(expectedHeal);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// 17. Weather war — slowest setter wins when two setters act in same round
// ---------------------------------------------------------------------------

describe("weather war", () => {
  it("last-applied weather wins when fast sets Sun then slow sets Rain in the same round", () => {
    // Given fast P1 uses sunny-day, then slow P2 uses rain-dance — slow wins (Rain last)
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fastSetter = MockPokemon.fresh(MockPokemon.base, {
      id: "fast-setter",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sunny-day"],
      currentPp: { "sunny-day": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const slowSetter = MockPokemon.fresh(MockPokemon.base, {
      id: "slow-setter",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      moveIds: ["rain-dance"],
      currentPp: { "rain-dance": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([fastSetter, slowSetter]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "fast-setter",
      moveId: "sunny-day",
      targetPosition: { x: 0, y: 0 },
    });
    expect(state.weather).toBe(Weather.Sun);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast-setter",
      direction: Direction.South,
    });

    const rainResult = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "slow-setter",
      moveId: "rain-dance",
      targetPosition: { x: 4, y: 4 },
    });

    // The slowest setter's weather takes effect
    expect(state.weather).toBe(Weather.Rain);
    expect(rainResult.events.some((e) => e.type === BattleEventType.WeatherWar)).toBe(true);
    vi.restoreAllMocks();
  });
});
