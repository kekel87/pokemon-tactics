import { PlayerController, type TeamSet } from "@pokemon-tactic/core";
import { generateRandomTeam } from "./team-generator";

export interface SlotForRefresh {
  controller: PlayerController;
  assignedTeam: TeamSet | null;
  assignedTeamId: string | null;
  ephemeral: boolean;
}

export function refreshAllAiSlots<S extends SlotForRefresh>(
  slots: readonly S[],
  randomTeamName: string,
): S[] {
  return slots.map((slot) => {
    if (slot.controller !== PlayerController.Ai) {
      return slot;
    }
    return {
      ...slot,
      assignedTeam: generateRandomTeam({ name: randomTeamName }),
      assignedTeamId: null,
      ephemeral: true,
    };
  });
}
