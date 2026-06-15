import type { TeamSet, TeamSlot } from "@pokemon-tactic/core";
import { resolveSlotGender } from "./gender-helpers";
import { getOpSetsByPokemonId, getPlayablePokemon } from "./team-builder-data";
import { defaultSlot, generateTeamId } from "./team-helpers";

export interface RandomGeneratorOptions {
  name: string;
  rng?: () => number;
}

function pickWithoutReplacement<T>(items: readonly T[], count: number, rng: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const picked = pool[idx];
    if (picked === undefined) {
      continue;
    }
    out.push(picked);
    pool.splice(idx, 1);
  }
  return out;
}

function applyOpSetIfAvailable(
  pokemonId: string,
  fallbackAbility: string,
  rng: () => number,
): TeamSlot {
  const opSets = getOpSetsByPokemonId(pokemonId);
  const set = opSets[0];
  const slot: TeamSlot =
    set === undefined
      ? defaultSlot(pokemonId, fallbackAbility)
      : {
          pokemonId,
          ability: set.ability,
          nature: set.nature,
          moveIds: [...set.moveIds].slice(0, 4),
          statSpread: { ...set.statSpread },
          ...(set.heldItemId === null ? {} : { heldItemId: set.heldItemId }),
        };
  const gender = resolveSlotGender(pokemonId, undefined, rng);
  if (gender !== undefined) {
    slot.gender = gender;
  }
  return slot;
}

export function generateRandomTeam(options: RandomGeneratorOptions): TeamSet {
  const rng = options.rng ?? Math.random;
  const playable = getPlayablePokemon();
  const picked = pickWithoutReplacement(playable, 6, rng);
  const now = Date.now();
  const slots: TeamSlot[] = picked.map((p) => {
    const fallbackAbility = p.abilities.primary ?? p.definition.abilityId ?? "";
    return applyOpSetIfAvailable(p.id, fallbackAbility, rng);
  });
  return {
    id: generateTeamId(),
    name: options.name,
    slots,
    createdAt: now,
    updatedAt: now,
  };
}
