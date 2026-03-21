import { describe, expect, it } from "vitest";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { MockPokemon } from "../testing/mock-pokemon";
import type { PokemonInstance } from "../types/pokemon-instance";
import { getEffectiveInitiative } from "./initiative-calculator";

describe("getEffectiveSpeed / getEffectiveInitiative", () => {
  it("returns base initiative when no modifiers apply", () => {
    const pokemon: PokemonInstance = {
      ...MockPokemon.charmander,
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 100 },
    };

    expect(getEffectiveInitiative(pokemon)).toBe(100);
  });

  it("applies paralysis modifier (-50%)", () => {
    const pokemon: PokemonInstance = {
      ...MockPokemon.charmander,
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 100 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
    };

    expect(getEffectiveInitiative(pokemon)).toBe(50);
  });

  it("applies speed stat stage multiplier (+2 = x2)", () => {
    const pokemon: PokemonInstance = {
      ...MockPokemon.charmander,
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 100 },
      statStages: { ...MockPokemon.charmander.statStages, [StatName.Speed]: 2 },
    };

    expect(getEffectiveInitiative(pokemon)).toBe(200);
  });

  it("applies speed stat stage multiplier (-1 = x0.67)", () => {
    const pokemon: PokemonInstance = {
      ...MockPokemon.charmander,
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 100 },
      statStages: { ...MockPokemon.charmander.statStages, [StatName.Speed]: -1 },
    };

    expect(getEffectiveInitiative(pokemon)).toBe(66);
  });

  it("cumulates paralysis and speed stage", () => {
    const pokemon: PokemonInstance = {
      ...MockPokemon.charmander,
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 100 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
      statStages: { ...MockPokemon.charmander.statStages, [StatName.Speed]: 2 },
    };

    expect(getEffectiveInitiative(pokemon)).toBe(100);
  });

  it("does not apply paralysis modifier for other statuses", () => {
    const pokemon: PokemonInstance = {
      ...MockPokemon.charmander,
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 100 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    };

    expect(getEffectiveInitiative(pokemon)).toBe(100);
  });

  it("floors the result", () => {
    const pokemon: PokemonInstance = {
      ...MockPokemon.charmander,
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 65 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
    };

    expect(getEffectiveInitiative(pokemon)).toBe(32);
  });
});
