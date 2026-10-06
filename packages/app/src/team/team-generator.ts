import type { TeamSet, TeamSlot } from "@pokemon-tactic/core";
import { isFinalEvolutionStage, type OpSet } from "@pokemon-tactic/data";
import {
  getOpSetsByPokemonId,
  getPlayablePokemon,
  getTeamBuilderRegistry,
} from "./team-builder-data";
import { generateTeamId, slotFromOpSet } from "./team-helpers";

export interface RandomGeneratorOptions {
  name: string;
  rng?: () => number;
}

const RANDOM_TEAM_SIZE = 6;

let randomTeamPoolCache: readonly (readonly OpSet[])[] | null = null;

/**
 * Le vivier du tirage aléatoire (plan 232) : les builds de chaque Pokemon jouable à son dernier stade
 * qui en a au moins un. Tout se déduit des données — une espèce qui gagne un build, ou une génération
 * ajoutée, y entre sans toucher ici.
 *
 * ⚠️ Changer ce vivier (code ou données) change l'équipe tirée depuis une graine : `NETWORK_VERSION`.
 */
function randomTeamPool(): readonly (readonly OpSet[])[] {
  randomTeamPoolCache ??= getPlayablePokemon().flatMap((pokemon) => {
    const opSets = getOpSetsByPokemonId(pokemon.id);
    return isFinalEvolutionStage(pokemon.id) && opSets.length > 0 ? [opSets] : [];
  });
  return randomTeamPoolCache;
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
  const remaining = [...randomTeamPool()];
  const { getSpeciesRoot } = getTeamBuilderRegistry().validator;
  const usedSpeciesRoots = new Set<string>();
  const usedItemIds = new Set<string>();
  const slots: TeamSlot[] = [];
  /*
   * Une équipe tirée obéit aux mêmes règles qu'une équipe composée à la main (`validateTeamSet`) :
   * une espèce par famille (Aquali et Pyroli s'excluent), un objet une seule fois. Un Pokemon dont la
   * famille est prise est écarté ; sinon on garde son premier build à objet libre, et s'il n'en a
   * aucun, on l'écarte aussi.
   */
  while (slots.length < RANDOM_TEAM_SIZE && remaining.length > 0) {
    const [opSets] = remaining.splice(Math.floor(rng() * remaining.length), 1);
    const opSet = opSets?.find(
      (candidate) => candidate.heldItemId === null || !usedItemIds.has(candidate.heldItemId),
    );
    if (opSet === undefined) {
      continue;
    }
    const speciesRoot = getSpeciesRoot(opSet.pokemonId);
    if (usedSpeciesRoots.has(speciesRoot)) {
      continue;
    }
    usedSpeciesRoots.add(speciesRoot);
    if (opSet.heldItemId !== null) {
      usedItemIds.add(opSet.heldItemId);
    }
    slots.push(slotFromOpSet(opSet, undefined, rng));
  }
  return slots;
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
