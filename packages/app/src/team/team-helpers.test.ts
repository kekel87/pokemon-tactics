import { PokemonGender } from "@pokemon-tactic/core";
import type { OpSet } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { getAllOpSetsRaw } from "./team-builder-data";
import { slotFromOpSet } from "./team-helpers";

function opSetById(id: string): OpSet {
  const opSet = getAllOpSetsRaw().find((candidate) => candidate.id === id);
  if (opSet === undefined) {
    throw new Error(`unknown build ${id}`);
  }
  return opSet;
}

const snorlaxAttractWall = opSetById("snorlax-attract-wall");
const venusaurChlorophyllSweeper = opSetById("venusaur-chlorophyll-sweeper");
const butterfreeQuiverDance = opSetById("butterfree-quiver-dance");

describe("slotFromOpSet", () => {
  it("copies the build of Florizarre without sharing its stat spread", () => {
    const slot = slotFromOpSet(venusaurChlorophyllSweeper, undefined);

    expect(slot).toMatchObject({
      pokemonId: "venusaur",
      ability: venusaurChlorophyllSweeper.ability,
      nature: venusaurChlorophyllSweeper.nature,
      heldItemId: venusaurChlorophyllSweeper.heldItemId,
      moveIds: venusaurChlorophyllSweeper.moveIds,
      statSpread: venusaurChlorophyllSweeper.statSpread,
    });
    expect(slot.statSpread).not.toBe(venusaurChlorophyllSweeper.statSpread);
  });

  it("omits the held item when the build has none", () => {
    const slot = slotFromOpSet({ ...venusaurChlorophyllSweeper, heldItemId: null }, undefined);

    expect(slot).not.toHaveProperty("heldItemId");
  });

  it.each([
    ["the current gender over the build", PokemonGender.Female, PokemonGender.Female],
    ["the gender of the build of Ronflex when none is chosen", undefined, PokemonGender.Male],
  ])("keeps %s", (_label, currentGender, expected) => {
    expect(slotFromOpSet(snorlaxAttractWall, currentGender).gender).toBe(expected);
  });

  it.each([
    [0.4, PokemonGender.Male],
    [0.9, PokemonGender.Female],
  ])(
    "draws the gender of Papilusion with rng %s when neither slot nor build sets it",
    (roll, expected) => {
      expect(slotFromOpSet(butterfreeQuiverDance, undefined, () => roll).gender).toBe(expected);
    },
  );
});
