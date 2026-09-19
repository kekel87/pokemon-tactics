import { createPrng } from "@pokemon-tactic/core";
import { deriveTeamSeedsBySeat } from "@pokemon-tactic/network";
import { describe, expect, it } from "vitest";
import { generateRandomTeam, generateRandomTeamSlots } from "./team-generator";

describe("tirage d'équipe aléatoire — déterminisme", () => {
  it("rend les mêmes six Pokemon pour une même graine", () => {
    const first = generateRandomTeamSlots(createPrng(4242));
    const second = generateRandomTeamSlots(createPrng(4242));

    expect(second).toEqual(first);
    expect(first).toHaveLength(6);
  });

  it("rend des équipes différentes pour des graines différentes", () => {
    const first = generateRandomTeamSlots(createPrng(1));
    const second = generateRandomTeamSlots(createPrng(2));

    expect(second.map((slot) => slot.pokemonId)).not.toEqual(first.map((slot) => slot.pokemonId));
  });

  it("n'expose ni identifiant ni horodatage dans les emplacements partagés", () => {
    const slots = generateRandomTeamSlots(createPrng(7));

    for (const slot of slots) {
      expect(slot).not.toHaveProperty("id");
      expect(slot).not.toHaveProperty("createdAt");
      expect(slot).not.toHaveProperty("updatedAt");
    }
  });

  it("garde l'identifiant de l'équipe enveloppante non déterministe", () => {
    const first = generateRandomTeam({ name: "test", rng: createPrng(7) });
    const second = generateRandomTeam({ name: "test", rng: createPrng(7) });

    expect(second.slots).toEqual(first.slots);
    expect(second.id).not.toEqual(first.id);
  });

  it("dérive la même équipe pour une place, quel que soit l'ordre des places fournies", () => {
    const seats = [1, 2, 3, 4];
    const fromA = deriveTeamSeedsBySeat(seats, createPrng(999));
    const fromB = deriveTeamSeedsBySeat([3, 1, 4, 2], createPrng(999));

    for (const seat of seats) {
      expect(fromB.get(seat)).toBe(fromA.get(seat));
      expect(generateRandomTeamSlots(createPrng(fromB.get(seat) ?? 0))).toEqual(
        generateRandomTeamSlots(createPrng(fromA.get(seat) ?? 0)),
      );
    }
  });

  it("donne des équipes DIFFÉRENTES à deux places, depuis la même graine racine", () => {
    const seeds = deriveTeamSeedsBySeat([1, 2, 3], createPrng(2026));
    const teams = [1, 2, 3].map((seat) =>
      generateRandomTeamSlots(createPrng(seeds.get(seat) ?? Number.NaN))
        .map((slot) => slot.pokemonId)
        .join(","),
    );

    expect(new Set(teams).size).toBe(3);
  });

  it("dérive des graines entières, que createPrng ne tronque pas à zéro", () => {
    for (const seed of deriveTeamSeedsBySeat([1, 2, 3], createPrng(2026)).values()) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed | 0).toBe(seed);
    }
  });

  it("décale les graines quand la liste des places est incomplète", () => {
    const complete = deriveTeamSeedsBySeat([1, 2, 3], createPrng(555));
    const partial = deriveTeamSeedsBySeat([2, 3], createPrng(555));

    expect(partial.get(2)).not.toBe(complete.get(2));
    expect(partial.get(2)).toBe(complete.get(1));
  });
});
