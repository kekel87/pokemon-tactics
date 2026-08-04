import type { PokemonType } from "@pokemon-tactic/core";

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
const TYPE_NAMES: Record<PokemonType, { readonly fr: string; readonly en: string }> = {
  normal: { fr: "Normal", en: "Normal" },
  fire: { fr: "Feu", en: "Fire" },
  water: { fr: "Eau", en: "Water" },
  grass: { fr: "Plante", en: "Grass" },
  electric: { fr: "Électrik", en: "Electric" },
  ice: { fr: "Glace", en: "Ice" },
  fighting: { fr: "Combat", en: "Fighting" },
  poison: { fr: "Poison", en: "Poison" },
  ground: { fr: "Sol", en: "Ground" },
  flying: { fr: "Vol", en: "Flying" },
  psychic: { fr: "Psy", en: "Psychic" },
  bug: { fr: "Insecte", en: "Bug" },
  rock: { fr: "Roche", en: "Rock" },
  ghost: { fr: "Spectre", en: "Ghost" },
  dragon: { fr: "Dragon", en: "Dragon" },
  dark: { fr: "Ténèbres", en: "Dark" },
  steel: { fr: "Acier", en: "Steel" },
  fairy: { fr: "Fée", en: "Fairy" },
};

/**
 * Localised name of an elemental type; falls back to the raw id for an unknown one (the parameter is
 * a `string`, so an id from outside the union can reach this at runtime).
 *
 * Read through a `Partial` view rather than casting the key to `PokemonType`: the cast would tell the
 * compiler the lookup always succeeds and turn the guard below into apparently dead code, exactly the
 * unsound indexing `strict` exists to prevent.
 */
const TYPE_NAMES_BY_ID: Partial<Record<string, { readonly fr: string; readonly en: string }>> =
  TYPE_NAMES;

export function getTypeName(typeId: string, language: string): string {
  const entry = TYPE_NAMES_BY_ID[typeId];
  if (!entry) {
    return typeId;
  }
  return language === "fr" ? entry.fr : entry.en;
}
