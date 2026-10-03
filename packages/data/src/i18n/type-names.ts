import type { LocalizedText, PokemonType } from "@pokemon-tactic/core";
import { localizedText } from "./localized-text";

/**
 * Localised elemental-type names — the SINGLE source for every UI that names a type in text
 * (InfoPanel chips, move tooltip, tile-info immunities, battle log). Sits next to `getMoveName` /
 * `getPokemonName` because a type name is content, like a move name, and every consumer
 * (`view-core`, `ui-dom`, the app shell) can reach `@pokemon-tactic/data`.
 *
 * Kept as one `Record<PokemonType, …>` rather than one object per language so the compiler enforces
 * exhaustiveness: a type added in Gen 2+ fails to build instead of silently rendering its raw id.
 * Type ICONS stay separate (`getTypeIconUrl`, host-injected asset paths).
 */
const TYPE_NAMES: Record<PokemonType, Readonly<LocalizedText>> = {
  normal: { fr: "Normal", en: "Normal", es: "Normal" },
  fire: { fr: "Feu", en: "Fire", es: "Fuego" },
  water: { fr: "Eau", en: "Water", es: "Agua" },
  grass: { fr: "Plante", en: "Grass", es: "Planta" },
  electric: { fr: "Électrik", en: "Electric", es: "Eléctrico" },
  ice: { fr: "Glace", en: "Ice", es: "Hielo" },
  fighting: { fr: "Combat", en: "Fighting", es: "Lucha" },
  poison: { fr: "Poison", en: "Poison", es: "Veneno" },
  ground: { fr: "Sol", en: "Ground", es: "Tierra" },
  flying: { fr: "Vol", en: "Flying", es: "Volador" },
  psychic: { fr: "Psy", en: "Psychic", es: "Psíquico" },
  bug: { fr: "Insecte", en: "Bug", es: "Bicho" },
  rock: { fr: "Roche", en: "Rock", es: "Roca" },
  ghost: { fr: "Spectre", en: "Ghost", es: "Fantasma" },
  dragon: { fr: "Dragon", en: "Dragon", es: "Dragón" },
  dark: { fr: "Ténèbres", en: "Dark", es: "Siniestro" },
  steel: { fr: "Acier", en: "Steel", es: "Acero" },
  fairy: { fr: "Fée", en: "Fairy", es: "Hada" },
};

/**
 * Localised name of an elemental type; falls back to the raw id for an unknown one (the parameter is
 * a `string`, so an id from outside the union can reach this at runtime).
 *
 * Read through a `Partial` view rather than casting the key to `PokemonType`: the cast would tell the
 * compiler the lookup always succeeds and turn the guard below into apparently dead code, exactly the
 * unsound indexing `strict` exists to prevent.
 */
const TYPE_NAMES_BY_ID: Partial<Record<string, Readonly<LocalizedText>>> = TYPE_NAMES;

export function getTypeName(typeId: string, language: string): string {
  const entry = TYPE_NAMES_BY_ID[typeId];
  if (!entry) {
    return typeId;
  }
  return localizedText(entry, language);
}
