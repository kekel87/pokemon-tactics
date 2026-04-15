import { describe, expect, it } from "vitest";
import { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { isImmuneToStatusByType } from "./handle-status";

describe("isImmuneToStatusByType", () => {
  it("returns true for Poison-type against Poisoned", () => {
    expect(isImmuneToStatusByType([PokemonType.Poison], StatusType.Poisoned)).toBe(true);
  });

  it("returns true for Steel-type against Poisoned", () => {
    expect(isImmuneToStatusByType([PokemonType.Steel], StatusType.Poisoned)).toBe(true);
  });

  it("returns true for Poison-type against BadlyPoisoned", () => {
    expect(isImmuneToStatusByType([PokemonType.Poison], StatusType.BadlyPoisoned)).toBe(true);
  });

  it("returns true for Steel-type against BadlyPoisoned", () => {
    expect(isImmuneToStatusByType([PokemonType.Steel], StatusType.BadlyPoisoned)).toBe(true);
  });

  it("returns true for Electric-type against Paralyzed", () => {
    expect(isImmuneToStatusByType([PokemonType.Electric], StatusType.Paralyzed)).toBe(true);
  });

  it("returns true for Fire-type against Burned", () => {
    expect(isImmuneToStatusByType([PokemonType.Fire], StatusType.Burned)).toBe(true);
  });

  it("returns true for Ice-type against Frozen", () => {
    expect(isImmuneToStatusByType([PokemonType.Ice], StatusType.Frozen)).toBe(true);
  });

  it("returns true for dual-type when one type grants immunity", () => {
    expect(
      isImmuneToStatusByType([PokemonType.Ghost, PokemonType.Poison], StatusType.Poisoned),
    ).toBe(true);
  });

  it("returns false for non-immune type against Poisoned", () => {
    expect(isImmuneToStatusByType([PokemonType.Grass], StatusType.Poisoned)).toBe(false);
  });

  it("returns false for Fire-type against Poisoned", () => {
    expect(isImmuneToStatusByType([PokemonType.Fire], StatusType.Poisoned)).toBe(false);
  });

  it("returns false for Normal-type against any status", () => {
    expect(isImmuneToStatusByType([PokemonType.Normal], StatusType.Burned)).toBe(false);
    expect(isImmuneToStatusByType([PokemonType.Normal], StatusType.Paralyzed)).toBe(false);
    expect(isImmuneToStatusByType([PokemonType.Normal], StatusType.Frozen)).toBe(false);
  });

  it("returns false for Asleep against any type (sleep has no type immunity)", () => {
    expect(isImmuneToStatusByType([PokemonType.Poison], StatusType.Asleep)).toBe(false);
    expect(isImmuneToStatusByType([PokemonType.Steel], StatusType.Asleep)).toBe(false);
  });

  it("returns false for volatile statuses (Confused, Seeded, Trapped)", () => {
    expect(isImmuneToStatusByType([PokemonType.Poison], StatusType.Confused)).toBe(false);
    expect(isImmuneToStatusByType([PokemonType.Grass], StatusType.Seeded)).toBe(false);
    expect(isImmuneToStatusByType([PokemonType.Electric], StatusType.Trapped)).toBe(false);
  });

  it("returns false for empty type list", () => {
    expect(isImmuneToStatusByType([], StatusType.Poisoned)).toBe(false);
  });
});
