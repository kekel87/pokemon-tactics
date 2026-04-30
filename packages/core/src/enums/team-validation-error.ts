export const TeamValidationError = {
  EmptyTeam: "empty_team",
  ExceedsMaxSize: "exceeds_max_size",
  DuplicatePokemon: "duplicate_pokemon",
  UnknownPokemon: "unknown_pokemon",
  DuplicateItem: "duplicate_item",
} as const;

export type TeamValidationError = (typeof TeamValidationError)[keyof typeof TeamValidationError];
