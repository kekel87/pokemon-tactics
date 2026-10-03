import movesEn from "./moves.en.json";
import movesEs from "./moves.es.json";
import movesFr from "./moves.fr.json";
import pokemonNamesEnJson from "./pokemon-names.en.json";
import pokemonNamesEs from "./pokemon-names.es.json";
import pokemonNamesFr from "./pokemon-names.fr.json";

const moveNames: Record<string, Record<string, string>> = {
  fr: movesFr,
  en: movesEn,
  es: movesEs,
};

const pokemonNames: Record<string, Record<string, string>> = {
  fr: pokemonNamesFr,
  en: pokemonNamesEnJson,
  es: pokemonNamesEs,
};

const moveNamesEn: Record<string, string> = movesEn;
const pokemonNamesEn: Record<string, string> = pokemonNamesEnJson;

export function getMoveName(moveId: string, language: string): string {
  return moveNames[language]?.[moveId] ?? moveNamesEn[moveId] ?? moveId;
}

export function getPokemonName(pokemonId: string, language: string): string {
  return pokemonNames[language]?.[pokemonId] ?? pokemonNamesEn[pokemonId] ?? pokemonId;
}

export { localizedText } from "./localized-text";
export { getTypeName } from "./type-names";
