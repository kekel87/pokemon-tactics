import { describe, expect, it } from "vitest";
import { loadData } from "./load-data";
import { deepMerge } from "./merge";

describe("loadData", () => {
  it("returns at least 4 pokemon", () => {
    const data = loadData();
    expect(data.pokemon.length).toBeGreaterThanOrEqual(4);
  });

  it("returns at least one move per pokemon slot", () => {
    const data = loadData();
    const totalMoveSlots = data.pokemon.reduce((sum, p) => sum + p.movepool.length, 0);
    expect(data.moves.length).toBeGreaterThanOrEqual(totalMoveSlots / 2);
  });

  it("each move has a targeting pattern", () => {
    const data = loadData();
    for (const move of data.moves) {
      expect(move.targeting).toBeDefined();
      expect(move.targeting.kind).toBeDefined();
    }
  });

  it("each move has at least one effect", () => {
    const data = loadData();
    for (const move of data.moves) {
      expect(move.effects.length).toBeGreaterThan(0);
    }
  });

  it("each pokemon references moves that exist", () => {
    const data = loadData();
    const moveIds = new Set(data.moves.map((m) => m.id));
    for (const pokemon of data.pokemon) {
      for (const moveId of pokemon.movepool) {
        expect(moveIds.has(moveId)).toBe(true);
      }
    }
  });

  it("all stats are positive numbers", () => {
    const data = loadData();
    for (const pokemon of data.pokemon) {
      expect(pokemon.baseStats.hp).toBeGreaterThan(0);
      expect(pokemon.baseStats.attack).toBeGreaterThan(0);
      expect(pokemon.baseStats.defense).toBeGreaterThan(0);
      expect(pokemon.baseStats.spAttack).toBeGreaterThan(0);
      expect(pokemon.baseStats.spDefense).toBeGreaterThan(0);
      expect(pokemon.baseStats.speed).toBeGreaterThan(0);
    }
  });

  it("pokemon have correct ids derived from names", () => {
    const data = loadData();
    const ids = data.pokemon.map((p) => p.id);
    expect(ids).toContain("venusaur");
    expect(ids).toContain("charizard");
    expect(ids).toContain("blastoise");
    expect(ids).toContain("raichu");
    expect(ids).toContain("alakazam");
    expect(ids).toContain("machamp");
    expect(ids).toContain("gyarados");
    expect(ids).toContain("snorlax");
    expect(ids).toContain("dragonite");
    expect(ids).toContain("vaporeon");
    expect(ids).toContain("flareon");
    expect(ids).toContain("jolteon");
  });
});

describe("deepMerge", () => {
  it("merges nested objects", () => {
    const base = { a: 1, nested: { b: 2, c: 3 } };
    const override = { nested: { c: 99 } };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, nested: { b: 2, c: 99 } });
  });

  it("does not clobber base properties not in override", () => {
    const base = { a: 1, b: 2 };
    const override = { b: 99 };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, b: 99 });
  });

  it("replaces arrays instead of concatenating", () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [99] };
    const result = deepMerge(base, override);
    expect(result.items).toEqual([99]);
  });

  it("handles multiple override layers", () => {
    const base = { a: 1, b: 2 };
    const result = deepMerge(base, { a: 10 }, { b: 20 });
    expect(result).toEqual({ a: 10, b: 20 });
  });
});
