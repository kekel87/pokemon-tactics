import {
  type MapFormat,
  PlayerController,
  PlayerId,
  type TeamSelection,
  type TeamSet,
} from "@pokemon-tactic/core";
import { t } from "../../i18n";
import type { TranslationKey } from "../../i18n/types";
import { loadLastSelection, saveLastSelectionEntry } from "../../team/last-selection";
import { generateRandomTeam } from "../../team/team-generator";
import { loadTeam } from "../../team/team-storage";

/**
 * L'état d'un camp sur l'écran de sélection d'équipe (plan 120 étape 4).
 *
 * Déclaré ICI depuis le plan 188 : la forme vivait dans `refresh-ai-teams.ts` comme contrainte du
 * helper « Remplir IA », supprimé avec son bouton (décision humaine 2026-08-26). Le type était la
 * seule chose de ce fichier encore utilisée — le garder là aurait laissé un fichier dont le nom ne
 * décrit plus rien.
 */
export interface SlotState {
  controller: PlayerController;
  assignedTeam: TeamSet | null;
  assignedTeamId: string | null;
  ephemeral: boolean;
}

export const PLAYER_IDS: readonly PlayerId[] = [
  PlayerId.Player1,
  PlayerId.Player2,
  PlayerId.Player3,
  PlayerId.Player4,
  PlayerId.Player5,
  PlayerId.Player6,
  PlayerId.Player7,
  PlayerId.Player8,
  PlayerId.Player9,
  PlayerId.Player10,
  PlayerId.Player11,
  PlayerId.Player12,
];

/** Slots → battle TeamSelection list, or null while any slot is missing a team. */
export function buildTeamSelections(slots: readonly SlotState[]): TeamSelection[] | null {
  const teams: TeamSelection[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const playerId = PLAYER_IDS[i];
    if (!slot || !playerId || slot.assignedTeam === null) {
      return null;
    }
    teams.push({
      playerId,
      pokemonDefinitionIds: slot.assignedTeam.slots.map((s) => s.pokemonId),
      controller: slot.controller,
      slots: [...slot.assignedTeam.slots],
    });
  }
  return teams;
}

export { teamColorToHex } from "@pokemon-tactic/render-ports";

export function playerLabel(slotIndex: number): string {
  const key = `teamSelect.player${slotIndex + 1}` as TranslationKey;
  return t(key);
}

export function playerShortLabel(slotIndex: number): string {
  return `J${slotIndex + 1}`;
}

export function ephemeralTeamName(): string {
  return t("teamSelect.teams.random");
}

/**
 * L'entrée de `lastSelection` qui porte la dernière équipe **du joueur assis devant cet écran**.
 *
 * Le stockage est indexé par camp, ce qui a un sens en hot-seat local — chaque camp retient la
 * sienne — et **aucun** en ligne, où le camp du joueur local n'est qu'un numéro de place tiré par
 * l'ordre d'arrivée. Un invité assis à la place 3 lisait `lastSelection[2]`, c'est-à-dire sa dernière
 * équipe du *troisième camp d'une partie locale* : quasi toujours vide, et sans rapport avec lui.
 *
 * Sa ligne lit et écrit donc ici, à l'entrée que la partie locale ordinaire utilise déjà pour le
 * premier camp — soit, dans les deux cas, « la dernière équipe de la personne devant l'écran ».
 */
const LOCAL_PLAYER_SELECTION_SLOT = 0;

/**
 * Slot 1 = human (restoring its last team), others = AI with a random team.
 *
 * @param humanIndex quelle ligne est celle du joueur local. `0` en partie locale, où c'est toujours
 * le premier camp. **En ligne, c'est la place de l'invité** (plan 199) : un invité assis à la place 3
 * doit voir sa propre ligne en humaine avec sa dernière équipe, pas la première ligne, qui est celle
 * de l'hôte.
 */
export function buildInitialSlots(format: MapFormat, humanIndex = 0): SlotState[] {
  const lastSelection = loadLastSelection();
  const slots: SlotState[] = [];
  for (let i = 0; i < format.teamCount; i++) {
    const controller = i === humanIndex ? PlayerController.Human : PlayerController.Ai;
    const slot: SlotState = {
      controller,
      assignedTeam: null,
      assignedTeamId: null,
      ephemeral: false,
    };
    if (controller === PlayerController.Ai) {
      slot.assignedTeam = generateRandomTeam({ name: ephemeralTeamName() });
      slot.assignedTeamId = null;
      slot.ephemeral = true;
    } else {
      const lastId = lastSelection[LOCAL_PLAYER_SELECTION_SLOT];
      if (lastId !== undefined) {
        const team = loadTeam(lastId);
        if (team !== null) {
          slot.assignedTeam = team;
          slot.assignedTeamId = lastId;
          slot.ephemeral = false;
        }
      }
    }
    slots.push(slot);
  }
  return slots;
}

/**
 * Pose le contrôleur d'un camp ; passer à l'IA tire une équipe aléatoire, passer à l'humain vide le
 * camp. Renvoie `false` quand le camp était déjà sur ce contrôleur, donc que rien n'a bougé.
 *
 * Une POSE et non une bascule depuis le plan 188 (décision #831) : le segment affiche les deux états
 * en permanence, donc chaque bouton désigne une cible précise. Une bascule y serait fausse — presser
 * « Humain » sur un camp déjà humain le donnerait à l'IA, et c'est exactement le contresens que le
 * bouton unique produisait.
 */
export function setSlotController(slot: SlotState, controller: PlayerController): boolean {
  if (slot.controller === controller) {
    return false;
  }
  slot.controller = controller;
  if (controller === PlayerController.Ai) {
    slot.assignedTeam = generateRandomTeam({ name: ephemeralTeamName() });
    slot.assignedTeamId = null;
    slot.ephemeral = true;
  } else {
    slot.assignedTeam = null;
    slot.assignedTeamId = null;
    slot.ephemeral = false;
  }
  return true;
}

/**
 * Assign a saved team (or a fresh random one when `teamId` is null).
 * Returns false when the saved team no longer exists.
 *
 * @param humanIndex la ligne du joueur local, comme pour `buildInitialSlots`. Elle seule écrit dans
 * `LOCAL_PLAYER_SELECTION_SLOT`, ce qui garde la lecture et l'écriture du même côté : sans ça, un
 * invité rangeait son équipe sous son numéro de place et la relisait sous zéro.
 */
export function assignTeamToSlot(
  slot: SlotState,
  slotIndex: number,
  teamId: string | null,
  humanIndex = 0,
): boolean {
  if (teamId === null) {
    slot.assignedTeam = generateRandomTeam({ name: ephemeralTeamName() });
    slot.assignedTeamId = null;
    slot.ephemeral = true;
    return true;
  }
  const team = loadTeam(teamId);
  if (team === null) {
    return false;
  }
  slot.assignedTeam = team;
  slot.assignedTeamId = teamId;
  slot.ephemeral = false;
  /*
   * Seule la ligne du joueur local est retenue. Les autres lignes humaines — le hot-seat local, où
   * l'hôte bascule un camp en « Humain » — écrivaient sous leur propre index une entrée que
   * `buildInitialSlots` ne relit jamais : il ne restaure que la ligne du joueur local. C'était une
   * écriture morte avant ce correctif, elle l'aurait encore été après.
   */
  if (slot.controller === PlayerController.Human && slotIndex === humanIndex) {
    saveLastSelectionEntry(LOCAL_PLAYER_SELECTION_SLOT, teamId);
  }
  return true;
}
