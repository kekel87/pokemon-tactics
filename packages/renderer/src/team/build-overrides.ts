import type {
  HeldItemId,
  Nature,
  PokemonGender,
  StatSpread,
  TeamSelection,
} from "@pokemon-tactic/core";

export interface TeamOverrides {
  genderOverrides: Record<string, PokemonGender>;
  natureOverrides: Record<string, Nature>;
  heldItemOverrides: Record<string, HeldItemId>;
  statSpreadOverrides: Record<string, StatSpread>;
  moveOverrides: Record<string, readonly string[]>;
  abilityOverrides: Record<string, string>;
}

export function buildTeamOverrides(input: { teams: TeamSelection[] }): TeamOverrides {
  const overrides: TeamOverrides = {
    genderOverrides: {},
    natureOverrides: {},
    heldItemOverrides: {},
    statSpreadOverrides: {},
    moveOverrides: {},
    abilityOverrides: {},
  };
  for (let i = 0; i < input.teams.length; i++) {
    const selection = input.teams[i];
    if (!selection || !selection.slots) {
      continue;
    }
    const playerPrefix = `p${i + 1}-`;
    for (const slot of selection.slots) {
      const instanceId = `${playerPrefix}${slot.pokemonId}`;
      if (slot.gender !== undefined) {
        overrides.genderOverrides[instanceId] = slot.gender;
      }
      overrides.natureOverrides[instanceId] = slot.nature;
      if (slot.heldItemId !== undefined) {
        overrides.heldItemOverrides[instanceId] = slot.heldItemId;
      }
      overrides.statSpreadOverrides[instanceId] = slot.statSpread;
      if (slot.moveIds.length > 0) {
        overrides.moveOverrides[instanceId] = [...slot.moveIds];
      }
      if (slot.ability) {
        overrides.abilityOverrides[instanceId] = slot.ability;
      }
    }
  }
  return overrides;
}
