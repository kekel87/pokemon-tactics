import { createPrng, validateTeamSet } from "@pokemon-tactic/core";
import { isFinalEvolutionStage } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { getOpSetsByPokemonId, getTeamBuilderRegistry } from "./team-builder-data";
import { generateRandomTeam } from "./team-generator";
import { slotFromOpSet } from "./team-helpers";

const TEAMS = Array.from({ length: 300 }, (_, index) =>
  generateRandomTeam({ name: `seed-${index + 1}`, rng: createPrng(index + 1) }),
);

describe("generateRandomTeamSlots", () => {
  it("only draws species at their final evolution stage", () => {
    for (const team of TEAMS) {
      for (const slot of team.slots) {
        expect(isFinalEvolutionStage(slot.pokemonId), `${team.name}: ${slot.pokemonId}`).toBe(true);
      }
    }
  });

  it("copies every slot from an existing build of its species", () => {
    for (const team of TEAMS) {
      for (const slot of team.slots) {
        const builds = getOpSetsByPokemonId(slot.pokemonId).map((opSet) =>
          slotFromOpSet(opSet, slot.gender),
        );
        expect(builds, `${team.name}: ${slot.pokemonId}`).toContainEqual(slot);
      }
    }
  });

  it("draws six slots that pass the team validator, without duplicate item or species family", () => {
    const registry = getTeamBuilderRegistry().validator;
    for (const team of TEAMS) {
      expect(team.slots, team.name).toHaveLength(6);
      expect(validateTeamSet(team, { registry }).errors, team.name).toEqual([]);
    }
  });
});
