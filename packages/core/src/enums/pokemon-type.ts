export const PokemonType = {
  Normal: "normal",
  Fire: "fire",
  Water: "water",
  Grass: "grass",
  Electric: "electric",
  Ice: "ice",
  Fighting: "fighting",
  Poison: "poison",
  Ground: "ground",
  Flying: "flying",
  Psychic: "psychic",
  Bug: "bug",
  Rock: "rock",
  Ghost: "ghost",
  Dragon: "dragon",
  Dark: "dark",
  Steel: "steel",
  Fairy: "fairy",
} as const;

export type PokemonType = (typeof PokemonType)[keyof typeof PokemonType];
