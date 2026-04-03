import type { PlayerController } from "../enums/player-controller";
import type { PlayerId } from "../enums/player-id";

export interface TeamSelection {
  playerId: PlayerId;
  pokemonDefinitionIds: string[];
  controller: PlayerController;
}
