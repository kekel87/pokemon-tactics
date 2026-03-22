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
  UnknownMove: "unknown_move",
  NoPpLeft: "no_pp_left",
  InvalidTarget: "invalid_target",
  MoveNotInMoveset: "move_not_in_moveset",
  AlreadyMoved: "already_moved",
  AlreadyActed: "already_acted",
  BattleOver: "battle_over",
} as const;

export type ActionError = (typeof ActionError)[keyof typeof ActionError];
