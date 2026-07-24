import { describe, expect, it } from "vitest";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { MockPokemon } from "../testing/mock-pokemon";
import type { BaseStats } from "../types/base-stats";
import { effectiveDisplayStat } from "./display-stat";

const CLEAN: BaseStats = {
  hp: 100,
  attack: 100,
  defense: 100,
  spAttack: 100,
  spDefense: 100,
  speed: 100,
};

const BURNED = { type: StatusType.Burned, remainingTurns: null };
const PARALYZED = { type: StatusType.Paralyzed, remainingTurns: null };

describe("effectiveDisplayStat", () => {
  it("applies stat-stage crans", () => {
    const pokemon = {
      ...MockPokemon.base,
      combatStats: CLEAN,
      statStages: { ...MockPokemon.base.statStages, attack: 2 },
    };
    expect(effectiveDisplayStat(pokemon, StatName.Attack)).toBe(200);
  });

  it("halves physical Attack when burned", () => {
    const pokemon = { ...MockPokemon.base, combatStats: CLEAN, statusEffects: [BURNED] };
    expect(effectiveDisplayStat(pokemon, StatName.Attack)).toBe(50);
  });

  it("stacks the burn cut on top of crans", () => {
    const pokemon = {
      ...MockPokemon.base,
      combatStats: CLEAN,
      statStages: { ...MockPokemon.base.statStages, attack: 2 },
      statusEffects: [BURNED],
    };
    expect(effectiveDisplayStat(pokemon, StatName.Attack)).toBe(100);
  });

  it("boosts Attack ×1.5 with Cran and ignores the burn cut", () => {
    const pokemon = {
      ...MockPokemon.base,
      combatStats: CLEAN,
      abilityId: "guts",
      statusEffects: [BURNED],
    };
    expect(effectiveDisplayStat(pokemon, StatName.Attack)).toBe(150);
  });

  it("halves Speed when paralyzed", () => {
    const pokemon = { ...MockPokemon.base, combatStats: CLEAN, statusEffects: [PARALYZED] };
    expect(effectiveDisplayStat(pokemon, StatName.Speed)).toBe(50);
  });

  it("boosts Speed ×1.5 with Pied Véloce and ignores the paralysis cut", () => {
    const pokemon = {
      ...MockPokemon.base,
      combatStats: CLEAN,
      abilityId: "quick-feet",
      statusEffects: [PARALYZED],
    };
    expect(effectiveDisplayStat(pokemon, StatName.Speed)).toBe(150);
  });

  it("leaves defensive stats to the stage multiplier only", () => {
    const pokemon = {
      ...MockPokemon.base,
      combatStats: CLEAN,
      statStages: { ...MockPokemon.base.statStages, defense: -1 },
      statusEffects: [BURNED],
    };
    expect(effectiveDisplayStat(pokemon, StatName.Defense)).toBe(66);
  });
});
