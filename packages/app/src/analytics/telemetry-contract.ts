/**
 * Contrat de collecte partagé entre les deux émetteurs de télémétrie (plan 196, décision #889).
 *
 * Il en existe deux, et pas par accident :
 *   - `telemetry.ts`, dans le bundle, qui porte toute la logique de comptage ;
 *   - la **balise de visite** injectée dans `index.html` par `vite.config.ts`, qui ne sait faire
 *     qu'une chose — envoyer la ligne `first` — mais qui la fait **avant le téléchargement des
 *     4,3 Mo du bundle**, seule fenêtre où l'on peut encore compter un joueur qui referme pendant
 *     le chargement.
 *
 * 🔴 Ce fichier ne contient QUE des constantes et aucun import : `vite.config.ts` l'importe, donc
 * tout ce qu'on y mettrait de plus partirait aussi dans la configuration de build.
 */

/**
 * ⚠️ Sous-domaine `*.workers.dev` (décision #871 : pas de nom de domaine). Chemin `/e` volontairement
 * anodin : `/track`, `/collect`, `/analytics` et `/count` sont visés directement par les listes de
 * filtrage — c'est ce qui rendait Goatcounter aveugle (décision #881, mesuré).
 */
export const TELEMETRY_ENDPOINT = "https://pokemon-tactics-telemetry.kekel87.workers.dev/e";

/**
 * Hôtes de publication, et eux seuls. Un hôte absent de cette liste — `localhost` en tête — rend
 * les deux émetteurs muets : ni le développement, ni le bac à sable, ni les 519 tests e2e n'écrivent
 * une ligne en production.
 */
export const TELEMETRY_PLATFORM_HOSTS: readonly (readonly [fragment: string, platform: string])[] =
  [
    ["itch.zone", "itch"],
    ["github.io", "ghp"],
  ];

/**
 * Taille d'écran **en paliers**, jamais au pixel (décision #879 : « rien de brut »). Un palier ne
 * réidentifie personne, une résolution exacte contribue à une empreinte. Ordre décroissant : le
 * premier palier atteint gagne.
 */
export const SCREEN_BUCKETS: readonly (readonly [minWidth: number, label: string])[] = [
  [1920, ">=1920"],
  [1280, "1280-1919"],
  [768, "768-1279"],
];

/** Palier des écrans plus étroits que le plus petit seuil ci-dessus. */
export const NARROW_SCREEN_BUCKET = "<768";

/**
 * Drapeau posé sur `window` par la balise inline quand elle a réussi à mettre la ligne de visite en
 * file. `telemetry.ts` le lit pour ne PAS marquer une seconde ligne `first` — sans quoi chaque
 * visite serait comptée deux fois. Il n'est posé qu'en cas de succès avéré de `sendBeacon` : si la
 * balise a échoué ou n'a jamais tourné, le bundle reprend la responsabilité de la ligne de visite.
 */
export const VISIT_BEACON_FLAG = "__pokemonTacticsVisitSent";
