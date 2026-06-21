import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import { MockMove, MockPokemon } from "../../testing";
import type { ItemAccuracyContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

function evasionContext(self: PokemonInstance, target: PokemonInstance): ItemAccuracyContext {
  return { self, target, move: MockMove.fresh(MockMove.physical) };
}

function mon(id: string): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, { id });
}

describe("Poudre Claire (bright-powder)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.BrightPowder);

  it("Given any incoming move, When checking evasion, Then multiplier is 0.9", () => {
    expect(handler?.onEvasionModify?.(evasionContext(mon("holder"), mon("attacker")))).toBe(0.9);
  });
});

describe("Encens Doux (lax-incense)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.LaxIncense);

  it("Given any incoming move, When checking evasion, Then multiplier is 0.9", () => {
    expect(handler?.onEvasionModify?.(evasionContext(mon("holder"), mon("attacker")))).toBe(0.9);
  });
});
