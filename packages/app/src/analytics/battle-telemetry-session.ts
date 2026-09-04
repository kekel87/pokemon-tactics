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
import { mapIdFromUrl } from "../maps/map-identity";
import { type BattleTelemetryCollector, createBattleTelemetryCollector } from "./battle-telemetry";
import { countControllers, trackedSidesOf } from "./team-telemetry";
import {
  createBattleId,
  type TelemetryTeam,
  trackBattleEnded,
  trackBattleStarted,
} from "./telemetry";

let collector: BattleTelemetryCollector | null = null;

/**
 * Modes de la V1. `online` et `story` viendront avec le Lot B et la Phase 9 ; les distinguer
 * demande une information que l'écran de sélection ne porte pas encore.
 */
function modeOf(humans: number): string {
  return humans >= 2 ? "local-hotseat" : "local-vs-ai";
}

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
  telemetryTeams: readonly TelemetryTeam[];
  teams: readonly TeamSelection[];
}): void {
  const battleId = createBattleId();
  const { humans, ai } = countControllers(input.teams);

  trackBattleStarted({
    battleId,
    mode: modeOf(humans),
    map: mapIdFromUrl(input.mapUrl),
    format: input.formatKey,
    humans,
    ai,
    autoPlacement: input.autoPlacement,
    teams: input.telemetryTeams,
  });

  collector = createBattleTelemetryCollector({
    battleId,
    trackedSides: trackedSidesOf(input.telemetryTeams),
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
