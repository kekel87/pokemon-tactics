import { MAPS_REGISTRY } from "./maps-registry";
import { DEFAULT_MAP_ID, isRandomMapId, RANDOM_MAP_ID } from "./random-map-id";

// Réexportés pour que les appelants n'aient qu'une porte d'entrée : la sentinelle vit dans un module
// feuille (voir son en-tête), mais personne n'a à le savoir pour s'en servir.
export { DEFAULT_MAP_ID, isRandomMapId, RANDOM_MAP_ID };

/**
 * Le choix de carte d'une partie (plan 208), depuis que l'écran de sélection a disparu.
 *
 * Deux choses vivent ici, et elles sont liées : l'entrée **« Aléatoire »** de la liste des cartes,
 * et la **carte par défaut** d'une partie que plus personne ne traverse d'écran pour choisir.
 */

/**
 * Tire une carte du registre.
 *
 * Aucun plafonnement par format, et ce n'est pas un oubli : les neuf cartes de production déclarent
 * **tous** les formats requis — `validateTiledMap` refuse au chargement une carte qui en manque un —
 * et la capacité par camp y est uniforme, mesurée au vrai parseur le 2026-09-11 (2J×6, 3J×4, 4J×3,
 * 6J×2, 12J×1 sur les neuf). Le plafond de jeu (12 / camps) gagne partout sur les positions de
 * spawn, donc un tirage ne peut jamais rendre une carte qui accepterait moins de Pokemon que
 * l'équipe déjà composée. Le cadrage du plan 208 redoutait l'inverse aux formats à plus de deux
 * camps ; la mesure ne l'a pas confirmé.
 */
export function drawRandomMapId(): string {
  const index = Math.floor(Math.random() * MAPS_REGISTRY.length);
  return MAPS_REGISTRY[index]?.id ?? MAPS_REGISTRY[0]?.id ?? RANDOM_MAP_ID;
}

/**
 * `random` → une carte tirée ; tout autre identifiant est rendu tel quel.
 *
 * Le tirage se fait **une fois**, à l'endroit qui appelle — jamais deux, sans quoi deux pairs
 * joueraient sur deux terrains (contrainte écrite au backlog dès le 2026-09-03).
 */
export function resolveMapId(mapId: string): string {
  return isRandomMapId(mapId) ? drawRandomMapId() : mapId;
}

/**
 * L'identifiant de carte retenu par le magasin des préférences, validé contre le registre.
 *
 * Rend `DEFAULT_MAP_ID` quand la carte enregistrée a disparu du registre depuis — une carte retirée
 * du jeu ne doit pas ressusciter par le stockage du navigateur. « Aléatoire », lui, est un choix
 * valide et traverse intact.
 *
 * Le repli était `RANDOM_MAP_ID` jusqu'au 2026-09-13 ; voir l'en-tête de `DEFAULT_MAP_ID` pour
 * pourquoi il ne l'est plus.
 */
export function knownMapIdOrDefault(storedMapId: string): string {
  if (isRandomMapId(storedMapId)) {
    return RANDOM_MAP_ID;
  }
  return MAPS_REGISTRY.some((entry) => entry.id === storedMapId) ? storedMapId : DEFAULT_MAP_ID;
}
