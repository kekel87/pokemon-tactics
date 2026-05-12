import { describe, expect, it } from "vitest";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { TerrainType } from "../enums/terrain-type";
import {
  getMovementPenalty,
  getTerrainDotFraction,
  getTerrainStatusOnStop,
  getTerrainTypeBonusFactor,
  isTerrainImmune,
} from "./terrain-effects";

describe("isTerrainImmune", () => {
  it("Flying is immune to all terrain effects", () => {
    expect(isTerrainImmune(TerrainType.Water, [PokemonType.Flying])).toBe(true);
    expect(isTerrainImmune(TerrainType.Magma, [PokemonType.Flying])).toBe(true);
    expect(isTerrainImmune(TerrainType.Ice, [PokemonType.Flying])).toBe(true);
    expect(isTerrainImmune(TerrainType.Sand, [PokemonType.Flying])).toBe(true);
    expect(isTerrainImmune(TerrainType.Snow, [PokemonType.Flying])).toBe(true);
    expect(isTerrainImmune(TerrainType.Swamp, [PokemonType.Flying])).toBe(true);
    expect(isTerrainImmune(TerrainType.TallGrass, [PokemonType.Flying])).toBe(true);
  });

  it("type-specific immunities apply per terrain", () => {
    expect(isTerrainImmune(TerrainType.Water, [PokemonType.Water])).toBe(true);
    expect(isTerrainImmune(TerrainType.DeepWater, [PokemonType.Water])).toBe(true);
    expect(isTerrainImmune(TerrainType.Magma, [PokemonType.Fire])).toBe(true);
    expect(isTerrainImmune(TerrainType.Lava, [PokemonType.Fire])).toBe(true);
    expect(isTerrainImmune(TerrainType.Ice, [PokemonType.Ice])).toBe(true);
    expect(isTerrainImmune(TerrainType.Sand, [PokemonType.Ground])).toBe(true);
    expect(isTerrainImmune(TerrainType.Snow, [PokemonType.Ice])).toBe(true);
    expect(isTerrainImmune(TerrainType.Swamp, [PokemonType.Poison])).toBe(true);
  });

  it("Normal terrain has no immunity", () => {
    expect(isTerrainImmune(TerrainType.Normal, [PokemonType.Normal])).toBe(false);
    expect(isTerrainImmune(TerrainType.Normal, [PokemonType.Flying])).toBe(false);
  });

  it("wrong type gets no immunity", () => {
    expect(isTerrainImmune(TerrainType.Water, [PokemonType.Fire])).toBe(false);
    expect(isTerrainImmune(TerrainType.Magma, [PokemonType.Water])).toBe(false);
  });
});

describe("getMovementPenalty", () => {
  it("water/sand/snow cost +1", () => {
    expect(getMovementPenalty(TerrainType.Water, [PokemonType.Normal])).toBe(1);
    expect(getMovementPenalty(TerrainType.Sand, [PokemonType.Normal])).toBe(1);
    expect(getMovementPenalty(TerrainType.Snow, [PokemonType.Normal])).toBe(1);
  });

  it("swamp costs +2", () => {
    expect(getMovementPenalty(TerrainType.Swamp, [PokemonType.Normal])).toBe(2);
  });

  it("normal/tall_grass/ice/magma have no penalty", () => {
    expect(getMovementPenalty(TerrainType.Normal, [PokemonType.Normal])).toBe(0);
    expect(getMovementPenalty(TerrainType.TallGrass, [PokemonType.Normal])).toBe(0);
    expect(getMovementPenalty(TerrainType.Ice, [PokemonType.Normal])).toBe(0);
    expect(getMovementPenalty(TerrainType.Magma, [PokemonType.Normal])).toBe(0);
  });

  it("immune types get no penalty", () => {
    expect(getMovementPenalty(TerrainType.Water, [PokemonType.Water])).toBe(0);
    expect(getMovementPenalty(TerrainType.Sand, [PokemonType.Ground])).toBe(0);
    expect(getMovementPenalty(TerrainType.Snow, [PokemonType.Ice])).toBe(0);
    expect(getMovementPenalty(TerrainType.Swamp, [PokemonType.Poison])).toBe(0);
    expect(getMovementPenalty(TerrainType.Water, [PokemonType.Flying])).toBe(0);
    expect(getMovementPenalty(TerrainType.Swamp, [PokemonType.Flying])).toBe(0);
  });
});

describe("getTerrainTypeBonusFactor", () => {
  it("returns 1.15 for matching type/terrain", () => {
    expect(
      getTerrainTypeBonusFactor(TerrainType.Water, PokemonType.Water, [PokemonType.Normal]),
    ).toBe(1.15);
    expect(
      getTerrainTypeBonusFactor(TerrainType.DeepWater, PokemonType.Water, [PokemonType.Normal]),
    ).toBe(1.15);
    expect(
      getTerrainTypeBonusFactor(TerrainType.Magma, PokemonType.Fire, [PokemonType.Normal]),
    ).toBe(1.15);
    expect(
      getTerrainTypeBonusFactor(TerrainType.Lava, PokemonType.Fire, [PokemonType.Normal]),
    ).toBe(1.15);
    expect(getTerrainTypeBonusFactor(TerrainType.Ice, PokemonType.Ice, [PokemonType.Normal])).toBe(
      1.15,
    );
    expect(
      getTerrainTypeBonusFactor(TerrainType.Sand, PokemonType.Ground, [PokemonType.Normal]),
    ).toBe(1.15);
    expect(getTerrainTypeBonusFactor(TerrainType.Snow, PokemonType.Ice, [PokemonType.Normal])).toBe(
      1.15,
    );
    expect(
      getTerrainTypeBonusFactor(TerrainType.Swamp, PokemonType.Poison, [PokemonType.Normal]),
    ).toBe(1.15);
  });

  it("returns 1.0 for non-matching move type", () => {
    expect(
      getTerrainTypeBonusFactor(TerrainType.Water, PokemonType.Fire, [PokemonType.Normal]),
    ).toBe(1.0);
    expect(
      getTerrainTypeBonusFactor(TerrainType.Magma, PokemonType.Water, [PokemonType.Normal]),
    ).toBe(1.0);
  });

  it("returns 1.0 for normal terrain", () => {
    expect(
      getTerrainTypeBonusFactor(TerrainType.Normal, PokemonType.Normal, [PokemonType.Normal]),
    ).toBe(1.0);
  });

  it("immune attacker gets no bonus", () => {
    expect(
      getTerrainTypeBonusFactor(TerrainType.Magma, PokemonType.Fire, [PokemonType.Flying]),
    ).toBe(1.0);
    expect(getTerrainTypeBonusFactor(TerrainType.Magma, PokemonType.Fire, [PokemonType.Fire])).toBe(
      1.0,
    );
  });
});

describe("getTerrainStatusOnStop", () => {
  it("magma applies Burned to non-immune", () => {
    expect(getTerrainStatusOnStop(TerrainType.Magma, [PokemonType.Normal])).toBe(StatusType.Burned);
    expect(getTerrainStatusOnStop(TerrainType.Magma, [PokemonType.Water])).toBe(StatusType.Burned);
  });

  it("swamp applies Poisoned to non-immune", () => {
    expect(getTerrainStatusOnStop(TerrainType.Swamp, [PokemonType.Normal])).toBe(
      StatusType.Poisoned,
    );
    expect(getTerrainStatusOnStop(TerrainType.Swamp, [PokemonType.Water])).toBe(
      StatusType.Poisoned,
    );
  });

  it("immune types get no status", () => {
    expect(getTerrainStatusOnStop(TerrainType.Magma, [PokemonType.Fire])).toBeNull();
    expect(getTerrainStatusOnStop(TerrainType.Magma, [PokemonType.Flying])).toBeNull();
    expect(getTerrainStatusOnStop(TerrainType.Swamp, [PokemonType.Poison])).toBeNull();
    expect(getTerrainStatusOnStop(TerrainType.Swamp, [PokemonType.Flying])).toBeNull();
  });

  it("other terrains return null", () => {
    expect(getTerrainStatusOnStop(TerrainType.Normal, [PokemonType.Normal])).toBeNull();
    expect(getTerrainStatusOnStop(TerrainType.Water, [PokemonType.Normal])).toBeNull();
    expect(getTerrainStatusOnStop(TerrainType.Ice, [PokemonType.Normal])).toBeNull();
  });
});

describe("getTerrainDotFraction", () => {
  it("magma deals 1/16 HP per turn", () => {
    expect(getTerrainDotFraction(TerrainType.Magma)).toBe(16);
  });

  it("other terrains deal no direct damage", () => {
    expect(getTerrainDotFraction(TerrainType.Normal)).toBeNull();
    expect(getTerrainDotFraction(TerrainType.Water)).toBeNull();
    expect(getTerrainDotFraction(TerrainType.Swamp)).toBeNull();
    expect(getTerrainDotFraction(TerrainType.Ice)).toBeNull();
  });

  it("Lava and DeepWater deal OHKO damage (fraction=1)", () => {
    expect(getTerrainDotFraction(TerrainType.Lava)).toBe(1);
    expect(getTerrainDotFraction(TerrainType.DeepWater)).toBe(1);
  });
});
