import { type TeamSlot, validateSlot } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { playablePokemon } from "../playable/playable-pokemon";
import { buildTeamBuilderRegistry } from "../team/team-builder-registry";
import { getAllOpSets } from "./load-op-sets";

describe("builds of playable species", () => {
  it("all turn into a legal team slot", () => {
    const validator = buildTeamBuilderRegistry().validator;
    const playableIds = new Set(playablePokemon.map((entry) => entry.id));
    const playableOpSets = getAllOpSets().filter((opSet) => playableIds.has(opSet.pokemonId));

    const illegalOpSetIds = playableOpSets
      .filter((opSet) => {
        const slot: TeamSlot = {
          pokemonId: opSet.pokemonId,
          ability: opSet.ability,
          nature: opSet.nature,
          moveIds: opSet.moveIds,
          statSpread: opSet.statSpread,
          ...(opSet.heldItemId === null ? {} : { heldItemId: opSet.heldItemId }),
          ...(opSet.gender === null ? {} : { gender: opSet.gender }),
        };
        return validateSlot(slot, 0, validator).length > 0;
      })
      .map((opSet) => opSet.id);

    expect(playableOpSets.length).toBeGreaterThan(0);
    expect(illegalOpSetIds).toEqual([]);
  });
});
