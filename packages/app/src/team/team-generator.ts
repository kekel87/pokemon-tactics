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

/**
 * Les six emplacements d'une équipe aléatoire, et **rien d'autre** (plan 216, bug 2).
 *
 * 🔴 **Séparé de `generateRandomTeam` pour une raison de déterminisme, pas d'élégance.** Une
 * `TeamSet` porte `id` (tiré au hasard) et `createdAt` (`Date.now()`), tous deux **non
 * déterministes**. Depuis que le tirage aléatoire est différé au lancement et rejoué à l'identique
 * par chaque pair, ces deux champs ne doivent jamais atteindre le `BattleState` : la somme de
 * contrôle du Lot B4 sérialise TOUT l'état, donc deux pairs divergeraient à la première
 * vérification — et le vote de minorité éliminerait un joueur honnête, pour un horodatage.
 *
 * Ce qui doit être partagé se dérive de la graine ; l'identité et l'horodatage restent locaux.
 */
export function generateRandomTeamSlots(rng: () => number): TeamSlot[] {
  return pickWithoutReplacement(getPlayablePokemon(), 6, rng).map((pokemon) =>
    applyOpSetIfAvailable(
      pokemon.id,
      pokemon.abilities.primary ?? pokemon.definition.abilityId ?? "",
      rng,
    ),
  );
}

export function generateRandomTeam(options: RandomGeneratorOptions): TeamSet {
  const rng = options.rng ?? Math.random;
  const now = Date.now();
  const slots = generateRandomTeamSlots(rng);
  return {
    id: generateTeamId(),
    name: options.name,
    slots,
    createdAt: now,
    updatedAt: now,
  };
}
