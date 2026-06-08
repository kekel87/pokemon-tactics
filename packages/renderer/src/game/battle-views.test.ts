import {
  AURA_RADIUS,
  type BattleState,
  PokemonGender,
  type PokemonInstance,
  StatusType,
  TurnSystemKind,
  Weather,
} from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { buildInfoPanelView, buildTimelineView, buildWeatherView } from "./battle-views.js";

function makePokemon(overrides: Partial<PokemonInstance> = {}): PokemonInstance {
  return {
    id: "p1-pikachu",
    definitionId: "pikachu",
    playerId: "player-1",
    level: 50,
    position: { x: 0, y: 0 },
    currentHp: 30,
    maxHp: 35,
    gender: PokemonGender.Genderless,
    statusEffects: [],
    statStages: {},
    volatileStatuses: [],
    ...overrides,
  } as unknown as PokemonInstance;
}

function makeState(pokemon: PokemonInstance[], overrides: Partial<BattleState> = {}): BattleState {
  return {
    pokemon: new Map(pokemon.map((p) => [p.id, p])),
    auras: [],
    weather: Weather.None,
    weatherTurnsRemaining: 0,
    ...overrides,
  } as unknown as BattleState;
}

describe("buildInfoPanelView", () => {
  it("exposes identity, hp and team from the player id", () => {
    const pokemon = makePokemon();
    const view = buildInfoPanelView(pokemon, makeState([pokemon]));
    expect(view.name.length).toBeGreaterThan(0);
    expect(view.level).toBe(50);
    expect(view.hpCurrent).toBe(30);
    expect(view.hpMax).toBe(35);
    expect(view.team).toBe(1);
    expect(view.portraitUrl).toContain("pikachu");
    expect(view.gender).toBeUndefined();
  });

  it("badges a major status as a debuff", () => {
    const pokemon = makePokemon({
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(pokemon, makeState([pokemon]));
    const debuffs = view.badges.filter((b) => b.variant === "debuff");
    expect(debuffs).toHaveLength(1);
  });

  it("signs and colours stat stages", () => {
    const pokemon = makePokemon({
      statStages: { attack: 1, defense: -2 },
    } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(pokemon, makeState([pokemon]));
    const buff = view.badges.find((b) => b.variant === "buff");
    const debuff = view.badges.find((b) => b.variant === "debuff");
    expect(buff?.label.endsWith("+1")).toBe(true);
    expect(debuff?.label.endsWith("-2")).toBe(true);
  });

  it("badges volatile statuses", () => {
    const pokemon = makePokemon({
      volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
    } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(pokemon, makeState([pokemon]));
    expect(view.badges.filter((b) => b.variant === "volatile")).toHaveLength(1);
  });

  it("badges the caster's own aura", () => {
    const pokemon = makePokemon();
    const state = makeState([pokemon], {
      auras: [{ casterPokemonId: pokemon.id, kind: "reflect", remainingRounds: 4 }],
    } as unknown as Partial<BattleState>);
    expect(
      buildInfoPanelView(pokemon, state).badges.filter((b) => b.variant === "volatile"),
    ).toHaveLength(1);
  });

  it("badges an ally aura covering this Pokémon, but not one out of range", () => {
    const protectedMon = makePokemon({ id: "p1-pikachu", position: { x: 0, y: 0 } });
    const nearCaster = makePokemon({ id: "p1-onix", position: { x: 1, y: 0 } });
    const within = makeState([protectedMon, nearCaster], {
      auras: [{ casterPokemonId: nearCaster.id, kind: "light-screen", remainingRounds: 3 }],
    } as unknown as Partial<BattleState>);
    expect(buildInfoPanelView(protectedMon, within).badges).toHaveLength(1);

    const farCaster = makePokemon({ id: "p1-onix", position: { x: AURA_RADIUS + 5, y: 0 } });
    const outside = makeState([protectedMon, farCaster], {
      auras: [{ casterPokemonId: farCaster.id, kind: "light-screen", remainingRounds: 3 }],
    } as unknown as Partial<BattleState>);
    expect(buildInfoPanelView(protectedMon, outside).badges).toHaveLength(0);
  });
});

describe("buildWeatherView", () => {
  it("returns null when there is no weather", () => {
    expect(buildWeatherView(makeState([]))).toBeNull();
  });

  it("maps active weather to a view", () => {
    const view = buildWeatherView(
      makeState([], {
        weather: Weather.Sun,
        weatherTurnsRemaining: 5,
      } as unknown as Partial<BattleState>),
    );
    expect(view).toEqual({ kind: "sun", turnsRemaining: 5 });
  });
});

describe("buildTimelineView", () => {
  it("lists the round order then a separator for already-acted mons (Round-Robin)", () => {
    const a = makePokemon({ id: "p1-a", position: { x: 0, y: 0 } });
    const b = makePokemon({ id: "p2-b", playerId: "player-2", position: { x: 1, y: 0 } });
    const c = makePokemon({ id: "p1-c", position: { x: 2, y: 0 } });
    const state = makeState([a, b, c], {
      turnSystemKind: TurnSystemKind.RoundRobin,
      turnOrder: ["p1-a", "p2-b", "p1-c"],
      currentTurnIndex: 1,
      roundNumber: 3,
      predictedNextRoundOrder: ["p1-a"],
    } as unknown as Partial<BattleState>);

    const view = buildTimelineView(state, []);
    expect(view.showCtBars).toBe(false);
    expect(view.entries.map((e) => e.definitionId)).toEqual(["pikachu", "pikachu", "pikachu"]);
    expect(view.entries[0]?.isActive).toBe(true);
    expect(view.entries[0]?.ctRatio).toBeNull();
    expect(view.entries[2]).toMatchObject({ dimmed: true, separatorRound: 4 });
  });

  it("lists the active mon then the predicted CT sequence (Charge-Time)", () => {
    const a = makePokemon({ id: "p1-a", position: { x: 0, y: 0 } });
    const b = makePokemon({ id: "p2-b", playerId: "player-2", position: { x: 1, y: 0 } });
    const state = makeState([a, b], {
      turnSystemKind: TurnSystemKind.ChargeTime,
      turnOrder: ["p1-a"],
      currentTurnIndex: 0,
      ctSnapshot: { "p1-a": 999999 },
    } as unknown as Partial<BattleState>);

    const view = buildTimelineView(state, [{ pokemonId: "p2-b", ct: 0 }]);
    expect(view.showCtBars).toBe(true);
    expect(view.entries[0]).toMatchObject({ isActive: true });
    expect(view.entries[0]?.ctRatio).toBe(1);
    expect(view.entries[1]).toMatchObject({ isActive: false, ctRatio: 0 });
  });
});
