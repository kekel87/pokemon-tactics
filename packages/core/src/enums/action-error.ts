export const ActionError = {
  NotYourTurn: "not_your_turn",
  WrongPokemon: "wrong_pokemon",
  NotImplemented: "not_implemented",
  EmptyPath: "empty_path",
  PathTooLong: "path_too_long",
  NonAdjacentStep: "non_adjacent_step",
  OutOfBounds: "out_of_bounds",
  ImpassableTile: "impassable_tile",
  JumpTooHigh: "jump_too_high",
  BlockedByEnemy: "blocked_by_enemy",
  DestinationOccupied: "destination_occupied",
} as const;

export type ActionError = (typeof ActionError)[keyof typeof ActionError];
