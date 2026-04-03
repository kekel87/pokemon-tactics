import { PlayerController } from "../enums/player-controller";
import { PlayerId } from "../enums/player-id";
import type { TeamSelection } from "../types/team-selection";

export abstract class MockTeamSelection {
  static readonly base: TeamSelection = {
    playerId: PlayerId.Player1,
    pokemonDefinitionIds: [],
    controller: PlayerController.Human,
  };
}
