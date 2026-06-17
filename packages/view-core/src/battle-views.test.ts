import {
  AURA_RADIUS,
  type BattleState,
  PokemonGender,
  type PokemonInstance,
  StatusType,
  Weather,
} from "@pokemon-tactic/core";
import type { PresentationContext } from "@pokemon-tactic/render-ports";
import { describe, expect, it } from "vitest";
import { buildInfoPanelView, buildTimelineView, buildWeatherView } from "./battle-views.js";

const testContext: PresentationContext = {
  translate: (key) => key,
  getLanguage: () => "en",
  getPortraitUrl: (pokemonId) => `assets/sprites/pokemon/${pokemonId}/portrait-normal.png`,
  isDamagePreviewEnabled: () => false,
};

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
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]));
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
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]));
    const debuffs = view.badges.filter((b) => b.variant === "debuff");
    expect(debuffs).toHaveLength(1);
  });

  it("signs and colours stat stages", () => {
    const pokemon = makePokemon({
      statStages: { attack: 1, defense: -2 },
    } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]));
    const buff = view.badges.find((b) => b.variant === "buff");
    const debuff = view.badges.find((b) => b.variant === "debuff");
    expect(buff?.label.endsWith("+1")).toBe(true);
    expect(debuff?.label.endsWith("-2")).toBe(true);
  });

  it("badges volatile statuses", () => {
    const pokemon = makePokemon({
      volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
    } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]));
    expect(view.badges.filter((b) => b.variant === "volatile")).toHaveLength(1);
  });

  it("badges the caster's own aura", () => {
    const pokemon = makePokemon();
    const state = makeState([pokemon], {
      auras: [{ casterPokemonId: pokemon.id, kind: "reflect", remainingRounds: 4 }],
    } as unknown as Partial<BattleState>);
    expect(
      buildInfoPanelView(testContext, pokemon, state).badges.filter(
        (b) => b.variant === "volatile",
      ),
    ).toHaveLength(1);
  });

  it("badges an ally aura covering this Pokémon, but not one out of range", () => {
    const protectedMon = makePokemon({ id: "p1-pikachu", position: { x: 0, y: 0 } });
    const nearCaster = makePokemon({ id: "p1-onix", position: { x: 1, y: 0 } });
    const within = makeState([protectedMon, nearCaster], {
      auras: [{ casterPokemonId: nearCaster.id, kind: "light-screen", remainingRounds: 3 }],
    } as unknown as Partial<BattleState>);
    expect(buildInfoPanelView(testContext, protectedMon, within).badges).toHaveLength(1);

    const farCaster = makePokemon({ id: "p1-onix", position: { x: AURA_RADIUS + 5, y: 0 } });
    const outside = makeState([protectedMon, farCaster], {
      auras: [{ casterPokemonId: farCaster.id, kind: "light-screen", remainingRounds: 3 }],
    } as unknown as Partial<BattleState>);
    expect(buildInfoPanelView(testContext, protectedMon, outside).badges).toHaveLength(0);
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
  it("lists the active mon (no bar) then upcoming mons by current charge (Charge-Time)", () => {
    const a = makePokemon({ id: "p1-a", position: { x: 0, y: 0 } });
    const b = makePokemon({ id: "p2-b", playerId: "player-2", position: { x: 1, y: 0 } });
    const state = makeState([a, b], {
      activePokemonId: "p1-a",
      // p1-a has crossed the threshold (active); p2-b is half-charged.
      ctSnapshot: { "p1-a": 1200, "p2-b": 500 },
    } as unknown as Partial<BattleState>);

    const view = buildTimelineView(state, [{ pokemonId: "p2-b", ct: 9999 }]);
    expect(view.showCtBars).toBe(true);
    // Active entry: no bar (a full bar would read as "almost ready" instead of "acting now").
    expect(view.entries[0]).toMatchObject({ isActive: true, ctRatio: null });
    // Upcoming entry: its CURRENT charge (500 / 1000), not the predicted cross value.
    expect(view.entries[1]).toMatchObject({ isActive: false, ctRatio: 0.5 });
  });

  it("shows a later turn of an already-listed mon dimmed with no bar", () => {
    const a = makePokemon({ id: "p1-a", position: { x: 0, y: 0 } });
    const b = makePokemon({ id: "p2-b", playerId: "player-2", position: { x: 1, y: 0 } });
    const state = makeState([a, b], {
      activePokemonId: "p1-a",
      ctSnapshot: { "p1-a": 1200, "p2-b": 500 },
    } as unknown as Partial<BattleState>);

    // p2-b appears twice in the prediction; its second occurrence is a future projection.
    const view = buildTimelineView(state, [
      { pokemonId: "p2-b", ct: 9999 },
      { pokemonId: "p2-b", ct: 9999 },
    ]);
    expect(view.entries[2]).toMatchObject({ isActive: false, dimmed: true, ctRatio: null });
  });

  it("preview mode shows the resulting order with the deciding mon marked (no top pin, no bars)", () => {
    const a = makePokemon({ id: "p1-a", position: { x: 0, y: 0 } });
    const b = makePokemon({ id: "p2-b", playerId: "player-2", position: { x: 1, y: 0 } });
    const state = makeState([a, b], {
      activePokemonId: "p1-a",
      ctSnapshot: { "p1-a": 1200, "p2-b": 500 },
    } as unknown as Partial<BattleState>);

    // After committing the move, p2-b acts, then the deciding mon (p1-a) slots back in.
    const view = buildTimelineView(
      state,
      [
        { pokemonId: "p2-b", ct: 9999 },
        { pokemonId: "p1-a", ct: 9999 },
      ],
      true,
    );
    expect(view.showCtBars).toBe(false);
    // No entry is pinned as "active" during preview.
    expect(view.entries.every((e) => !e.isActive)).toBe(true);
    // The deciding mon is marked isSelf at its resulting position (2nd), not pinned on top.
    expect(view.entries[0]).toMatchObject({ isSelf: false });
    expect(view.entries[1]).toMatchObject({ isSelf: true });
  });
});
