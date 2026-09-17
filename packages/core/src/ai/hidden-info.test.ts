import { describe, expect, it } from "vitest";
import { MockPokemon } from "../testing/mock-pokemon";
import { HARD_PROFILE, MEDIUM_PROFILE } from "./ai-profiles";
import { knownAbilityId, knownHeldItemId } from "./hidden-info";

const SEEING = HARD_PROFILE.capabilities;
const BLINDED = MEDIUM_PROFILE.capabilities;

describe("knownHeldItemId", () => {
  it("hands the item to a palier that sees through the fog", () => {
    const target = MockPokemon.fresh(MockPokemon.base, { heldItemId: "leftovers" });

    expect(knownHeldItemId(target, SEEING)).toBe("leftovers");
  });

  it("withholds an unrevealed item from a blinded palier", () => {
    const target = MockPokemon.fresh(MockPokemon.base, { heldItemId: "leftovers" });

    expect(knownHeldItemId(target, BLINDED)).toBeUndefined();
  });

  it("hands over the same item once it has been revealed", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: "leftovers",
      revealedItem: true,
    });

    expect(knownHeldItemId(target, BLINDED)).toBe("leftovers");
  });

  it("reports nothing for a target holding nothing, whatever the palier", () => {
    const target = MockPokemon.fresh(MockPokemon.base);

    expect(knownHeldItemId(target, SEEING)).toBeUndefined();
    expect(knownHeldItemId(target, BLINDED)).toBeUndefined();
  });
});

describe("knownAbilityId", () => {
  it("hands the ability to a palier that sees through the fog", () => {
    const target = MockPokemon.fresh(MockPokemon.base, { abilityId: "levitate" });

    expect(knownAbilityId(target, SEEING)).toBe("levitate");
  });

  it("withholds an unrevealed ability from a blinded palier", () => {
    const target = MockPokemon.fresh(MockPokemon.base, { abilityId: "levitate" });

    expect(knownAbilityId(target, BLINDED)).toBeUndefined();
  });

  it("hands over the same ability once it has been revealed", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      abilityId: "levitate",
      revealedAbility: true,
    });

    expect(knownAbilityId(target, BLINDED)).toBe("levitate");
  });
});
