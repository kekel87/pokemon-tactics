import { describe, expect, it } from "vitest";
import { MockPokemon } from "../testing";
import { effectiveAbilityId } from "./effective-ability";

describe("effectiveAbilityId", () => {
  it("returns the species ability when nothing is overridden", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.bulbasaur, { abilityId: "overgrow" });
    expect(effectiveAbilityId(pokemon)).toBe("overgrow");
  });

  it("returns the override when set", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.bulbasaur, {
      abilityId: "overgrow",
      abilityIdOverride: "insomnia",
    });
    expect(effectiveAbilityId(pokemon)).toBe("insomnia");
  });

  it("returns undefined when suppressed, even with an override", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.bulbasaur, {
      abilityId: "overgrow",
      abilityIdOverride: "insomnia",
      abilitySuppressed: true,
    });
    expect(effectiveAbilityId(pokemon)).toBeUndefined();
  });

  it("returns undefined when the species has no ability and none is overridden", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.bulbasaur, { abilityId: undefined });
    expect(effectiveAbilityId(pokemon)).toBeUndefined();
  });
});
