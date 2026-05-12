export const TeamSetValidationErrorKind = {
  DuplicatePokemon: "DuplicatePokemon",
  DuplicateItem: "DuplicateItem",
  DuplicateMove: "DuplicateMove",
  IllegalAbility: "IllegalAbility",
  IllegalMove: "IllegalMove",
  IllegalNature: "IllegalNature",
  IllegalGender: "IllegalGender",
  InvalidStatSpread: "InvalidStatSpread",
  UnknownPokemon: "UnknownPokemon",
  UnknownMove: "UnknownMove",
  UnknownAbility: "UnknownAbility",
  UnknownItem: "UnknownItem",
  EmptyMoveList: "EmptyMoveList",
  TooManyMoves: "TooManyMoves",
  EmptyTeam: "EmptyTeam",
  TooManyMons: "TooManyMons",
} as const;

export type TeamSetValidationErrorKind =
  (typeof TeamSetValidationErrorKind)[keyof typeof TeamSetValidationErrorKind];
