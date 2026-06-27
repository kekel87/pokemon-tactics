import { describe, expect, it } from "vitest";
import { HeldItemId } from "../enums/held-item-id";
import { MockPokemon } from "../testing/mock-pokemon";
import type { PokemonInstance } from "../types/pokemon-instance";
import {
  consumeHeldItem,
  recycleConsumedItem,
  removeHeldItem,
  stealHeldItem,
  swapHeldItems,
} from "./held-item-transfer";

function mon(overrides: Partial<PokemonInstance> = {}): PokemonInstance {
  return { ...MockPokemon.base, ...overrides };
}

describe("consumeHeldItem", () => {
  it("records the consumed item and clears the slot", () => {
    const pokemon = mon({ heldItemId: HeldItemId.SitrusBerry });
    consumeHeldItem(pokemon);
    expect(pokemon.heldItemId).toBeUndefined();
    expect(pokemon.consumedItemId).toBe(HeldItemId.SitrusBerry);
  });

  it("flags ateBerryThisBattle only for berries", () => {
    const berry = mon({ heldItemId: HeldItemId.SitrusBerry });
    consumeHeldItem(berry, { isBerry: true });
    expect(berry.ateBerryThisBattle).toBe(true);

    const gem = mon({ heldItemId: HeldItemId.NormalGem });
    consumeHeldItem(gem, { isBerry: false });
    expect(gem.ateBerryThisBattle).toBeUndefined();
  });

  it("does nothing when the slot is empty", () => {
    const pokemon = mon();
    consumeHeldItem(pokemon, { isBerry: true });
    expect(pokemon.consumedItemId).toBeUndefined();
    expect(pokemon.ateBerryThisBattle).toBeUndefined();
  });
});

describe("removeHeldItem", () => {
  it("clears the slot without recording it as recyclable", () => {
    const pokemon = mon({ heldItemId: HeldItemId.ChoiceBand });
    expect(removeHeldItem(pokemon)).toBe(HeldItemId.ChoiceBand);
    expect(pokemon.heldItemId).toBeUndefined();
    expect(pokemon.consumedItemId).toBeUndefined();
  });

  it("returns undefined when empty-handed", () => {
    expect(removeHeldItem(mon())).toBeUndefined();
  });
});

describe("stealHeldItem", () => {
  it("moves the victim's item to an empty-handed thief", () => {
    const thief = mon({ id: "thief" });
    const victim = mon({ id: "victim", heldItemId: HeldItemId.Leftovers });
    expect(stealHeldItem(thief, victim)).toBe(HeldItemId.Leftovers);
    expect(thief.heldItemId).toBe(HeldItemId.Leftovers);
    expect(victim.heldItemId).toBeUndefined();
  });

  it("fails when the thief already holds an item", () => {
    const thief = mon({ id: "thief", heldItemId: HeldItemId.ChoiceBand });
    const victim = mon({ id: "victim", heldItemId: HeldItemId.Leftovers });
    expect(stealHeldItem(thief, victim)).toBeUndefined();
    expect(victim.heldItemId).toBe(HeldItemId.Leftovers);
  });

  it("fails when the victim has no item", () => {
    const thief = mon({ id: "thief" });
    const victim = mon({ id: "victim" });
    expect(stealHeldItem(thief, victim)).toBeUndefined();
  });
});

describe("swapHeldItems", () => {
  it("exchanges two held items", () => {
    const a = mon({ id: "a", heldItemId: HeldItemId.ChoiceBand });
    const b = mon({ id: "b", heldItemId: HeldItemId.Leftovers });
    swapHeldItems(a, b);
    expect(a.heldItemId).toBe(HeldItemId.Leftovers);
    expect(b.heldItemId).toBe(HeldItemId.ChoiceBand);
  });

  it("handles one empty slot", () => {
    const a = mon({ id: "a", heldItemId: HeldItemId.ChoiceBand });
    const b = mon({ id: "b" });
    swapHeldItems(a, b);
    expect(a.heldItemId).toBeUndefined();
    expect(b.heldItemId).toBe(HeldItemId.ChoiceBand);
  });
});

describe("recycleConsumedItem", () => {
  it("restores the last consumed item", () => {
    const pokemon = mon({ heldItemId: HeldItemId.SitrusBerry });
    consumeHeldItem(pokemon, { isBerry: true });
    expect(recycleConsumedItem(pokemon)).toBe(HeldItemId.SitrusBerry);
    expect(pokemon.heldItemId).toBe(HeldItemId.SitrusBerry);
    expect(pokemon.consumedItemId).toBeUndefined();
  });

  it("fails when nothing was consumed", () => {
    expect(recycleConsumedItem(mon())).toBeUndefined();
  });

  it("fails when the holder already carries an item", () => {
    const pokemon = mon({
      heldItemId: HeldItemId.ChoiceBand,
      consumedItemId: HeldItemId.SitrusBerry,
    });
    expect(recycleConsumedItem(pokemon)).toBeUndefined();
    expect(pokemon.heldItemId).toBe(HeldItemId.ChoiceBand);
  });
});
