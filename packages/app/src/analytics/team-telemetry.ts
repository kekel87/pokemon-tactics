/**
 * Provenance et composition des équipes pour `battle_started` (plan 196, étape 4).
 *
 * 🔴 **On n'envoie la composition que des équipes réellement choisies par un humain** (décision
 * humaine du 2026-08-31). La décision #330 donne à l'IA une équipe aléatoire éphémère par défaut, et
 * un humain peut lui aussi prendre « 🎲 Aléatoire ». Or tant que le multijoueur n'a pas de joueurs,
 * la majorité du trafic sera en solo contre l'IA : envoyer ces compositions injecterait des Pokemon
 * tirés au hasard dans le même pot que les vrais choix, diluant le signal exactement dans la
 * proportion où le solo domine.
 *
 * **Le remède est dans la collecte, pas dans la requête** : une équipe non choisie n'a pas de
 * composition dans le payload, juste sa provenance. Aucun filtre à oublier au moment de lire.
 */

import {
  type BattleState,
  PlayerController,
  type TeamSet,
  type TeamSlot,
} from "@pokemon-tactic/core";
import { t } from "../i18n";
import type { SlotState } from "../ui/team-select/slot-state";
import { TeamSource, type TelemetryTeam, type TelemetryTeamMember } from "./telemetry";

function sourceOf(slot: SlotState): TeamSource {
  if (slot.controller === PlayerController.Human) {
    return slot.ephemeral ? TeamSource.HumanRandom : TeamSource.HumanBuilt;
  }
  return slot.ephemeral ? TeamSource.AiRandom : TeamSource.AiBuilt;
}

/**
 * Une équipe générée par le Team Builder puis **sauvegardée** porte le préfixe de nom du
 * générateur. La resélectionner est un choix — le joueur l'a gardée, peut-être retouchée — donc sa
 * composition compte, mais le drapeau permet de l'écarter à la lecture si on veut ne garder que les
 * équipes bâties à la main.
 */
function isGenerated(team: TeamSet): boolean {
  return team.name.startsWith(t("teamBuilder.randomTeamPrefix"));
}

function memberOf(slot: TeamSet["slots"][number]): TelemetryTeamMember {
  return {
    species: slot.pokemonId,
    ability: slot.ability,
    item: slot.heldItemId ?? null,
    nature: slot.nature,
    moves: [...slot.moveIds],
  };
}

/** Provenance de chaque camp, et composition des seuls camps `human-built`. */
export function buildTelemetryTeams(slots: readonly SlotState[]): TelemetryTeam[] {
  return slots.map((slot, side) => {
    const source = sourceOf(slot);
    const team = slot.assignedTeam;
    if (source !== TeamSource.HumanBuilt || !team) {
      return { side, source };
    }
    return {
      side,
      source,
      generated: isGenerated(team),
      members: team.slots.map(memberOf),
    };
  });
}

/**
 * La composition d'une partie EN LIGNE, telle que ce pair a le droit de la déclarer (plan 201).
 *
 * 🔴 **Notre camp, et lui seul.** Le message `start` porte pourtant la sélection de *chaque* place :
 * le motif n'est donc pas un manque d'information, c'est le **double comptage**. Deux pairs qui
 * déclarent la même partie compteraient chaque équipe deux fois, et les statistiques d'usage à la
 * Showdown — la raison d'être du Lot A — s'en trouveraient fausses partout. Chacun déclare son camp :
 * chaque équipe compte une fois, et le total est juste sans qu'aucun pair ne se coordonne.
 *
 * `generated` est absent, à dessein : il se lit du **nom** de l'équipe sauvegardée, qui ne voyage pas
 * sur le réseau. Mieux vaut un drapeau manquant qu'un drapeau inventé.
 *
 * @param localSeat notre place (1 = l'hôte) ; `side` reste l'index 0-based des autres chemins.
 */
export function buildOnlineTelemetryTeams(
  localSeat: number,
  slots: readonly TeamSlot[] | undefined,
): TelemetryTeam[] {
  const side = localSeat - 1;
  if (slots === undefined || slots.length === 0) {
    // Équipe éphémère (tirée pour nous) : la provenance voyage, la composition non — même règle que
    // `buildTelemetryTeams`, qui ne capture que le `human-built`.
    return [{ side, source: TeamSource.HumanRandom }];
  }
  return [{ side, source: TeamSource.HumanBuilt, members: slots.map(memberOf) }];
}

/**
 * Les camps que `battle_ended` détaillera, et **d'où vient chacun** (plan 212, Lot E).
 *
 * Retenait auparavant les seuls camps dont la composition avait voyagé, c'est-à-dire `human-built`.
 * La production a montré ce que ça coûtait : sur 44 camps observés en 14 jours, **6** l'étaient, et
 * le bilan de deux semaines tenait en une attaque lancée et une cause de K.O. — le pari « attaques
 * emportées ≠ attaques réellement lancées » ne produisait rien.
 *
 * 🔴 **Les équipes tenues par un humain, quelle que soit leur provenance**, mais chacune ÉTIQUETÉE.
 * Une équipe aléatoire ne dit rien du goût du joueur — elle ne doit donc jamais entrer dans les
 * statistiques d'usage — mais elle dit la **force** mieux qu'une équipe bâtie, parce que le Pokemon
 * y a été distribué et non choisi. Le drapeau est ce qui permet au rapport de tenir les deux blocs
 * séparés à la lecture.
 *
 * ⚠️ Jamais les camps de l'IA : personne n'y décide rien, ni la composition ni les attaques.
 */
export function trackedSourcesOf(teams: readonly TelemetryTeam[]): Map<number, TeamSource> {
  const tracked = new Map<number, TeamSource>();
  for (const team of teams) {
    if (team.source === TeamSource.HumanBuilt || team.source === TeamSource.HumanRandom) {
      tracked.set(team.side, team.source);
    }
  }
  return tracked;
}

/**
 * Décompte humains / IA. Prend les `TeamSelection` et non les `SlotState` : c'est ce que le combat
 * reçoit, et le contrôleur y figure déjà — inutile de faire voyager l'état de l'écran de sélection
 * jusque-là.
 */
export function countControllers(teams: readonly { controller: PlayerController }[]): {
  humans: number;
  ai: number;
} {
  const humans = teams.filter((team) => team.controller === PlayerController.Human).length;
  return { humans, ai: teams.length - humans };
}

/**
 * Les PV restants sur PV maximum, par camp, à l'instant de l'appel (plan 212, Lot F).
 *
 * 🔴 Ce que ce ratio sert à distinguer : abandonner **en train de perdre** est un problème
 * d'équilibrage, abandonner **en train de gagner** un problème de rythme. Deux causes, deux
 * correctifs opposés, aujourd'hui indiscernables derrière un taux d'abandon de 77 %.
 *
 * La clé est l'index de camp 0-indexé rendu en chaîne, comme partout ailleurs dans la télémétrie —
 * `player-1` est le camp 0. Un camp entièrement à terre rend 0, un camp intact 1.
 */
export function healthRatiosBySide(state: BattleState): Record<string, number> {
  const current = new Map<number, number>();
  const maximum = new Map<number, number>();
  for (const pokemon of state.pokemon.values()) {
    const side = sideOfPlayerId(pokemon.playerId);
    if (side === null) {
      continue;
    }
    current.set(side, (current.get(side) ?? 0) + pokemon.currentHp);
    maximum.set(side, (maximum.get(side) ?? 0) + pokemon.maxHp);
  }
  const ratios: Record<string, number> = {};
  for (const [side, total] of maximum) {
    // Un camp sans un seul PV maximum n'existe pas, mais le rapport ne survivrait pas à un NaN.
    if (total > 0) {
      ratios[String(side)] = (current.get(side) ?? 0) / total;
    }
  }
  return ratios;
}

/** `player-2` → camp 1. Le préfixe est 1-indexé, les camps de la télémétrie 0-indexés. */
function sideOfPlayerId(playerId: string): number | null {
  const match = /^player-(\d+)$/.exec(playerId);
  if (!match?.[1]) {
    return null;
  }
  return Number(match[1]) - 1;
}

/**
 * Le camp local, quand il n'y en a qu'un (plan 212, Lot F). `null` sinon — en hot-seat, tous les
 * camps sont sur cette machine, et désigner un partant y serait une invention.
 */
export function soleLocalSide(playerIds: readonly string[]): number | null {
  if (playerIds.length !== 1 || playerIds[0] === undefined) {
    return null;
  }
  return sideOfPlayerId(playerIds[0]);
}
