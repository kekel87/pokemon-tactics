import type { AiDifficulty } from "../enums/ai-difficulty";
import type { HeldItemId } from "../enums/held-item-id";
import type { PlayerController } from "../enums/player-controller";
import type { PlayerId } from "../enums/player-id";
import type { TeamSlot } from "../team/team-slot";

export interface TeamSelection {
  playerId: PlayerId;
  pokemonDefinitionIds: string[];
  controller: PlayerController;
  /**
   * Le niveau de l'IA qui tient cette place (plan 214). Absent sur une place humaine — et absent des
   * parties sauvegardées AVANT le plan 214, d'où l'optionnalité : `resolveAiDifficulty` les fait
   * toutes atterrir sur `DEFAULT_AI_DIFFICULTY`.
   */
  aiDifficulty?: AiDifficulty;
  heldItems?: Record<string, HeldItemId>;
  slots?: TeamSlot[];
}
