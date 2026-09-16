/**
 * Télémétrie de jeu — client (plan 196, étapes 3 et 4). Remplace `analytics.ts` / Goatcounter.
 *
 * Trois règles de conception, chacune payée par une leçon :
 *   1. **La télémétrie ne casse JAMAIS le jeu** — tout envoi est enveloppé dans un `try/catch` muet.
 *   2. **Jamais un envoi par clic.** Une visite fait facilement trente interactions ; à deux lignes
 *      par écriture, ce serait ~60 lignes par visite et le quota tomberait vers 1 600 visites/jour.
 *      On accumule des compteurs en mémoire et on envoie un résumé (décision #868).
 *   3. **Rien en local.** `platformPrefix()` rend `null` sur `localhost`, donc le bac à sable et les
 *      519 tests e2e n'écrivent pas une ligne dans la base de production.
 */

import type { NetworkErrorCode } from "@pokemon-tactic/network";
import { getLanguage } from "../i18n";
import {
  AbandonSource,
  NARROW_SCREEN_BUCKET,
  SCREEN_BUCKETS,
  TELEMETRY_ENDPOINT,
  TELEMETRY_PLATFORM_HOSTS,
  TelemetryAction,
  VISIT_BEACON_FLAG,
} from "./telemetry-contract";

/**
 * Les énumérations vivent dans `telemetry-contract.ts` — voir là-bas pourquoi. Réexportées ici pour
 * que les appelants existants gardent leur import.
 */
export { AbandonSource, TelemetryAction };

/**
 * Plafond partagé par `sendBeacon` et `fetch keepalive`. Nos payloads en sont très loin ; la garde
 * existe pour qu'une partie à 12 équipes ne fasse pas silencieusement échouer son envoi.
 */
const MAX_BODY_BYTES = 60_000;

/** Écrans dont on compte l'atteinte — le funnel que Goatcounter mesurait (#215). */
export const TelemetryScreen = {
  MainMenu: "main-menu",
  BattleMode: "battle-mode",
  TeamBuilder: "team-builder",
  Lobby: "lobby",
  TeamSelect: "team-select",
  Credits: "credits",
  Controls: "controls",
} as const;
export type TelemetryScreen = (typeof TelemetryScreen)[keyof typeof TelemetryScreen];

/**
 * La cause de refus réseau → son compteur. Table exhaustive : `satisfies` fait échouer la
 * compilation le jour où `NetworkErrorCode` gagne une valeur sans compteur, plutôt que de la perdre
 * en silence dans le rapport.
 */
export const ROOM_FAILURE_ACTIONS = {
  code_introuvable: TelemetryAction.RoomFailedCodeIntrouvable,
  salon_plein: TelemetryAction.RoomFailedSalonPlein,
  partie_commencee: TelemetryAction.RoomFailedPartieCommencee,
  version_incompatible: TelemetryAction.RoomFailedVersionIncompatible,
  connexion_impossible: TelemetryAction.RoomFailedConnexionImpossible,
  delai_depasse: TelemetryAction.RoomFailedDelaiDepasse,
  format_reduit: TelemetryAction.RoomFailedFormatReduit,
} as const satisfies Record<NetworkErrorCode, TelemetryAction>;

export const TeamSource = {
  /** La seule provenance qui porte une composition (décision humaine du 2026-08-31). */
  HumanBuilt: "human-built",
  HumanRandom: "human-random",
  /** Le défaut de la décision #330 : équipe aléatoire éphémère pour l'IA. */
  AiRandom: "ai-random",
  AiBuilt: "ai-built",
} as const;
export type TeamSource = (typeof TeamSource)[keyof typeof TeamSource];

export const KnockOutCause = {
  Damage: "damage",
  Fall: "fall",
  LethalTerrain: "lethal-terrain",
  RingOut: "ring-out",
  /**
   * Le camp a quitté la partie (plan 201) : abandon, ou élimination faute de concordance.
   *
   * Sans cette valeur, les Pokemon d'un camp éliminé remonteraient en `damage` — le repli du
   * collecteur — c'est-à-dire un **mensonge factuel** dans les données que la Phase 8 lira pour
   * juger l'équilibrage.
   */
  Forfeit: "forfeit",
} as const;
export type KnockOutCause = (typeof KnockOutCause)[keyof typeof KnockOutCause];

export interface TelemetryTeamMember {
  readonly species: string;
  readonly ability: string;
  readonly item: string | null;
  readonly nature: string;
  readonly moves: readonly string[];
}

export interface TelemetryTeam {
  readonly side: number;
  readonly source: TeamSource;
  /** Une équipe générée puis sauvegardée reste un choix, mais le drapeau permet de l'écarter. */
  readonly generated?: boolean;
  /** Absente pour toute provenance autre que `human-built` : on ne capture pas ce qu'il faudrait
   *  ensuite se souvenir d'exclure. */
  readonly members?: readonly TelemetryTeamMember[];
}

export interface BattleStartedPayload {
  readonly battleId: string;
  readonly mode: string;
  readonly map: string;
  readonly format: string;
  readonly humans: number;
  readonly ai: number;
  readonly autoPlacement: boolean;
  /**
   * Les deux paramètres de partie du plan 198 voyagent **ensemble** : ils se règlent au même endroit,
   * et savoir si les joueurs gardent la prévisualisation de dégâts active est le genre de signal
   * d'usage que la Phase 8 (équilibrage) veut lire — un joueur qui la coupe ne juge pas les dégâts
   * comme celui qui les voit avant de frapper.
   */
  readonly damagePreview: boolean;
  readonly teams: readonly TelemetryTeam[];
}

export interface TelemetryMemberOutcome {
  readonly species: string;
  /**
   * D'où vient l'équipe de ce Pokemon (plan 212, Lot E). **Le champ qui rend le lot acceptable.**
   *
   * 🔴 Deux questions se cachaient sous le mot « usage », et ce drapeau est ce qui les sépare :
   * - le **goût** — ce que les joueurs choisissent — ne se lit que sur `human-built` ;
   * - la **force** — ce qui gagne réellement — se lit sur toutes les équipes humaines, et une
   *   équipe `human-random` y vaut MIEUX qu'une équipe bâtie : le Pokemon y a été distribué et non
   *   choisi, donc sans biais de sélection ni réputation.
   *
   * Sans lui, élargir la collecte mélangerait les deux cohortes de façon irréversible. Avec lui, le
   * tri se fait à la LECTURE (décision #868), et aucune équipe aléatoire n'entre dans le bloc
   * d'usage du rapport — limite posée par l'humain le 2026-09-16.
   */
  readonly source: TeamSource;
  /**
   * Le camp de ce Pokemon, 0-indexé (plan 212, Lot E).
   *
   * 🔴 Sans lui, **« taux de présence dans le camp vainqueur » est incalculable** : `winnerSide` vit
   * au niveau du payload, pas de l'issue, donc rien ne rattache un Pokemon au camp qui a gagné. Et
   * deux équipes aléatoires tirées sur 150 espèces peuvent parfaitement sortir la même — sans
   * `side`, on ne pourrait même pas les distinguer après coup.
   *
   * Relevé par `game-designer` à la revue du plan 204 puis reporté
   * (`backlog-telemetrie-victoire-par-espece-matchup`), et retrouvé par la même revue au plan 212.
   * La conception complète des affrontements reste pour la Phase 8 ; ce champ en est la moitié qui
   * ne coûte rien et sans laquelle l'autre moitié ne pourra jamais se faire rétroactivement.
   */
  readonly side: number;
  /** Attaques réellement lancées, avec leur compte. */
  readonly moves: Readonly<Record<string, number>>;
  /** Tour du K.O., `null` si le Pokemon a survécu. Désambiguïse le signal des attaques mortes :
   *  une attaque jamais lancée par un Pokemon tombé au tour 1 juge la survie, pas l'attaque. */
  readonly knockedOutTurn: number | null;
  readonly knockedOutCause: KnockOutCause | null;
}

export const BattleEndReason = {
  /** La partie s'est jouée jusqu'au bout. */
  Combat: "combat",
  /** Un camp a quitté la partie (plan 201). */
  Forfeit: "forfeit",
} as const;
export type BattleEndReason = (typeof BattleEndReason)[keyof typeof BattleEndReason];

export interface BattleEndedPayload {
  readonly battleId: string;
  /** Camp vainqueur, ou `null` en cas de match nul (plan 191). */
  readonly winnerSide: number | null;
  readonly draw: boolean;
  /**
   * Comment la partie s'est terminée (plan 201).
   *
   * 🔴 Pourquoi ce champ existe : l'abandon se mesurait par l'**ABSENCE** de `battle_ended` (voir
   * `trackBattleEnded`), et un forfait qui en émet un **casse cet invariant** — il sortirait du
   * signal d'abandon pour polluer celui des victoires décisives, qui est précisément ce que la
   * Phase 8 lira pour juger les matchups. Le distinguer coûte un champ ; ne pas le distinguer coûte
   * la confiance dans toute la mesure.
   */
  readonly endReason: BattleEndReason;
  readonly durationMs: number;
  readonly turns: number;
  /** Seulement pour les équipes `human-built`, les seules dont on ait la composition. */
  readonly outcomes: readonly TelemetryMemberOutcome[];
}

/**
 * Une partie quittée en cours (plan 212, Lot F).
 *
 * 🔴 **Un événement à CÔTÉ de `battle_ended`, jamais un `battle_ended`.** L'absence de fin reste le
 * signal de l'abandon — voir `BattleEndedPayload.endReason`, où le plan 201 a failli casser cet
 * invariant pour le forfait. Requalifier un départ en fin le ferait sortir du taux d'abandon pour
 * polluer celui des victoires décisives, que la Phase 8 lira pour juger les matchups.
 *
 * Ce que ça ajoute : on savait **combien** de parties étaient lâchées (77 % en production sur 14
 * jours), jamais **quand ni dans quel état**. Un taux sans ces deux-là ne désigne aucun correctif.
 */
export interface BattleAbandonedPayload {
  readonly battleId: string;
  /** Tour atteint au moment du départ. Lâche-t-on au 3ᵉ tour ou au 50ᵉ ? */
  readonly turns: number;
  readonly durationMs: number;
  readonly from: AbandonSource;
  /**
   * Le camp de CELUI QUI PART, 0-indexé, ou `null` quand il n'y en a pas un seul (hot-seat, où tous
   * les camps sont locaux).
   *
   * 🔴 Sans lui, `healthRatios` ne répond pas à la question pour laquelle il existe : on verrait
   * qu'une partie était déséquilibrée, jamais de quel côté se tenait le partant — donc jamais si
   * l'abandon relève de l'équilibrage ou du rythme, qui appellent des correctifs opposés.
   */
  readonly side: number | null;
  /**
   * PV restants sur PV maximum, **par camp** (0 à 1), à l'instant du départ.
   *
   * 🔴 Le champ qui distingue deux causes appelant des correctifs OPPOSÉS : abandonner en train de
   * perdre est un problème d'équilibrage, abandonner en train de gagner un problème de rythme. Sans
   * lui, les 77 % restent un chiffre dont on ne peut rien faire.
   */
  readonly healthRatios: Readonly<Record<string, number>>;
}

const EventKind = {
  Session: "session",
  BattleStarted: "battle_started",
  BattleEnded: "battle_ended",
  BattleAbandoned: "battle_abandoned",
} as const;
type EventKind = (typeof EventKind)[keyof typeof EventKind];

/**
 * Compteurs de la visite, en mémoire. Remis à zéro à chaque envoi : ce sont des **deltas**, et non
 * un cumul, donc plusieurs bascules d'onglet produisent des lignes qui **s'additionnent à la
 * lecture**, sans identifiant de session ni déduplication.
 */
const screenCounters = new Map<TelemetryScreen, number>();
const actionCounters = new Map<TelemetryAction, number>();

/**
 * 🔴 Marque la première ligne de la visite. Sans ce drapeau, **compter les visites serait
 * impossible** : les deltas font qu'une visite produit une à plusieurs lignes, donc compter les
 * lignes `session` surestimerait la fréquentation. Le nombre de visites = le nombre de lignes
 * portant `first`.
 *
 * Il vit en mémoire et repart à zéro à chaque chargement de page — ce n'est pas un identifiant,
 * il ne suit personne.
 */
let firstFlushPending = true;
let listenerInstalled = false;

/**
 * Préfixe de plateforme, et garde-fou local. Rend `null` hors des deux hôtes de publication, ce qui
 * neutralise toute la télémétrie en développement, dans le bac à sable et sous Playwright.
 */
function platformPrefix(): string | null {
  const host = window.location.hostname;
  for (const [fragment, platform] of TELEMETRY_PLATFORM_HOSTS) {
    if (host.includes(fragment)) {
      return platform;
    }
  }
  return null;
}

/** Résolu à l'appel et non à l'import : `__APP_VERSION__` est un `define` de Vite. */
function buildVersion(): string {
  return __APP_VERSION__;
}

/**
 * Taille d'écran **en paliers**, jamais au pixel (décision #879 : « rien de brut »). Un palier ne
 * réidentifie personne, une résolution exacte contribue à une empreinte.
 */
function screenBucket(): string {
  const width = window.screen.width;
  for (const [minWidth, label] of SCREEN_BUCKETS) {
    if (width >= minWidth) {
      return label;
    }
  }
  return NARROW_SCREEN_BUCKET;
}

/** Source d'entrée active, telle que l'`input-system` la publie sur la racine du document. */
function activeInputSource(): string | null {
  return document.documentElement.dataset.inputSource ?? null;
}

function countersToRecord<Key extends string>(counters: Map<Key, number>): Record<string, number> {
  return Object.fromEntries(counters);
}

/**
 * Envoi effectif. `sendBeacon` en premier : il survit à la fermeture de l'onglet, ce dont aucune
 * autre API ne sait faire autant.
 *
 * 🔴 Le corps est une **chaîne**, jamais un `Blob` typé `application/json`. Une chaîne part en
 * `text/plain;charset=UTF-8`, qui est sur la liste sûre : la requête reste CORS « simple » et ne
 * déclenche **aucun préflight `OPTIONS`**. Un `Blob` JSON en déclencherait un, qui échouerait
 * silencieusement — avalé par le `catch` muet, donc invisible en production.
 */
function send(kind: EventKind, payload: Record<string, unknown>): void {
  const platform = platformPrefix();
  if (!platform) {
    return;
  }
  try {
    const body = JSON.stringify({ kind, build: buildVersion(), platform, payload });
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return;
    }
    // `sendBeacon` rend `false` s'il ne peut pas mettre la requête en file : tester ce retour, et
    // pas seulement l'existence de l'API.
    const queued = navigator.sendBeacon?.(TELEMETRY_ENDPOINT, body) ?? false;
    if (queued) {
      return;
    }
    // Repli : `keepalive` pour survivre au déchargement, et surtout AUCUN en-tête `Content-Type`,
    // sans quoi on retomberait dans le préflight que la chaîne évitait.
    void fetch(TELEMETRY_ENDPOINT, { method: "POST", body, keepalive: true, mode: "cors" }).catch(
      () => undefined,
    );
  } catch {
    // La télémétrie ne doit jamais casser le jeu.
  }
}

/** Compte l'atteinte d'un écran. En mémoire — rien ne partira avant le prochain envoi groupé. */
export function countScreen(screen: TelemetryScreen): void {
  screenCounters.set(screen, (screenCounters.get(screen) ?? 0) + 1);
}

/** Compte une action d'interface. En mémoire, même règle. */
export function countAction(action: TelemetryAction): void {
  actionCounters.set(action, (actionCounters.get(action) ?? 0) + 1);
}

/**
 * Envoie les compteurs accumulés, puis les remet à zéro.
 *
 * 🔴 **La première ligne part même si tous les compteurs sont à zéro.** C'est elle qui porte le
 * comptage des visites, et c'était le trou méthodologique du schéma initial : un joueur qui lance
 * un combat sans toucher aucun bouton instrumenté n'aurait produit **aucune ligne**, alors que
 * Goatcounter comptait le chargement de page lui-même, inconditionnellement. Les envois suivants,
 * eux, ne partent que s'ils ont quelque chose à dire.
 */
export function flushSession(): void {
  const hasCounters = screenCounters.size > 0 || actionCounters.size > 0;
  if (!firstFlushPending && !hasCounters) {
    return;
  }

  const payload: Record<string, unknown> = {
    uiLanguage: getLanguage(),
    inputSource: activeInputSource(),
    screen: screenBucket(),
    referrer: document.referrer || null,
    screens: countersToRecord(screenCounters),
    actions: countersToRecord(actionCounters),
  };
  if (firstFlushPending) {
    payload.first = true;
    firstFlushPending = false;
  }

  screenCounters.clear();
  actionCounters.clear();
  send(EventKind.Session, payload);
}

/**
 * Installe l'envoi groupé, sur **les deux** événements de fin de vie de page — et envoie
 * **immédiatement** la ligne de visite.
 *
 * 🔴 **Ne pas faire dépendre le comptage d'une visite d'un envoi de fin de page.** La production l'a
 * montré le 2026-09-03 : itch.io comptait 2 « Browser Plays » quand la base ne portait aucune ligne
 * pour ce jour. Tant que la ligne `first` ne partait qu'à la fermeture, toute défaillance du beacon
 * terminal effaçait la visite entière — et ces défaillances sont nombreuses : bug WebKit de
 * `visibilitychange`, onglet tué par iOS, éviction du bfcache, iframe itch démontée par la page
 * parente. Envoyée à l'init, la visite est acquise dès que le code du jeu s'exécute.
 *
 * ⚠️ **Ce flush ne couvre pas le joueur qui referme AVANT la fin du chargement.** `initTelemetry()`
 * est appelée depuis le corps de `babylon-boot.ts`, dont le graphe d'imports statiques inclut
 * Babylon — en ESM, tout ce graphe est téléchargé et évalué avant la première instruction du corps,
 * soit 4,3 Mo de `main.js` plus le module Babylon. C'est la **balise inline** injectée dans
 * `index.html` par `vite.config.ts` qui couvre cette fenêtre (décision #889) ; quand elle a réussi,
 * elle pose `VISIT_BEACON_FLAG` sur `window` et ce flush-ci renonce à sa ligne `first`, sans quoi la
 * visite compterait double. Quand elle a échoué ou n'a pas tourné, le bundle reprend la main.
 *
 * Contrepartie assumée : `inputSource` est **toujours** `null` sur cette première ligne —
 * `initInputSystem()`, qui pose `data-input-source`, tourne après `initTelemetry()`. La source
 * d'entrée réelle arrive donc sur la ligne suivante, et `report.ts` la compte là.
 *
 * 🔴 `visibilitychange` NE SUFFIT PAS, et ça s'est vu en production le 2026-09-02 : une visite sur
 * itch.io a bien produit son `battle_started`, mais **jamais** sa ligne `session`. La documentation
 * est formelle — `visibilitychange` n'est pas garanti à la **fermeture** d'un onglet (et WebKit a un
 * bug de longue date où il ne part pas du tout, que Wikipédia contourne de cette façon). Le patron
 * recommandé est donc :
 *   - `visibilitychange → hidden` pour la mise en **arrière-plan** (changement d'onglet, minimisation) ;
 *   - `pagehide` pour la **fermeture** et la navigation sortante, qui est le cas qu'on a raté.
 *
 * Le plan 196 disait « plus fiable que `pagehide` » — c'était vrai, mais ça voulait dire « en plus
 * de », pas « à la place de ».
 *
 * **Le double déclenchement est inoffensif par construction** : le premier envoi vide les compteurs
 * et consomme `first`, donc le second n'a plus rien à dire et `flushSession()` ne part pas. Pas
 * besoin d'un drapeau « déjà envoyé » — ce sont les deltas qui rendent l'opération idempotente.
 */
export function initTelemetry(): void {
  if (listenerInstalled) {
    return;
  }
  listenerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushSession();
    }
  });
  window.addEventListener("pagehide", () => flushSession());
  // `Reflect.get` plutôt qu'un cast : le drapeau vient d'un script hors bundle, donc hors typage.
  if (Reflect.get(window, VISIT_BEACON_FLAG) === true) {
    firstFlushPending = false;
  }
  // La visite part MAINTENANT, compteurs vides : cf. le bloc ci-dessus. Enveloppé parce que ce flush
  // est le seul à tourner sur le chemin critique d'évaluation du module d'entrée : une exception ici
  // avorterait le reste de `babylon-boot.ts`, donc le jeu. Le `try/catch` de `send()` ne couvre pas
  // la construction du payload, qui a lieu en amont dans `flushSession()`.
  try {
    flushSession();
  } catch {
    // La télémétrie ne casse jamais le jeu (règle 1).
  }
}

/**
 * Une partie commence. La composition voyage **ici** et non à la fin : chez Showdown l'usage d'un
 * Pokemon est sa **présence dans une équipe**, pas le fait qu'il ait agi. Si elle partait dans
 * `battle_ended`, toutes les parties abandonnées disparaîtraient des statistiques d'usage — et
 * l'abandon est justement une population qu'on veut mesurer.
 *
 * ⚠️ À ne PAS appeler à la reprise d'un combat (plan 181), sinon une partie reprise trois fois
 * compterait pour quatre.
 */
export function trackBattleStarted(payload: BattleStartedPayload): void {
  send(EventKind.BattleStarted, { ...payload });
}

/**
 * Une partie se termine. Le taux d'abandon sort gratuitement de l'écart entre les deux événements :
 * une partie quittée en cours n'émet pas de `battle_ended`, et **l'absence est le signal**. C'est
 * le `battleId` qui permet de rapprocher les deux, donc de sortir l'abandon par carte et par
 * format plutôt qu'en global (décision #880).
 */
export function trackBattleEnded(payload: BattleEndedPayload): void {
  send(EventKind.BattleEnded, { ...payload });
}

/**
 * Une partie est quittée en cours (plan 212, Lot F). **Exclusif de `trackBattleEnded`** : une partie
 * émet l'un ou l'autre, jamais les deux, et c'est l'appelant qui le garantit en ne gardant qu'un
 * collecteur, mis à `null` dès qu'il a servi.
 *
 * Le `battleId` rapproche l'abandon de son `battle_started` (décision #880), donc rend le taux
 * lisible par carte et par format plutôt qu'en global.
 */
export function trackBattleAbandoned(payload: BattleAbandonedPayload): void {
  send(EventKind.BattleAbandoned, { ...payload });
}

/**
 * Identifiant de partie, **éphémère** (décision #880) : aléatoire à chaque partie, jamais écrit sur
 * le disque, jamais lié à un appareil, jamais réutilisé. Un identifiant de partie non persistant ne
 * réidentifie personne ; un identifiant stable, si — c'est la ligne à ne pas franchir.
 */
export function createBattleId(): string {
  return crypto.randomUUID().slice(0, 8);
}
