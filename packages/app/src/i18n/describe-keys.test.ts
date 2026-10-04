import {
  AuraKind,
  type BattleState,
  EntryHazardKind,
  FieldGlobalKind,
  FieldTerrain,
  PokemonGender,
  type PokemonInstance,
  type Position,
  StatName,
  StatusType,
  TerrainType,
  Weather,
} from "@pokemon-tactic/core";
import type { PresentationContext } from "@pokemon-tactic/render-ports";
import { buildInfoPanelView, buildTileInfoView } from "@pokemon-tactic/view-core";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";
import type { TranslationKey } from "./types";

const DESCRIBE_PREFIX = "describe.";

const producedKeys = new Set<string>();

const recordingContext: PresentationContext = {
  translate: (key) => {
    if (key.startsWith(DESCRIBE_PREFIX)) {
      producedKeys.add(key);
    }
    return key;
  },
  getLanguage: () => "fr",
  getPortraitUrl: () => "",
  getItemIconUrl: () => "",
  getItemName: (itemId) => itemId,
  getAbilityName: (abilityId) => abilityId,
  getItemDescription: () => undefined,
  getAbilityDescription: () => undefined,
  getPokemonTypes: () => ["electric"],
  getTypeIconUrl: () => "",
  getStatusIconUrl: () => "",
  getStatusLabelUrl: () => "",
  isDamagePreviewEnabled: () => false,
  isEnemyInfoHidden: () => true,
};

const ORIGIN: Position = { x: 0, y: 0 };

const ALL_STAT_STAGES = Object.fromEntries(
  Object.values(StatName)
    .filter((stat) => stat !== StatName.Hp)
    .map((stat) => [stat, 1]),
);

const LOADED_POKEMON = {
  id: "p1-raichu",
  definitionId: "raichu",
  playerId: "player-1",
  level: 50,
  position: ORIGIN,
  currentHp: 30,
  maxHp: 60,
  combatStats: { hp: 60, attack: 90, defense: 55, spAttack: 90, spDefense: 80, speed: 110 },
  nature: "serious",
  gender: PokemonGender.Genderless,
  abilityId: "static",
  heldItemId: "leftovers",
  moveIds: ["thunderbolt"],
  statusEffects: [],
  statStages: ALL_STAT_STAGES,
  volatileStatuses: Object.values(StatusType).map((type) => ({ type, remainingTurns: 2 })),
  chargingMove: { moveId: "solar-beam" },
  lockInMoveId: "outrage",
  lockInTurnsRemaining: 2,
  substituteHp: 15,
  pendingWish: { healAmount: 30, castAtAction: 1 },
  helpingHand: true,
  critStageBoost: 2,
  guaranteedCritArmed: true,
  perishAura: { turnsRemaining: 3, radius: 3 },
  smackedDown: true,
  drowsyTurns: 1,
  magnetRiseTurns: 2,
  stockpileCount: 1,
  typeOverride: [],
  abilitySuppressed: true,
  arenaTrapped: true,
  revealedTopMove: true,
} as unknown as PokemonInstance;

const SWAPPED_POKEMON = {
  ...LOADED_POKEMON,
  typeOverride: ["fire"],
  abilitySuppressed: false,
  abilityIdOverride: "levitate",
  abilitySuppressedByGas: true,
} as unknown as PokemonInstance;

const ALLY_CASTER = {
  ...LOADED_POKEMON,
  id: "p1-onix",
  position: { x: 1, y: 0 },
} as unknown as PokemonInstance;

const AURA_STATE = {
  pokemon: new Map([
    [LOADED_POKEMON.id, LOADED_POKEMON],
    [ALLY_CASTER.id, ALLY_CASTER],
  ]),
  auras: Object.values(AuraKind).flatMap((kind) => [
    { casterPokemonId: LOADED_POKEMON.id, kind, remainingRounds: 3 },
    { casterPokemonId: ALLY_CASTER.id, kind, remainingRounds: 3 },
  ]),
} as unknown as BattleState;

const ZONE = { casterId: "x", tiles: [ORIGIN], anchor: ORIGIN, remainingTurns: 3 };

const TILE_STATE = {
  grid: [[{ position: ORIGIN, height: 0, terrain: TerrainType.Normal, occupantId: null }]],
  entryHazards: Object.values(EntryHazardKind).map((kind) => ({ kind, tile: ORIGIN, layers: 1 })),
  fieldTerrains: [],
  fieldGlobalZones: Object.values(FieldGlobalKind).map((kind) => ({ ...ZONE, kind })),
  distortionZones: [ZONE],
} as unknown as BattleState;

for (const pokemon of [LOADED_POKEMON, SWAPPED_POKEMON]) {
  buildInfoPanelView(recordingContext, pokemon, AURA_STATE, false);
}
for (const type of Object.values(StatusType)) {
  buildInfoPanelView(
    recordingContext,
    { ...LOADED_POKEMON, statusEffects: [{ type, remainingTurns: null }] } as PokemonInstance,
    AURA_STATE,
    false,
  );
}
buildTileInfoView(recordingContext, TILE_STATE, ORIGIN);
for (const kind of Object.values(FieldTerrain)) {
  buildTileInfoView(
    recordingContext,
    { ...TILE_STATE, fieldTerrains: [{ ...ZONE, kind }] } as BattleState,
    ORIGIN,
  );
}

const HUD_KEYS = [
  ...Object.values(Weather)
    .filter((weather) => weather !== Weather.None)
    .map((weather) => `${DESCRIBE_PREFIX}weather.${weather}`),
  `${DESCRIBE_PREFIX}tailwind.label`,
];

describe("descriptions des infobulles (plan 225)", () => {
  it.each([...producedKeys, ...HUD_KEYS])("%s existe dans les trois locales", (key) => {
    for (const [language, locale] of Object.entries(LOCALES)) {
      expect(locale[key as TranslationKey], `absente de ${language}.ts`).toBeTruthy();
    }
  });

  it("aucune clé describe. des locales n'est orpheline de son producteur", () => {
    const expected = new Set([...producedKeys, ...HUD_KEYS]);
    for (const [language, locale] of Object.entries(LOCALES)) {
      const orphans = Object.keys(locale).filter(
        (key) => key.startsWith(DESCRIBE_PREFIX) && !expected.has(key),
      );
      expect(orphans, language).toEqual([]);
    }
  });

  it("chaque description a son libellé jumeau dans les trois locales", () => {
    for (const key of [...producedKeys, ...HUD_KEYS]) {
      const label = key.slice(DESCRIBE_PREFIX.length);
      for (const [language, locale] of Object.entries(LOCALES)) {
        expect(locale[label as TranslationKey], `${label} absente de ${language}.ts`).toBeTruthy();
      }
    }
  });
});
