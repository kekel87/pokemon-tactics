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

/**
 * Les compteurs d'action, **au même endroit que le reste du contrat** et non dans `telemetry.ts`.
 *
 * 🔴 Motif, trouvé au gate du plan 212 : le Worker porte la table qui NOMME ces compteurs
 * (`ACTION_LABELS`), et un libellé oublié dégrade le rapport en silence — trois l'ont été pendant
 * deux plans. Le test de parité qui garde cette table doit donc lire l'énumération depuis le paquet
 * du Worker, qui compile **sans le DOM**. Tant qu'elle vivait dans `telemetry.ts`, l'importer
 * traînait `window`, `document` et `sendBeacon` sous les libs Workers, et `tsc` refusait.
 *
 * Un contrat entre deux paquets appartient au fichier de contrat. C'est aussi ce qui rend le
 * garde-fou possible plutôt que théorique.
 */
export const TelemetryAction = {
  /** Le format d'échange Showdown sert-il, et **les imports échouent-ils** ? Un collage qui ne
   *  parse pas est aujourd'hui un bug produit totalement invisible. */
  ShowdownModal: "showdown-modal",
  ShowdownImportOk: "showdown-import-ok",
  ShowdownImportFail: "showdown-import-fail",
  ShowdownExport: "showdown-export",
  /** Le Team Builder est-il utilisé, ou joue-t-on avec les équipes par défaut ? */
  TeamSave: "team-save",
  TeamDelete: "team-delete",
  TeamGenerate: "team-generate",
  /** Réglages réellement touchés. */
  LanguageChange: "language-change",
  FullscreenToggle: "fullscreen-toggle",
  /** Ce que le plan 187 a livré sert-il, et par quelle sortie part-on ? */
  CombatMenuOpen: "combat-menu-open",
  CombatMenuRestart: "combat-menu-restart",
  CombatMenuForfeit: "combat-menu-forfeit",
  CombatMenuQuit: "combat-menu-quit",
  /** La reprise du plan 181 est-elle voulue ? Le refus n'a pas de compteur : il se déduit de
   *  l'écart entre « proposée » et « acceptée ». */
  ResumeOffered: "resume-offered",
  ResumeAccepted: "resume-accepted",
  /** L'écran de remapping du plan 186 sert-il ? */
  RemapBinding: "remap-binding",
  /*
   * Le choix de la carte, en modale (plan 208). Ces trois compteurs REMPLACENT l'étape `map-select`
   * du funnel, et c'est un arbitrage de l'humain, pas une conséquence mécanique.
   *
   * 🔴 Pourquoi le compteur d'écran ne pouvait pas survivre : `map-select` était un **passage
   * obligé** vers le combat. La modale est un **geste volontaire**. Garder le même compteur aurait
   * laissé une série continue changer de sens en silence — le volume s'effondre sans que rien ne
   * soit cassé, exactement le genre de faux signal qu'on passe des mois à mal lire. La coupure est
   * donc assumée et datée dans le graphe de mémoire, plutôt que maquillée.
   *
   * Ce que les trois répondent, et qui n'était pas mesurable avant : **le choix de carte
   * intéresse-t-il vraiment ?** `map-modal-open` dit combien de joueurs vont voir, `map-changed`
   * combien changent réellement de terrain, et leur écart — lu avec `map-modal-dismissed` — dit
   * combien ouvrent par curiosité puis s'en tiennent à ce qu'ils avaient. Une modale beaucoup
   * ouverte et jamais suivie d'un changement voudrait dire que le défaut est bon ; l'inverse, que
   * la carte retenue d'office tombe mal.
   */
  MapModalOpen: "map-modal-open",
  MapChanged: "map-changed",
  MapModalDismissed: "map-modal-dismissed",
  /*
   * Jeu en ligne (plan 199, étape 7). Deux questions, et une seule vraiment brûlante :
   *
   * 1. **Le jeu en ligne aboutit-il ?** L'écart entre « partie créée » et « partie rejointe » dit
   *    combien de salons n'ont jamais trouvé de second joueur, et « salon abandonné » combien ont
   *    été quittés avant le lancement.
   * 2. **La mise en relation échoue-t-elle, et pourquoi ?** C'est le vrai enjeu : la traversée de
   *    pare-feu est assumée faillible en V1 (NAT symétrique, réseau mobile), et sans compteur par
   *    cause on ne saurait pas si le pair-à-pair sans relais est tenable. Une cause par compteur
   *    plutôt qu'une clé construite : l'énumération reste fermée, donc agrégeable.
   */
  RoomCreated: "room-created",
  RoomJoined: "room-joined",
  RoomAbandoned: "room-abandoned",
  RoomFailedCodeIntrouvable: "room-failed-code_introuvable",
  RoomFailedSalonPlein: "room-failed-salon_plein",
  RoomFailedPartieCommencee: "room-failed-partie_commencee",
  RoomFailedVersionIncompatible: "room-failed-version_incompatible",
  RoomFailedConnexionImpossible: "room-failed-connexion_impossible",
  RoomFailedDelaiDepasse: "room-failed-delai_depasse",
  RoomFailedFormatReduit: "room-failed-format_reduit",
  /**
   * Un canal a dû passer par le relais de secours (plan 216, bug 1).
   *
   * 🔴 C'est le chiffre qui dit si la traversée de pare-feu tient ses promesses. Avant ce plan, un
   * joueur en NAT symétrique comptait simplement en `room-failed-connexion_impossible` et ne jouait
   * pas. Maintenant il joue — mais il faut savoir COMBIEN de parties en dépendent, parce que c'est
   * ce nombre qui dimensionne le garde-fou de quota, et que la seule estimation qu'on en ait
   * aujourd'hui a été posée à la louche.
   */
  RoomRelayUsed: "room-relay-used",
  /*
   * Robustesse du jeu en ligne (plan 202, Lot B3). Ces compteurs existent pour une raison précise :
   * **les délais du lot sont des paris**, arrêtés à la main faute de terrain — 60 s de chrono, 75 s
   * de silence, 30 s après une fermeture, trois tours manqués. « On ajustera à l'usage » n'est
   * tenable que si l'usage se mesure, sinon on devine deux fois.
   *
   * Ce que chacun répond :
   * - `turn-timed-out` : **60 s suffisent-ils ?** Un taux élevé de tours partis au dépassement dit
   *   que la fenêtre est trop courte pour un tour tactique — c'est la mesure que la revue de design
   *   réclamait sans pouvoir la faire.
   * - `reconnect-succeeded` / `reconnect-failed` vs `forfeit-absent` : **le délai de grâce est-il
   *   bien réglé ?** Beaucoup de forfaits pour absence face à peu de reprises réussies veut dire
   *   qu'on coupe trop tôt.
   * - `forfeit-missed-turns` : distinct de `forfeit-absent` **exprès** — l'un est un joueur parti,
   *   l'autre un joueur présent qui ne joue plus. Les confondre masquerait lequel des deux
   *   mécanismes tranche vraiment.
   * - `forfeit-diverged` : **le déterminisme tient-il ?** C'est le chiffre qui dira si le Lot B4
   *   (somme de contrôle d'état) est urgent ou théorique.
   * - `connection-uncertain` : **le pair-à-pair sans relais est-il tenable ?** ICE signale une
   *   dégradation bien avant le chien de garde ; sa fréquence dit si un relais TURN devient
   *   nécessaire, question laissée ouverte en V1.
   * - `checksum-mismatch` : **le déterminisme tient-il, pour de vrai ?** Distinct de
   *   `forfeit-diverged` **exprès** (plan 203, Lot B4) : l'un compte les forfaits pour divergence
   *   toutes causes, l'autre ceux que la somme de contrôle d'état a trouvés. Les deux montent
   *   ensemble sur ce chemin, donc c'est leur **écart** qui parle — il dit combien de divergences
   *   viennent d'actions refusées (le barème du Lot B2) plutôt que d'une désync d'état muette, celle
   *   qui laisse toutes les actions légales et qu'aucun autre mécanisme ne voit.
   * - `checksum-compared` : **le dénominateur de `checksum-mismatch`**, compté une fois par combat
   *   où au moins deux empreintes ont été confrontées. Sans lui, un `checksum-mismatch` à zéro est
   *   indiscernable de « aucune comparaison n'a jamais eu lieu », et le seul chiffre censé mesurer
   *   le déterminisme ne prouverait rien. Relevé en revue de code du Lot B4.
   */
  TurnTimedOut: "turn-timed-out",
  ForfeitAbsent: "forfeit-absent",
  ForfeitMissedTurns: "forfeit-missed-turns",
  ForfeitDiverged: "forfeit-diverged",
  ForfeitResigned: "forfeit-resigned",
  ReconnectSucceeded: "reconnect-succeeded",
  ReconnectFailed: "reconnect-failed",
  ConnectionUncertain: "connection-uncertain",
  ChecksumMismatch: "checksum-mismatch",
  ChecksumCompared: "checksum-compared",
  /*
   * Les trois mécaniques de fin de Phase 7 (plan 212). Elles sont nées APRÈS la conception de la
   * télémétrie, et c'est la seule raison pour laquelle elles n'étaient pas mesurées — pas un
   * arbitrage. L'audit d'avant-release l'a trouvé ; une mesure oubliée avant publication est
   * perdue pour toujours, et les premières semaines sont les plus informatives.
   *
   * - `host-migrated` : **la migration d'hôte aboutit-elle ?** C'est le mécanisme le plus récent et
   *   le plus risqué du jeu en ligne — il réécrit qui héberge en pleine partie, il dépend d'un
   *   registre externe, et son compare-and-swap a été corrigé deux fois en recette. Lu avec
   *   `forfeit-absent`, il dit si un hôte qui part est remplacé ou si la partie meurt avec lui.
   * - `placement-timed-out` : **90 s suffisent-ils pour poser son équipe ?** Exactement la question
   *   que `turn-timed-out` pose pour les 60 s du tour. Les deux délais sont des paris arrêtés à la
   *   main ; on avait instrumenté l'un et pas l'autre, sans raison.
   * - `eliminated-kept-watching` / `eliminated-left` : **le mode spectateur sert-il à quelqu'un ?**
   *   Une fonctionnalité entière livrée « sans une ligne de code » au plan 210. Si personne ne
   *   reste, on le saura — et c'est une information de conception, pas un bug.
   */
  HostMigrated: "host-migrated",
  PlacementTimedOut: "placement-timed-out",
  EliminatedKeptWatching: "eliminated-kept-watching",
  EliminatedLeft: "eliminated-left",
} as const;
export type TelemetryAction = (typeof TelemetryAction)[keyof typeof TelemetryAction];

/** D'où le joueur est parti (plan 212, Lot F). Énumération fermée, donc agrégeable. */
export const AbandonSource = {
  /** « Quitter » dans le menu de combat : un départ délibéré, la sauvegarde est gardée. */
  Menu: "menu",
  /** « Abandonner » dans le menu : départ DÉFINITIF, la sauvegarde est purgée. */
  Abandon: "abandon",
  /**
   * La partie s'est arrêtée sous le joueur parce que les deux machines ne racontaient plus la même
   * chose.
   *
   * ⚠️ Nommé `diverged` et NON `disconnected` (revue de code, 2026-09-16) : le seul appelant de
   * `onBattleInterrupted` est la divergence d'état. Une vraie perte de connexion se termine par un
   * forfait, donc par un `battle_ended`, et n'émet jamais d'abandon. Une étiquette
   * « déconnexion » aurait fait lire « les gens perdent leur connexion » à qui ouvrirait le rapport
   * dans six mois — un bucket mal nommé est pire qu'un bucket absent.
   */
  Diverged: "diverged",
  /** L'onglet s'est fermé. Part par `sendBeacon`, comme la ligne `session` (décisions #888, #889). */
  TabClosed: "tab-closed",
} as const;
export type AbandonSource = (typeof AbandonSource)[keyof typeof AbandonSource];
