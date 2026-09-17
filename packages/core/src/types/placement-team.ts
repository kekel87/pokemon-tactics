import type { AiDifficulty } from "../enums/ai-difficulty";
import type { PlayerController } from "../enums/player-controller";
import type { PlayerId } from "../enums/player-id";

export interface PlacementTeam {
  playerId: PlayerId;
  availablePokemonIds: readonly string[];
  controller: PlayerController;
  /**
   * Le niveau de l'IA qui tient cette place (plan 214), repris de sa `TeamSelection`. Absent sur une
   * place humaine, et sur toute partie sauvegardée avant le plan 214 — `resolveAiDifficulty` fait
   * atterrir ces cas sur `DEFAULT_AI_DIFFICULTY`.
   */
  aiDifficulty?: AiDifficulty;
}
