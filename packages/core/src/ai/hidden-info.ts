import { effectiveAbilityId } from "../battle/effective-ability";
import type { AiCapabilities } from "../types/ai-capabilities";
import type { PokemonInstance } from "../types/pokemon-instance";

/*
 * Ce que l'IA a le droit de SAVOIR d'un adversaire (plan 214, tranche « information cachée »).
 *
 * 🔴 **L'asymétrie existait déjà, et à l'envers de ce qu'on croyait.** Le brouillard (plan 176) cache au
 * JOUEUR l'objet tenu et le talent d'un ennemi jusqu'à ce qu'il les voie agir — `revealedItem` /
 * `revealedAbility`. L'IA, elle, lisait `heldItemId` et le talent effectif directement dans l'état,
 * sans rien demander à personne. Le levier de difficulté n'est donc pas de RENSEIGNER Difficile, c'est
 * d'AVEUGLER les paliers bas : leur faire jouer la même partie que le joueur humain, avec les mêmes
 * points d'interrogation.
 *
 * Patron repris de Freeciv, dont les IA basses tournent sous `H_FOG` / `H_MAP` : elles ne trichent pas
 * moins bien, elles voient littéralement moins de carte.
 *
 * ⚠️ **Ne concerne que les ADVERSAIRES.** Une IA connaît évidemment l'équipement de sa propre équipe ;
 * ces fonctions ne sont appelées que sur des cibles ennemies, comme le brouillard lui-même qui ne
 * masque jamais un allié.
 *
 * ⚠️ **Les PV exacts sont volontairement HORS de cette tranche**, bien que le brouillard les remplace
 * par un pourcentage. La prévisualisation des dégâts (plan 198) affiche au joueur le verdict « K.O. »
 * sur la cible visée : il SAIT donc si son coup tue, sans connaître le nombre. Aveugler l'IA sur ce
 * point la mettrait EN DESSOUS du joueur, pas à égalité — l'inverse du but.
 */

/** L'objet tenu de `target`, ou `undefined` si ce palier n'a pas le droit de le connaître. */
export function knownHeldItemId(
  target: PokemonInstance,
  capabilities: AiCapabilities,
): PokemonInstance["heldItemId"] {
  if (capabilities.seesHiddenInfo || target.revealedItem === true) {
    return target.heldItemId;
  }
  return undefined;
}

/**
 * Le talent effectif de `target`, ou `undefined` si ce palier n'a pas le droit de le connaître.
 *
 * `effectiveAbilityId` et non `abilityId` brut : un talent supprimé ou échangé en cours de partie doit
 * rester celui qui agit vraiment, exactement comme pour une IA qui voit tout.
 */
export function knownAbilityId(
  target: PokemonInstance,
  capabilities: AiCapabilities,
): string | undefined {
  if (capabilities.seesHiddenInfo || target.revealedAbility === true) {
    return effectiveAbilityId(target);
  }
  return undefined;
}
