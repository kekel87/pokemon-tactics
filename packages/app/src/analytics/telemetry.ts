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

import { getLanguage } from "../i18n";
import {
  NARROW_SCREEN_BUCKET,
  SCREEN_BUCKETS,
  TELEMETRY_ENDPOINT,
  TELEMETRY_PLATFORM_HOSTS,
  VISIT_BEACON_FLAG,
} from "./telemetry-contract";

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
  MapSelect: "map-select",
  TeamSelect: "team-select",
  Credits: "credits",
  Controls: "controls",
} as const;
export type TelemetryScreen = (typeof TelemetryScreen)[keyof typeof TelemetryScreen];

/**
 * Actions d'interface dont on compte l'usage. Chacune répond à une question qu'on se pose
 * réellement — pas « tous les boutons », ceux dont la réponse changerait quelque chose.
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
} as const;
export type TelemetryAction = (typeof TelemetryAction)[keyof typeof TelemetryAction];

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
  readonly teams: readonly TelemetryTeam[];
}

export interface TelemetryMemberOutcome {
  readonly species: string;
  /** Attaques réellement lancées, avec leur compte. */
  readonly moves: Readonly<Record<string, number>>;
  /** Tour du K.O., `null` si le Pokemon a survécu. Désambiguïse le signal des attaques mortes :
   *  une attaque jamais lancée par un Pokemon tombé au tour 1 juge la survie, pas l'attaque. */
  readonly knockedOutTurn: number | null;
  readonly knockedOutCause: KnockOutCause | null;
}

export interface BattleEndedPayload {
  readonly battleId: string;
  /** Camp vainqueur, ou `null` en cas de match nul (plan 191). */
  readonly winnerSide: number | null;
  readonly draw: boolean;
  readonly durationMs: number;
  readonly turns: number;
  /** Seulement pour les équipes `human-built`, les seules dont on ait la composition. */
  readonly outcomes: readonly TelemetryMemberOutcome[];
}

const EventKind = {
  Session: "session",
  BattleStarted: "battle_started",
  BattleEnded: "battle_ended",
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
 * Identifiant de partie, **éphémère** (décision #880) : aléatoire à chaque partie, jamais écrit sur
 * le disque, jamais lié à un appareil, jamais réutilisé. Un identifiant de partie non persistant ne
 * réidentifie personne ; un identifiant stable, si — c'est la ligne à ne pas franchir.
 */
export function createBattleId(): string {
  return crypto.randomUUID().slice(0, 8);
}
