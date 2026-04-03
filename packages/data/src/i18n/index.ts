import movesFr from "./moves.fr.json";
import movesEn from "./moves.en.json";
import pokemonNamesFr from "./pokemon-names.fr.json";
import pokemonNamesEn from "./pokemon-names.en.json";

const moveNames: Record<string, Record<string, string>> = {
  fr: movesFr,
  en: movesEn,
};

const pokemonNames: Record<string, Record<string, string>> = {
  fr: pokemonNamesFr,
  en: pokemonNamesEn,
};

export function getMoveName(moveId: string, language: string): string {
  return moveNames[language]?.[moveId] ?? moveNames.en[moveId] ?? moveId;
}

export function getPokemonName(pokemonId: string, language: string): string {
  return pokemonNames[language]?.[pokemonId] ?? pokemonNames.en[pokemonId] ?? pokemonId;
}
