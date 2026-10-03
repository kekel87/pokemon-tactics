import {
  AuraKind,
  DefensiveKind,
  Direction,
  EntryHazardKind,
  FieldGlobalKind,
  FieldTerrain,
  StatName,
  StatusType,
  TerrainType,
} from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";
import type { TranslationKey } from "./types";

const NOT_LOGGED_STATUSES: readonly StatusType[] = [
  StatusType.Intimidated,
  StatusType.LockedOn,
  StatusType.Roosted,
  StatusType.Imprisoning,
  StatusType.Cursed,
];

const NOT_LOGGED_TERRAINS: readonly TerrainType[] = [
  TerrainType.Normal,
  TerrainType.TallGrass,
  TerrainType.Obstacle,
  TerrainType.Water,
  TerrainType.DeepWater,
  TerrainType.Lava,
  TerrainType.Ice,
  TerrainType.Sand,
  TerrainType.Snow,
];

function expectKeyInEveryLocale(key: string): void {
  for (const [language, locale] of Object.entries(LOCALES)) {
    expect(locale[key as TranslationKey], `absente de ${language}.ts : ${key}`).toBeDefined();
  }
}

function expectKeyInNeitherLocale(key: string): void {
  for (const [language, locale] of Object.entries(LOCALES)) {
    expect(
      locale[key as TranslationKey],
      `présente en trop dans ${language}.ts : ${key}`,
    ).toBeUndefined();
  }
}

describe("clés i18n composées du journal de combat", () => {
  it.each(Object.values(StatName))("statistique %s a sa clé", (stat) => {
    expectKeyInEveryLocale(`battleLog.stat.${stat}`);
  });

  it.each(Object.values(AuraKind))("aura %s a sa clé", (kind) => {
    expectKeyInEveryLocale(`battleLog.aura.${kind}`);
  });

  it.each(Object.values(DefensiveKind))("protection %s a sa clé", (kind) => {
    expectKeyInEveryLocale(`battleLog.defense.${kind}`);
  });

  it.each(Object.values(EntryHazardKind))("piège d'entrée %s a sa clé", (kind) => {
    expectKeyInEveryLocale(`battleLog.entryHazard.${kind}`);
  });

  it.each(Object.values(FieldGlobalKind))("zone globale %s a sa clé", (kind) => {
    expectKeyInEveryLocale(`battleLog.fieldGlobal.${kind}`);
  });

  it.each(Object.values(FieldTerrain))("champ %s a sa clé", (kind) => {
    expectKeyInEveryLocale(`battleLog.fieldTerrain.${kind}`);
  });

  it.each(Object.values(Direction))("direction %s a sa clé", (direction) => {
    expectKeyInEveryLocale(`battleLog.direction.${direction}`);
  });

  it.each(Object.values(StatusType).filter((status) => !NOT_LOGGED_STATUSES.includes(status)))(
    "statut journalisé %s a ses clés d'application et de disparition",
    (status) => {
      expectKeyInEveryLocale(`battleLog.status.${status}.applied`);
      expectKeyInEveryLocale(`battleLog.status.${status}.removed`);
    },
  );

  it.each(NOT_LOGGED_STATUSES)("statut hors journal %s n'a pas de clé", (status) => {
    expectKeyInNeitherLocale(`battleLog.status.${status}.applied`);
    expectKeyInNeitherLocale(`battleLog.status.${status}.removed`);
  });

  it.each(Object.values(TerrainType).filter((terrain) => !NOT_LOGGED_TERRAINS.includes(terrain)))(
    "terrain infligeant un statut %s a sa clé",
    (terrain) => {
      expectKeyInEveryLocale(`battleLog.terrainStatus.${terrain}`);
    },
  );

  it.each(NOT_LOGGED_TERRAINS)("terrain sans statut %s n'a pas de clé", (terrain) => {
    expectKeyInNeitherLocale(`battleLog.terrainStatus.${terrain}`);
  });

  it("chaque valeur d'enum est classée, journalisée ou non", () => {
    expect(Object.values(StatusType)).toHaveLength(25);
    expect(NOT_LOGGED_STATUSES).toHaveLength(5);
    expect(Object.values(TerrainType)).toHaveLength(11);
    expect(NOT_LOGGED_TERRAINS).toHaveLength(9);
  });
});
