import { DEFAULT_BATTLE_LEVEL } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { createBattleFromPlacements, createDefaultBattleConfig } from "./BattleSetup";

const build = (levelOverrides?: Record<string, number>) => {
  const config = createDefaultBattleConfig();
  const { state } = createBattleFromPlacements(
    levelOverrides === undefined ? config : { ...config, levelOverrides },
  );
  return state;
};

const idsOf = (): string[] => createDefaultBattleConfig().placements.map((p) => p.pokemonId);

describe("BattleSetup — le niveau appartient au Pokemon", () => {
  it("retombe sur le niveau par défaut quand la configuration n'en demande aucun", () => {
    const levels = [...build().pokemon.values()].map((pokemon) => pokemon.level);

    expect(levels.length).toBeGreaterThan(0);
    expect(new Set(levels)).toEqual(new Set([DEFAULT_BATTLE_LEVEL]));
  });

  it("pose un niveau différent par Pokemon dans un même combat", () => {
    const [premier, second] = idsOf() as [string, string];
    const state = build({ [premier]: 10, [second]: 80 });

    expect(state.pokemon.get(premier)?.level).toBe(10);
    expect(state.pokemon.get(second)?.level).toBe(80);
  });

  it("laisse au défaut les Pokemon qu'aucune surcharge ne nomme", () => {
    const [premier, second] = idsOf() as [string, string];
    const state = build({ [premier]: 10 });

    expect(state.pokemon.get(second)?.level).toBe(DEFAULT_BATTLE_LEVEL);
  });

  it("fait vraiment baisser les statistiques, PV compris, au niveau inférieur", () => {
    const [premier] = idsOf() as [string];
    const bas = build({ [premier]: 30 }).pokemon.get(premier);
    const haut = build().pokemon.get(premier);

    expect(bas?.maxHp).toBeLessThan(haut?.maxHp as number);
    expect(bas?.combatStats.attack).toBeLessThan(haut?.combatStats.attack as number);
  });

  it("refuse un niveau absurde au lieu de produire des statistiques folles en silence", () => {
    const [premier] = idsOf() as [string];
    const withLevel = (level: unknown) => () => build({ [premier]: level as number });

    expect(withLevel(0)).toThrow(/Niveau invalide/);
    expect(withLevel(101)).toThrow(/Niveau invalide/);
    expect(withLevel(12.5)).toThrow(/Niveau invalide/);
    expect(withLevel("30")).toThrow(/Niveau invalide/);
  });

  it("nomme le Pokemon fautif dans le refus", () => {
    const [premier] = idsOf() as [string];

    expect(() => build({ [premier]: 0 })).toThrow(premier);
  });

  it("le format ramène TOUS les Pokemon à son niveau, écrasant les niveaux individuels", () => {
    const [premier, second] = idsOf() as [string, string];
    const config = createDefaultBattleConfig();
    const { state } = createBattleFromPlacements({
      ...config,
      levelOverrides: { [premier]: 10, [second]: 80 },
      formatRules: { adjustLevel: 50 },
    });

    expect([...state.pokemon.values()].map((pokemon) => pokemon.level)).toEqual(
      Array.from({ length: state.pokemon.size }, () => 50),
    );
  });

  it("laisse chaque Pokemon à son niveau quand le format n'impose rien", () => {
    const [premier, second] = idsOf() as [string, string];
    const config = createDefaultBattleConfig();
    const { state } = createBattleFromPlacements({
      ...config,
      levelOverrides: { [premier]: 10, [second]: 80 },
      formatRules: {},
    });

    expect(state.pokemon.get(premier)?.level).toBe(10);
    expect(state.pokemon.get(second)?.level).toBe(80);
  });

  it("refuse un niveau de format absurde comme un niveau individuel", () => {
    const config = createDefaultBattleConfig();

    expect(() =>
      createBattleFromPlacements({ ...config, formatRules: { adjustLevel: 0 } }),
    ).toThrow(/Niveau invalide/);
  });
});
