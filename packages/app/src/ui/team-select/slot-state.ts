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
 * Team-select slot state and operations, shared between the Phaser
 * TeamSelectScene and the DOM team-select screen (plan 120 step 4) until the
 * Phaser path is removed (J5).
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

/** Slot 1 = human (restoring its last team), others = AI with a random team. */
export function buildInitialSlots(format: MapFormat): SlotState[] {
  const lastSelection = loadLastSelection();
  const slots: SlotState[] = [];
  for (let i = 0; i < format.teamCount; i++) {
    const controller = i === 0 ? PlayerController.Human : PlayerController.Ai;
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
      const lastId = lastSelection[i];
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

/** Human ↔ AI; switching to AI rolls a random team, to human clears the slot. */
export function toggleSlotController(slot: SlotState): void {
  if (slot.controller === PlayerController.Human) {
    slot.controller = PlayerController.Ai;
    slot.assignedTeam = generateRandomTeam({ name: ephemeralTeamName() });
    slot.assignedTeamId = null;
    slot.ephemeral = true;
  } else {
    slot.controller = PlayerController.Human;
    slot.assignedTeam = null;
    slot.assignedTeamId = null;
    slot.ephemeral = false;
  }
}

/**
 * Assign a saved team (or a fresh random one when `teamId` is null).
 * Returns false when the saved team no longer exists.
 */
export function assignTeamToSlot(
  slot: SlotState,
  slotIndex: number,
  teamId: string | null,
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
  if (slot.controller === PlayerController.Human) {
    saveLastSelectionEntry(slotIndex, teamId);
  }
  return true;
}
