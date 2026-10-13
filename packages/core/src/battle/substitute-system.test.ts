import { describe, expect, it } from "vitest";
import { MockPokemon } from "../testing";
import { hasSubstitute } from "./substitute-system";

describe("hasSubstitute", () => {
  it("is false for a Pokemon that never posted a Clonage", () => {
    const mon = MockPokemon.fresh(MockPokemon.base);
    expect(hasSubstitute(mon)).toBe(false);
  });

  it("is true while the Clonage doll has HP left", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, { substituteHp: 12 });
    expect(hasSubstitute(mon)).toBe(true);
  });

  it("is false once the doll is down to 0 HP", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, { substituteHp: 0 });
    expect(hasSubstitute(mon)).toBe(false);
  });
});
