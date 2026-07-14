import { describe, expect, it } from "vitest";
import { HeldItemId } from "../enums/held-item-id";
import { MockPokemon } from "../testing";
import { effectiveWeight } from "./effective-weight";

describe("effectiveWeight", () => {
  it("returns the species weight without a Pierrallégée", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, { weight: 10 });
    expect(effectiveWeight(mon)).toBe(10);
  });

  it("halves the weight for a Pierrallégée (float-stone) holder", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, {
      weight: 10,
      heldItemId: HeldItemId.FloatStone,
    });
    expect(effectiveWeight(mon)).toBe(5);
  });
});
