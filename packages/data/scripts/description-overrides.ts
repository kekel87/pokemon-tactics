/**
 * Descriptions written for the game when our mechanic deliberately departs from both PokeAPI and
 * Champions — usually a grid adaptation of "adjacent". Applied last, after the Champions overrides, to
 * the short AND long description in every language (plan 223).
 */
export const ABILITY_DESCRIPTION_OVERRIDES: Readonly<
  Record<string, { readonly en: string; readonly fr: string; readonly es: string }>
> = {
  // Champions rolls 50% for adjacent allies; on a grid we keep a radius of 2 tiles.
  healer: {
    en: "At the end of each turn, 50% chance to cure the major status of each ally within 2 tiles.",
    fr: "En fin de tour, 50 % de chances de soigner le statut majeur de chaque allié à 2 cases ou moins.",
    es: "Al final de cada turno, 50 % de probabilidad de curar el problema de estado de cada aliado a 2 casillas o menos.",
  },
};
