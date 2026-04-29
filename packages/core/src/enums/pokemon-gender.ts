export const PokemonGender = {
  Male: "male",
  Female: "female",
  Genderless: "genderless",
} as const;

export type PokemonGender = (typeof PokemonGender)[keyof typeof PokemonGender];
