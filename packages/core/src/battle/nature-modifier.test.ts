import { describe, expect, it } from "vitest";
import { Nature } from "../enums/nature";
import type { BaseStats } from "../types/base-stats";
import {
  applyNatureModifier,
  NATURE_BOOST_MULTIPLIER,
  NATURE_LOWER_MULTIPLIER,
} from "./nature-modifier";

const SAMPLE: BaseStats = {
  hp: 100,
  attack: 100,
  defense: 100,
  spAttack: 100,
  spDefense: 100,
  speed: 100,
};

describe("applyNatureModifier", () => {
  it("returns stats unchanged for the 5 neutral natures", () => {
    for (const neutral of [
      Nature.Hardy,
      Nature.Docile,
      Nature.Serious,
      Nature.Bashful,
      Nature.Quirky,
    ]) {
      expect(applyNatureModifier(SAMPLE, neutral)).toEqual(SAMPLE);
    }
  });

  it("boosts Atk and lowers SpAtk for Adamant", () => {
    const result = applyNatureModifier(SAMPLE, Nature.Adamant);
    expect(result.attack).toBe(Math.floor(100 * NATURE_BOOST_MULTIPLIER));
    expect(result.spAttack).toBe(Math.floor(100 * NATURE_LOWER_MULTIPLIER));
  });

  it("boosts SpAtk and lowers Atk for Modest", () => {
    const result = applyNatureModifier(SAMPLE, Nature.Modest);
    expect(result.spAttack).toBe(Math.floor(100 * NATURE_BOOST_MULTIPLIER));
    expect(result.attack).toBe(Math.floor(100 * NATURE_LOWER_MULTIPLIER));
  });

  it("boosts Speed and lowers SpAtk for Jolly", () => {
    const result = applyNatureModifier(SAMPLE, Nature.Jolly);
    expect(result.speed).toBe(Math.floor(100 * NATURE_BOOST_MULTIPLIER));
    expect(result.spAttack).toBe(Math.floor(100 * NATURE_LOWER_MULTIPLIER));
  });

  it("boosts Def and lowers Atk for Bold", () => {
    const result = applyNatureModifier(SAMPLE, Nature.Bold);
    expect(result.defense).toBe(Math.floor(100 * NATURE_BOOST_MULTIPLIER));
    expect(result.attack).toBe(Math.floor(100 * NATURE_LOWER_MULTIPLIER));
  });

  it("boosts SpDef and lowers Speed for Sassy", () => {
    const result = applyNatureModifier(SAMPLE, Nature.Sassy);
    expect(result.spDefense).toBe(Math.floor(100 * NATURE_BOOST_MULTIPLIER));
    expect(result.speed).toBe(Math.floor(100 * NATURE_LOWER_MULTIPLIER));
  });

  it("never modifies HP", () => {
    for (const nature of [
      Nature.Adamant,
      Nature.Bold,
      Nature.Modest,
      Nature.Timid,
      Nature.Calm,
      Nature.Hardy,
    ]) {
      expect(applyNatureModifier(SAMPLE, nature).hp).toBe(SAMPLE.hp);
    }
  });

  it("does not mutate input", () => {
    const input: BaseStats = { ...SAMPLE };
    applyNatureModifier(input, Nature.Adamant);
    expect(input).toEqual(SAMPLE);
  });

  it("matches Garchomp Atk reference (135 leveled, Adamant)", () => {
    const leveled: BaseStats = {
      hp: 183,
      attack: 135,
      defense: 115,
      spAttack: 100,
      spDefense: 105,
      speed: 122,
    };
    const result = applyNatureModifier(leveled, Nature.Adamant);
    expect(result.attack).toBe(148);
    expect(result.spAttack).toBe(90);
  });

  it("leaves untouched stats unchanged for boost natures", () => {
    const result = applyNatureModifier(SAMPLE, Nature.Adamant);
    expect(result.defense).toBe(SAMPLE.defense);
    expect(result.spDefense).toBe(SAMPLE.spDefense);
    expect(result.speed).toBe(SAMPLE.speed);
  });
});
