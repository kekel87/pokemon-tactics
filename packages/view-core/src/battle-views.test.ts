import {
  AURA_RADIUS,
  type BattleState,
  EntryHazardKind,
  FieldGlobalKind,
  PokemonGender,
  type PokemonInstance,
  type Position,
  StatusType,
  type TerrainType,
  type TileState,
  Weather,
} from "@pokemon-tactic/core";
import type { PresentationContext } from "@pokemon-tactic/render-ports";
import { describe, expect, it } from "vitest";
import {
  buildInfoPanelView,
  buildTileInfoView,
  buildTimelineView,
  buildWeatherView,
} from "./battle-views.js";

const testContext: PresentationContext = {
  translate: (key) => key,
  getLanguage: () => "en",
  getPortraitUrl: (pokemonId) => `assets/sprites/pokemon/${pokemonId}/portrait-normal.png`,
  getItemIconUrl: (itemId) => `assets/sprites/item-icons/${itemId}.png`,
  getItemName: (itemId) => itemId,
  getAbilityName: (abilityId) => `ability:${abilityId}`,
  getPokemonTypes: () => ["electric"],
  getTypeIconUrl: (type) => `assets/ui/types/${type}.png`,
  getStatusIconUrl: (kind) => `assets/ui/statuses/icon-${kind}.png`,
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

  it("exposes public type chips for either side", () => {
    const pokemon = makePokemon();
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]), false);
    expect(view.types).toEqual([{ id: "electric", label: "Electric" }]);
  });

  it("prefers a type override over the species types", () => {
    const pokemon = makePokemon({ typeOverride: ["fire"] } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]), false);
    expect(view.types.map((t) => t.id)).toEqual(["fire"]);
  });

  it("enriches an ally with ability, nature and battle stats", () => {
    const pokemon = makePokemon({
      abilityId: "static",
      nature: "modest",
      combatStats: { hp: 60, attack: 80, defense: 50, spAttack: 120, spDefense: 55, speed: 110 },
      statStages: { attack: 2, spAttack: -1 },
    } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]), true);
    expect(view.isAlly).toBe(true);
    expect(view.ability).toBe("ability:static");
    expect(view.stats).toHaveLength(5);
    expect(view.stats?.[0].natureEffect).toBe("lower");
    expect(view.stats?.[2].natureEffect).toBe("boost");
    const attack = view.stats?.[0];
    expect(attack).toMatchObject({ value: 80, stage: 2, modified: 160 });
    const spAttack = view.stats?.[2];
    expect(spAttack).toMatchObject({ value: 120, stage: -1, modified: 80 });
    const speed = view.stats?.[4];
    expect(speed).toMatchObject({ value: 110, stage: 0, modified: 110 });
  });

  it("omits stats, ability and nature for an enemy", () => {
    const pokemon = makePokemon({
      abilityId: "static",
      nature: "modest",
    } as unknown as Partial<PokemonInstance>);
    const view = buildInfoPanelView(testContext, pokemon, makeState([pokemon]), false);
    expect(view.isAlly).toBe(false);
    expect(view.stats).toBeUndefined();
    expect(view.ability).toBeUndefined();
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

function tileState(terrain: TerrainType, height = 0): TileState {
  return { position: { x: 0, y: 0 }, height, terrain, occupantId: null };
}

function makeTileState(tile: TileState, overrides: Partial<BattleState> = {}): BattleState {
  return {
    grid: [[tile]],
    entryHazards: [],
    fieldTerrains: [],
    fieldGlobalZones: [],
    distortionZones: [],
    ...overrides,
  } as unknown as BattleState;
}

const ORIGIN: Position = { x: 0, y: 0 };

describe("buildTileInfoView", () => {
  it("returns null for an out-of-bounds tile", () => {
    const state = makeTileState(tileState("normal"));
    expect(buildTileInfoView(testContext, state, { x: 5, y: 5 })).toBeNull();
  });

  it("exposes terrain + height (header) and no effect lines for plain ground", () => {
    const state = makeTileState(tileState("normal", 2));
    const view = buildTileInfoView(testContext, state, ORIGIN);
    expect(view?.terrainLabel).toBe("tileInfo.terrain.normal");
    expect(view?.height).toBe(2);
    expect(view?.lines).toEqual([]);
  });

  it("surfaces magma's burn (status sprite), DoT and Fire type bonus", () => {
    const state = makeTileState(tileState("magma"));
    const chips = buildTileInfoView(testContext, state, ORIGIN)?.lines.flat() ?? [];
    const titles = chips.map((c) => c.title);
    expect(titles).toContain("tileInfo.onStop.burn");
    expect(titles).toContain("tileInfo.dot");
    expect(titles).toContain("tileInfo.typeBonus");
    expect(titles).toContain("tileInfo.immune");
    const burn = chips.find((c) => c.title === "tileInfo.onStop.burn");
    expect(burn?.iconUrls).toEqual(["assets/ui/statuses/icon-burned.png"]);
    const bonus = chips.find((c) => c.title === "tileInfo.typeBonus");
    expect(bonus?.iconUrls).toEqual(["assets/ui/types/fire.png"]);
    expect(bonus?.text).toBe("×1.15");
  });

  it("groups intrinsic effects on line 1, stacks hazards/bonus/immunity below", () => {
    const state = makeTileState(tileState("magma"), {
      entryHazards: [{ kind: EntryHazardKind.Spikes, tile: ORIGIN, layers: 1 }],
    } as unknown as Partial<BattleState>);
    const view = buildTileInfoView(testContext, state, ORIGIN);
    expect(view?.lines[0]?.map((c) => c.title)).toEqual(["tileInfo.onStop.burn", "tileInfo.dot"]);
    const stacked = (view?.lines.slice(1) ?? []).map((row) => row[0]?.title);
    expect(stacked).toEqual(["tileInfo.hazard.spikes", "tileInfo.typeBonus", "tileInfo.immune"]);
  });

  it("shows field/global zones with their remaining-turns duration and no glyph", () => {
    const state = makeTileState(tileState("normal"), {
      fieldTerrains: [
        { kind: "grassy", casterId: "x", tiles: [ORIGIN], anchor: ORIGIN, remainingTurns: 5 },
      ],
      fieldGlobalZones: [
        {
          kind: FieldGlobalKind.Gravity,
          casterId: "x",
          tiles: [ORIGIN],
          anchor: ORIGIN,
          remainingTurns: 3,
        },
      ],
    } as unknown as Partial<BattleState>);
    const chips = buildTileInfoView(testContext, state, ORIGIN)?.lines.flat() ?? [];
    const field = chips.find((c) => c.title === "tileInfo.field.grassy");
    const gravity = chips.find((c) => c.title === "tileInfo.zone.gravity");
    expect(field?.duration).toBe(5);
    expect(field?.emoji).toBeUndefined();
    expect(gravity?.duration).toBe(3);
  });

  it("renders the DoT fraction as a small secondary chip", () => {
    const chips =
      buildTileInfoView(testContext, makeTileState(tileState("magma")), ORIGIN)?.lines.flat() ?? [];
    const dot = chips.find((c) => c.title === "tileInfo.dot");
    expect(dot?.text).toBe("−1/16");
    expect(dot?.small).toBe(true);
  });

  it("drops the warning glyph on hazards (human 2026-07-25)", () => {
    const state = makeTileState(tileState("normal"), {
      entryHazards: [{ kind: EntryHazardKind.Spikes, tile: ORIGIN, layers: 1 }],
    } as unknown as Partial<BattleState>);
    const spikes = buildTileInfoView(testContext, state, ORIGIN)
      ?.lines.flat()
      .find((c) => c.title === "tileInfo.hazard.spikes");
    expect(spikes?.emoji).toBeUndefined();
  });

  it("merges lava's impassable + fatal fall into one traversal chip", () => {
    const state = makeTileState(tileState("lava"));
    const chips = buildTileInfoView(testContext, state, ORIGIN)?.lines.flat() ?? [];
    const traversal = chips.find((c) => c.title === "tileInfo.dotFatal");
    expect(traversal?.emoji).toBe("⛔💀");
    expect(chips.map((c) => c.title)).not.toContain("tileInfo.impassable");
  });

  it("uses the pass-through trigger glyph for magma burn, stop for swamp poison", () => {
    const magma = buildTileInfoView(
      testContext,
      makeTileState(tileState("magma")),
      ORIGIN,
    )?.lines.flat();
    const swamp = buildTileInfoView(
      testContext,
      makeTileState(tileState("swamp")),
      ORIGIN,
    )?.lines.flat();
    expect(magma?.find((c) => c.title === "tileInfo.onStop.burn")?.emoji).toBe("👣");
    expect(swamp?.find((c) => c.title === "tileInfo.onStop.poison")?.emoji).toBe("🛑");
  });

  it("shows the swamp movement penalty as a red negative and poison", () => {
    const chips =
      buildTileInfoView(testContext, makeTileState(tileState("swamp")), ORIGIN)?.lines.flat() ?? [];
    const move = chips.find((c) => c.title === "tileInfo.movementPenalty");
    expect(move?.text).toBe("−2");
    expect(move?.tone).toBe("danger");
    expect(chips.map((c) => c.title)).toContain("tileInfo.onStop.poison");
  });

  it("lists hazards on the tile with a layer count", () => {
    const state = makeTileState(tileState("normal"), {
      entryHazards: [{ kind: EntryHazardKind.Spikes, tile: ORIGIN, layers: 2 }],
    } as unknown as Partial<BattleState>);
    const spikes = buildTileInfoView(testContext, state, ORIGIN)
      ?.lines.flat()
      .find((c) => c.title === "tileInfo.hazard.spikes");
    expect(spikes?.text).toBe("tileInfo.hazard.spikes ×2");
  });

  it("reports an active global zone covering the tile", () => {
    const state = makeTileState(tileState("normal"), {
      fieldGlobalZones: [{ kind: FieldGlobalKind.Gravity, tiles: [ORIGIN] }],
    } as unknown as Partial<BattleState>);
    const titles = buildTileInfoView(testContext, state, ORIGIN)
      ?.lines.flat()
      .map((c) => c.title);
    expect(titles).toContain("tileInfo.zone.gravity");
  });
});
