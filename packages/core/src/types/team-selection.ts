import type { HeldItemId } from "../enums/held-item-id";
import type { PlayerController } from "../enums/player-controller";
import type { PlayerId } from "../enums/player-id";
import type { TeamSlot } from "../team/team-slot";

export interface TeamSelection {
  playerId: PlayerId;
  pokemonDefinitionIds: string[];
  controller: PlayerController;
  heldItems?: Record<string, HeldItemId>;
  slots?: TeamSlot[];
}
