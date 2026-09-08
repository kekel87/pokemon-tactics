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

import { PlayerController, type TeamSet, type TeamSlot } from "@pokemon-tactic/core";
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

/** Camps dont la composition a voyagé — les seuls que `battle_ended` détaillera. */
export function trackedSidesOf(teams: readonly TelemetryTeam[]): Set<number> {
  return new Set(teams.filter((team) => team.members !== undefined).map((team) => team.side));
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
