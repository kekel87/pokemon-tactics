import type { PokemonDefinition } from "@pokemon-tactic/core";
import { PokemonType } from "@pokemon-tactic/core";

export const basePokemon: Omit<PokemonDefinition, "id">[] = [
  {
    name: "Bulbasaur",
    types: [PokemonType.Grass, PokemonType.Poison],
    baseStats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    weight: 6.9,
    movepool: ["razor-leaf", "sleep-powder", "leech-seed", "sludge-bomb"],
  },
  {
    name: "Charmander",
    types: [PokemonType.Fire],
    baseStats: { hp: 39, attack: 52, defense: 43, spAttack: 60, spDefense: 50, speed: 65 },
    weight: 8.5,
    movepool: ["ember", "scratch", "smokescreen", "dragon-breath"],
  },
  {
    name: "Squirtle",
    types: [PokemonType.Water],
    baseStats: { hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 43 },
    weight: 9.0,
    movepool: ["water-gun", "tackle", "withdraw", "bubble-beam"],
  },
  {
    name: "Pidgey",
    types: [PokemonType.Normal, PokemonType.Flying],
    baseStats: { hp: 40, attack: 45, defense: 40, spAttack: 35, spDefense: 35, speed: 56 },
    weight: 1.8,
    movepool: ["gust", "quick-attack", "sand-attack", "wing-attack"],
  },
];
