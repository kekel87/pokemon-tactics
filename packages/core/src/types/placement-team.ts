import type { PlayerController } from "../enums/player-controller";
import type { PlayerId } from "../enums/player-id";

export interface PlacementTeam {
  playerId: PlayerId;
  availablePokemonIds: readonly string[];
  controller: PlayerController;
}
