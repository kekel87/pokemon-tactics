import { describe, expect, it } from "vitest";
import { HeldItemId } from "../enums/held-item-id";
import { MockPokemon } from "../testing";
import { effectiveBaseSpeed } from "./effective-base-speed";

describe("effectiveBaseSpeed", () => {
  it("returns the species base Speed by default", () => {
    expect(effectiveBaseSpeed(MockPokemon.fresh(MockPokemon.base))).toBe(50);
  });

  it("doubles the base Speed for an untransformed Métamorph holding Poudre Vite", () => {
    const ditto = MockPokemon.fresh(MockPokemon.base, {
      definitionId: "ditto",
      heldItemId: HeldItemId.QuickPowder,
    });
    expect(effectiveBaseSpeed(ditto)).toBe(100);
  });

  it("does not boost a non-Métamorph holding Poudre Vite", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, { heldItemId: HeldItemId.QuickPowder });
    expect(effectiveBaseSpeed(mon)).toBe(50);
  });
});
