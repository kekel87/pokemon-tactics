import { HeldItemId } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { abilityHandlers } from "../../abilities/ability-definitions";
import { itemHandlers } from "../../items/item-definitions";
import { tacticalOverrides } from "../../overrides/tactical";
import { rosterPoc } from "../../roster/roster-poc";
import {
  isAbilityImplemented,
  isItemImplemented,
  isMoveImplemented,
  isPokemonImplemented,
} from "../implementation-flags";

describe("isPokemonImplemented", () => {
  it("returns true for roster Pokemon", () => {
    expect(isPokemonImplemented("charizard", rosterPoc)).toBe(true);
  });

  it("returns false for absent Pokemon", () => {
    expect(isPokemonImplemented("missingno", rosterPoc)).toBe(false);
  });
});

describe("isMoveImplemented", () => {
  it("returns true for implemented move", () => {
    expect(isMoveImplemented("flamethrower", tacticalOverrides)).toBe(true);
  });

  it("returns false for unimplemented move", () => {
    expect(isMoveImplemented("nonexistent-move", tacticalOverrides)).toBe(false);
  });
});

describe("isAbilityImplemented", () => {
  it("returns true for implemented ability", () => {
    expect(isAbilityImplemented("blaze", abilityHandlers)).toBe(true);
  });

  it("returns true for stub ability (chlorophyll)", () => {
    expect(isAbilityImplemented("chlorophyll", abilityHandlers)).toBe(true);
  });

  it("returns false for unimplemented ability", () => {
    expect(isAbilityImplemented("solar-power", abilityHandlers)).toBe(false);
  });
});

describe("isItemImplemented", () => {
  it("returns true for implemented item", () => {
    expect(isItemImplemented(HeldItemId.Leftovers, itemHandlers)).toBe(true);
  });
});
