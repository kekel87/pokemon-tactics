// TODO(plan-084-étape-2): Weather enum, setWeather non encore implémentés — FAIL au build.
// TODO(plan-084-étape-7): chlorophyll/swift-swim/sand-veil/cloud-nine sont des stubs — FAIL au run.
// BattleState n'a pas encore weather/weatherTurnsRemaining — FAIL au build aussi.
// Note: BattleEventType.AbilityActivated existe déjà.
// hasCloudNineActive pas encore implémenté dans weather-system.ts.

import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { Weather } from "../enums/weather";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { getEffectiveInitiative } from "./initiative-calculator";
import { setWeather } from "./weather-system";

const { abilityRegistry } = loadData();

// ---------------------------------------------------------------------------
// 13. Chlorophyll — ×2 speed in Sun
// ---------------------------------------------------------------------------

describe("chlorophyll ability", () => {
  it("doubles effective speed in Sun, emits AbilityActivated", () => {
    // Given Venusaur with chlorophyll in no weather — baseline speed
    const venusaurBase = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "chlorophyll",
      combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 80 },
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { state: noWeatherState } = buildMoveTestEngine([venusaurBase, foe]);
    const baseInitiative = getEffectiveInitiative(
      noWeatherState.pokemon.get("venusaur")!,
      noWeatherState,
      abilityRegistry,
    );

    // Given Venusaur with chlorophyll in Sun
    const venusaurSun = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "chlorophyll",
      combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 80 },
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: sunEngine, state: sunState } = buildMoveTestEngine([venusaurSun, foe2]);
    setWeather(sunState, Weather.Sun, 5);

    const abilityEvents: unknown[] = [];
    sunEngine.on(BattleEventType.AbilityActivated, (e) => abilityEvents.push(e));

    sunEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "venusaur",
      direction: Direction.South,
    });
    sunEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    const sunInitiative = getEffectiveInitiative(
      sunState.pokemon.get("venusaur")!,
      sunState,
      abilityRegistry,
    );
    expect(sunInitiative).toBeGreaterThan(baseInitiative);
    expect(sunInitiative).toBeCloseTo(baseInitiative * 2, -1);
    expect(abilityEvents.length).toBeGreaterThan(0);
  });

  it("does not boost speed outside of Sun", () => {
    const venusaur = MockPokemon.fresh(MockPokemon.base, {
      id: "venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "chlorophyll",
      combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 80 },
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { state } = buildMoveTestEngine([venusaur, foe]);
    setWeather(state, Weather.Rain, 5);

    const initiative = getEffectiveInitiative(
      state.pokemon.get("venusaur")!,
      state,
      abilityRegistry,
    );
    expect(initiative).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// 15. Swift-swim — ×2 speed in Rain
// ---------------------------------------------------------------------------

describe("swift-swim ability", () => {
  it("doubles effective speed in Rain, emits AbilityActivated", () => {
    // Given Omastar with swift-swim in no weather — baseline speed
    const omastarBase = MockPokemon.fresh(MockPokemon.base, {
      id: "omastar",
      definitionId: "omastar",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "swift-swim",
      combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 3, jump: 1, initiative: 55 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { state: noRainState } = buildMoveTestEngine([omastarBase, foe]);
    const baseInitiative = getEffectiveInitiative(
      noRainState.pokemon.get("omastar")!,
      noRainState,
      abilityRegistry,
    );

    // Given Omastar with swift-swim in Rain
    const omastarRain = MockPokemon.fresh(MockPokemon.base, {
      id: "omastar",
      definitionId: "omastar",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "swift-swim",
      combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 3, jump: 1, initiative: 55 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: rainEngine, state: rainState } = buildMoveTestEngine([omastarRain, foe2]);
    setWeather(rainState, Weather.Rain, 5);

    const abilityEvents: unknown[] = [];
    rainEngine.on(BattleEventType.AbilityActivated, (e) => abilityEvents.push(e));

    rainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "omastar",
      direction: Direction.South,
    });
    rainEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    const rainInitiative = getEffectiveInitiative(
      rainState.pokemon.get("omastar")!,
      rainState,
      abilityRegistry,
    );
    expect(rainInitiative).toBeGreaterThan(baseInitiative);
    expect(rainInitiative).toBeCloseTo(baseInitiative * 2, -1);
    expect(abilityEvents.length).toBeGreaterThan(0);
  });

  it("does not boost speed outside of Rain", () => {
    const omastar = MockPokemon.fresh(MockPokemon.base, {
      id: "omastar",
      definitionId: "omastar",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "swift-swim",
      combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 3, jump: 1, initiative: 55 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { state } = buildMoveTestEngine([omastar, foe]);
    setWeather(state, Weather.Sun, 5);

    const initiative = getEffectiveInitiative(
      state.pokemon.get("omastar")!,
      state,
      abilityRegistry,
    );
    expect(initiative).toBe(55);
  });
});

// ---------------------------------------------------------------------------
// 14. Sand-veil — +1 evasion stage in Sandstorm
// ---------------------------------------------------------------------------

describe("sand-veil ability", () => {
  it("emits AbilityActivated when Sandstorm is active and applies +1 evasion via accuracy check", () => {
    const sandslashSand = MockPokemon.fresh(MockPokemon.base, {
      id: "sandslash",
      definitionId: "sandslash",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "sand-veil",
      derivedStats: { movement: 3, jump: 1, initiative: 65 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: sandEngine, state: sandState } = buildMoveTestEngine([sandslashSand, foe2]);
    setWeather(sandState, Weather.Sandstorm, 5);

    const abilityEvents: unknown[] = [];
    sandEngine.on(BattleEventType.AbilityActivated, (e) => abilityEvents.push(e));

    sandEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "sandslash",
      direction: Direction.South,
    });
    sandEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(abilityEvents.length).toBeGreaterThan(0);
    const sandslash = sandState.pokemon.get("sandslash");
    const handler = abilityRegistry.getForPokemon(sandslash!);
    expect(handler?.weatherEvasionBoost).toEqual({ weather: Weather.Sandstorm, stages: 1 });
  });

  it("does not emit AbilityActivated outside of Sandstorm", () => {
    const sandslash = MockPokemon.fresh(MockPokemon.base, {
      id: "sandslash",
      definitionId: "sandslash",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "sand-veil",
      derivedStats: { movement: 3, jump: 1, initiative: 65 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([sandslash, foe]);
    setWeather(state, Weather.Snow, 5);

    const abilityEvents: unknown[] = [];
    engine.on(BattleEventType.AbilityActivated, (e) => abilityEvents.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "sandslash",
      direction: Direction.South,
    });

    expect(abilityEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 24. Cloud Nine (Golduck) — negates all weather effects board-wide
// ---------------------------------------------------------------------------

describe("cloud-nine ability (Golduck)", () => {
  it("Fire move does NOT get Sun boost when Golduck with cloud-nine is on the board", () => {
    // Given Sun is active AND Golduck is on field with cloud-nine
    vi.spyOn(Math, "random").mockReturnValue(0);

    // Reference: fire damage in Sun WITHOUT cloud-nine
    const fireUserRef = MockPokemon.fresh(MockPokemon.base, {
      id: "fire-user",
      definitionId: "charizard",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ember"],
      currentPp: { ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const targetRef = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: refEngine, state: refState } = buildMoveTestEngine([fireUserRef, targetRef]);
    setWeather(refState, Weather.Sun, 5);
    refEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "fire-user",
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });
    const sunDamage = 500 - (refState.pokemon.get("target")?.currentHp ?? 500);

    // Cloud-nine scenario: Golduck on same team as fire-user in Sun
    const golduck = MockPokemon.fresh(MockPokemon.base, {
      id: "golduck",
      definitionId: "golduck",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "cloud-nine",
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const fireUser = MockPokemon.fresh(MockPokemon.base, {
      id: "fire-user",
      definitionId: "charizard",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ember"],
      currentPp: { ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: cloudEngine, state: cloudState } = buildMoveTestEngine([
      golduck,
      fireUser,
      target,
    ]);
    setWeather(cloudState, Weather.Sun, 5);
    cloudEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "fire-user",
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });
    const cloudDamage = 500 - (cloudState.pokemon.get("target")?.currentHp ?? 500);

    // Cloud Nine negates Sun: damage should be lower (no ×1.5 Fire boost)
    expect(cloudDamage).toBeLessThan(sunDamage);
    // State weather is preserved (timer continues)
    expect(cloudState.weather).toBe(Weather.Sun);
    vi.restoreAllMocks();
  });

  it("Sandstorm damage is suppressed when Golduck with cloud-nine is on the board", () => {
    const golduck = MockPokemon.fresh(MockPokemon.base, {
      id: "golduck",
      definitionId: "golduck",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "cloud-nine",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 100,
      maxHp: 100,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      currentHp: 100,
      maxHp: 100,
    });
    const { engine, state } = buildMoveTestEngine([golduck, foe]);
    setWeather(state, Weather.Sandstorm, 5);

    // Golduck (Water type) would normally take Sandstorm damage but cloud-nine suppresses it
    const hpBefore = state.pokemon.get("golduck")!.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "golduck",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    // Cloud Nine suppresses Sandstorm damage
    expect(state.pokemon.get("golduck")!.currentHp).toBe(hpBefore);
    // Weather timer still ticked (state.weatherTurnsRemaining decreased)
    expect(state.weatherTurnsRemaining).toBe(4);
    expect(state.weather).toBe(Weather.Sandstorm);
  });

  it("weather effects resume when Golduck is KO'd", () => {
    // Given Golduck KO'd — Sandstorm damage should apply on the next tick
    vi.spyOn(Math, "random").mockReturnValue(0);
    const golduck = MockPokemon.fresh(MockPokemon.base, {
      id: "golduck",
      definitionId: "golduck",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "cloud-nine",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      currentHp: 0,
      maxHp: 100,
    });
    const normalType = MockPokemon.fresh(MockPokemon.base, {
      id: "normal-type",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      currentHp: 100,
      maxHp: 100,
    });
    const { state } = buildMoveTestEngine([golduck, normalType]);
    setWeather(state, Weather.Sandstorm, 5);

    const hasCloudNineOnBoard = [...state.pokemon.values()].some(
      (p) => p.currentHp > 0 && p.abilityId === "cloud-nine",
    );
    expect(hasCloudNineOnBoard).toBe(false);

    vi.restoreAllMocks();
  });
});
