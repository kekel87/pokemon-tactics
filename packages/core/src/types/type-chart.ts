import type { PokemonType } from "../enums/pokemon-type";

export type TypeChart = Record<PokemonType, Record<PokemonType, number>>;
