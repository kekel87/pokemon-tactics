import { MAPS_REGISTRY } from "./maps-registry";

/**
 * La conversion entre l'**identifiant stable** d'une carte et son URL (plan 199, étape 6).
 *
 * 🔴 C'est l'identifiant qui voyage sur le réseau, **jamais l'URL**. Une URL dépend de la base de
 * déploiement — `assets/maps/…` sous GitHub Pages, un chemin d'iframe sous itch.io — donc elle n'est
 * pas un contrat entre deux pairs : le même fichier n'y porte pas le même nom des deux côtés.
 *
 * Le sens URL → identifiant existait déjà, en local dans la télémétrie de combat
 * (`analytics/battle-telemetry-session.ts`). Il est remonté ici avec son inverse : deux fonctions
 * qui doivent rester réciproques valent mieux dans le même fichier, où on les lit ensemble.
 */

/**
 * `assets/maps/the-wall.tmj` → `the-wall`. **`undefined`** quand l'URL ne vient pas du registre.
 *
 * Elle rendait `"unknown"` — un repli commode pour la télémétrie, qui a besoin d'un seau où ranger
 * les cartes hors registre, et une **faute** pour le réseau, où cette chaîne partait telle quelle
 * dans `NetworkRoomOptions.mapId` : l'invité cherchait la carte `unknown`, ne la trouvait pas, et
 * lisait « versions incompatibles » pour un simple raté de registre chez l'hôte.
 *
 * Le repli appartient donc à l'appelant qui en veut un, pas à cette fonction : la télémétrie écrit
 * `?? MAP_ID_UNKNOWN`, et l'ouverture d'un salon refuse.
 */
export function mapIdFromUrl(mapUrl: string): string | undefined {
  return MAPS_REGISTRY.find((entry) => mapUrl.endsWith(entry.url))?.id;
}

/** Le seau de la télémétrie pour une carte hors registre. Jamais un identifiant de protocole. */
export const MAP_ID_UNKNOWN = "unknown";

/**
 * `the-wall` → `assets/maps/the-wall.tmj`.
 *
 * Rend `undefined` pour un identifiant inconnu, et ce cas est **atteignable en ligne** : un pair
 * d'une version qui connaît une carte que nous n'avons pas. `NETWORK_VERSION` est là pour l'éviter,
 * mais le jour où on oubliera de l'incrémenter, mieux vaut un refus lisible qu'un chargement d'une
 * URL construite au hasard.
 */
export function mapUrlFromId(mapId: string): string | undefined {
  return MAPS_REGISTRY.find((entry) => entry.id === mapId)?.url;
}
