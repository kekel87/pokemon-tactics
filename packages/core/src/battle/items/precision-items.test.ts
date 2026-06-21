import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import { MockMove, MockPokemon } from "../../testing";
import type { ItemAccuracyContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

function accuracyContext(self: PokemonInstance, target: PokemonInstance): ItemAccuracyContext {
  return { self, target, move: MockMove.fresh(MockMove.physical) };
}

function mon(id: string, lastActedAtAction?: number): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, { id, lastActedAtAction });
}

describe("Loupe (wide-lens)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.WideLens);

  it("Given any move, When checking accuracy, Then multiplier is 1.1", () => {
    expect(handler?.onAccuracyModify?.(accuracyContext(mon("self"), mon("target")))).toBe(1.1);
  });
});

describe("Lentille Zoom (zoom-lens)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.ZoomLens);

  it("Given the holder acts after the target, When checking accuracy, Then multiplier is 1.2", () => {
    expect(handler?.onAccuracyModify?.(accuracyContext(mon("self", 1), mon("target", 2)))).toBe(
      1.2,
    );
  });

  it("Given the holder acts before the target, When checking accuracy, Then multiplier is 1.0", () => {
    expect(handler?.onAccuracyModify?.(accuracyContext(mon("self", 3), mon("target", 2)))).toBe(
      1.0,
    );
  });

  it("Given neither has acted yet, When checking accuracy, Then multiplier is 1.0", () => {
    expect(handler?.onAccuracyModify?.(accuracyContext(mon("self"), mon("target")))).toBe(1.0);
  });
});
