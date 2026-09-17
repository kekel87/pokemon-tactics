/**
 * La partie en cours, du point de vue de la télémétrie (plan 196, étape 4).
 *
 * Un seul combat tourne à la fois dans le client, donc un seul collecteur — même forme de singleton
 * que `battleResumeStore()`. Le collecteur lui-même (`battle-telemetry.ts`) reste pur et testable ;
 * seul ce fichier porte l'état, et il ne fait que trois choses : ouvrir, observer, fermer.
 *
 * Si rien n'a été ouvert, tout est un no-op : c'est ce qui rend le bac à sable, la route `?combat=1`
 * et un combat repris muets sans qu'aucun de ces chemins ait à le savoir.
 */

import type { BattleEvent, TeamSelection } from "@pokemon-tactic/core";
import { MAP_ID_UNKNOWN, mapIdFromUrl } from "../maps/map-identity";
import { modeOf } from "./battle-mode";
import { type BattleTelemetryCollector, createBattleTelemetryCollector } from "./battle-telemetry";
import { aiDifficultiesOf, countControllers, trackedSourcesOf } from "./team-telemetry";
import {
  AbandonSource,
  createBattleId,
  type TelemetryTeam,
  trackBattleAbandoned,
  trackBattleEnded,
  trackBattleStarted,
} from "./telemetry";

let collector: BattleTelemetryCollector | null = null;
let abandonOnPageHideInstalled = false;

/**
 * Ouvre la télémétrie d'une partie et émet `battle_started`.
 *
 * Appelé là où le seed est tiré, donc AVANT le placement (décision #857) : la composition doit
 * voyager au démarrage, sinon toutes les parties abandonnées disparaîtraient des statistiques
 * d'usage — et l'abandon est justement une population qu'on veut mesurer.
 *
 * ⚠️ Jamais appelé à la reprise d'un combat (plan 181) : la reprise ne repasse pas par le placement,
 * donc une partie reprise trois fois ne compte pas pour quatre.
 */
export function beginBattleTelemetry(input: {
  mapUrl: string;
  formatKey: string;
  autoPlacement: boolean;
  damagePreview: boolean;
  telemetryTeams: readonly TelemetryTeam[];
  teams: readonly TeamSelection[];
  /** Notre place en ligne. Sa seule présence fait le mode `online` (plan 201). */
  localSeat?: number;
  /**
   * L'identifiant tiré par l'hôte et reçu dans le `start` (plan 204). **Absent en local**, où on
   * tire le nôtre : un seul client déclare la partie, il n'y a personne avec qui s'accorder.
   *
   * 🔴 En ligne il est indispensable : les deux pairs émettent chacun leurs événements, et c'est
   * cet identifiant partagé qui permet à l'agrégation de compter UNE partie au lieu de deux, tout
   * en gardant les deux camps que chaque pair déclare de son côté.
   */
  battleId?: string;
}): void {
  const battleId = input.battleId ?? createBattleId();
  const { humans, ai } = countControllers(input.teams);

  trackBattleStarted({
    battleId,
    mode: modeOf(humans, input.localSeat),
    map: mapIdFromUrl(input.mapUrl) ?? MAP_ID_UNKNOWN,
    format: input.formatKey,
    humans,
    ai,
    autoPlacement: input.autoPlacement,
    damagePreview: input.damagePreview,
    aiDifficulties: aiDifficultiesOf(input.teams),
    teams: input.telemetryTeams,
  });

  collector = createBattleTelemetryCollector({
    battleId,
    trackedSources: trackedSourcesOf(input.telemetryTeams),
    startedAt: Date.now(),
    now: () => Date.now(),
  });
}

/** Chaque événement du moteur, s'il y a une partie ouverte. */
export function observeBattleTelemetry(event: BattleEvent): void {
  collector?.observe(event);
}

/**
 * Ferme la partie et émet `battle_ended`, s'il y a de quoi. Une partie quittée en cours ne passe
 * jamais ici — et **l'absence de `battle_ended` est le signal** du taux d'abandon.
 */
export function endBattleTelemetry(): void {
  const payload = collector?.buildEndedPayload();
  collector = null;
  if (payload) {
    trackBattleEnded(payload);
  }
}

/**
 * L'écran de combat confie ce que l'analytique ne peut pas atteindre seule (plans 212, Lots E et F).
 *
 * Appelé quand le combat est **monté**, donc après `beginBattleTelemetry` : l'état de combat n'existe
 * pas encore au moment où le seed est tiré, qui est là où `battle_started` part (décision #857).
 * Sans effet hors d'une partie mesurée — bac à sable, route `?combat=1`, combat repris.
 *
 * Tout ce qu'il reçoit vit sur le COLLECTEUR, qui meurt avec la partie : voir `attachRuntime`.
 */
export function attachBattleRuntime(input: {
  pokemonIds: Iterable<string>;
  localSide: number | null;
  readHealthRatios: () => Record<string, number>;
}): void {
  collector?.attachRuntime(input);
  if (collector !== null) {
    installAbandonOnPageHide();
  }
}

/**
 * Le joueur quitte une partie en cours (plan 212, Lot F).
 *
 * 🔴 **Sans effet si le collecteur a déjà servi**, et c'est toute la garantie d'exclusivité :
 * `endBattleTelemetry` le met à `null`, donc une fermeture d'onglet qui suit une victoire ne produit
 * aucun abandon fantôme. Le collecteur refuse en plus de bâtir un abandon sur une partie terminée —
 * deux verrous pour un double comptage qui rendrait le taux faux sans rien casser de visible.
 */
export function abandonBattleTelemetry(from: AbandonSource): void {
  const payload = collector?.buildAbandonedPayload(from);
  if (!payload) {
    return;
  }
  collector = null;
  trackBattleAbandoned(payload);
}

/**
 * L'onglet se ferme sur une partie en cours. Même choix que la ligne `session` : `pagehide`, qui
 * part vraiment sur mobile, et `sendBeacon` derrière (décisions #888, #889). Aucun second mécanisme
 * de départ n'est inventé ici — `send` fait déjà le travail.
 */
function installAbandonOnPageHide(): void {
  if (abandonOnPageHideInstalled || typeof window === "undefined") {
    return;
  }
  abandonOnPageHideInstalled = true;
  window.addEventListener("pagehide", () => abandonBattleTelemetry(AbandonSource.TabClosed));
}
