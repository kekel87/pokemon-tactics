import { RANDOM_MAP_ID } from "@pokemon-tactic/network";

/**
 * L'identifiant de l'entrée « Aléatoire » du choix de carte (plan 208).
 *
 * 🔴 **Un module feuille côté jeu** — il ne tire que la sentinelle du protocole, rien de l'app. C'est
 * sa raison d'être : `settings/index.ts` a besoin d'elle pour son défaut, tandis que
 * `maps/preferred-map.ts` lit les préférences. Le jour où la sentinelle vivrait dans un module qui
 * importe `settings`, le cycle se refermerait. Il s'était déjà refermé une fois, et le symptôme était
 * sournois : `DEFAULT_SETTINGS.lastMapId` valait `undefined` selon l'ordre de chargement, donc la
 * suite unitaire passait fichier par fichier et tombait en bloc. Isolée ici, l'impossibilité du cycle
 * est **structurelle** au lieu d'être promise par un commentaire.
 *
 * 🔴 Et la valeur vient du PROTOCOLE (`@pokemon-tactic/network`), elle n'est pas redéclarée : elle
 * voyage dans `NetworkRoomOptions.mapId`, donc deux définitions, c'est deux pairs qui finissent par
 * ne plus se comprendre sans qu'aucun test ne rougisse.
 *
 * Ce n'est PAS une carte : aucune entrée de `MAPS_REGISTRY` ne porte cet identifiant, et
 * `mapUrlFromId` rend donc `undefined` dessus. C'est un choix, pas un terrain.
 */
export { RANDOM_MAP_ID };

/**
 * La carte d'un joueur qui n'a encore rien joué.
 *
 * 🔴 `simple-arena` et non un tirage, sur recommandation de game-designer suivie par l'humain le
 * 2026-09-13. Trois cartes sur neuf portent une **mort instantanée** que rien n'annonce — la lave du
 * Volcan Actif, l'eau profonde de l'Archipel des Pontons, la chute du Mur : un tirage donnait à un
 * débutant plus d'une chance sur trois de perdre un Pokemon sans comprendre, à son tout premier
 * combat. Arène Simple est la seule carte plate du roster, et son registre la décrit exactement
 * ainsi — « terrain plat, idéal pour découvrir les mécaniques ».
 *
 * Second effet, qui a emporté la décision : le défaut est **collant** (la dernière carte jouée
 * devient celle d'après). Un premier tirage malheureux s'installait donc pour toutes les parties
 * suivantes, sans que le joueur l'ait jamais choisi.
 *
 * « Aléatoire » n'est pas perdu pour autant : il reste une entrée de la liste, prise volontairement.
 *
 * Écrit ici, dans le module feuille, pour la même raison que la sentinelle : `settings/index.ts` en a
 * besoin pour son défaut, et ne doit tirer aucun module qui lise les préférences.
 */
export const DEFAULT_MAP_ID = "simple-arena";

export function isRandomMapId(mapId: string): boolean {
  return mapId === RANDOM_MAP_ID;
}
