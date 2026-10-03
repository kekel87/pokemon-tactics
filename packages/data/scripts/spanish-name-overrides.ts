/**
 * Official Spanish names missing from PokeAPI (plan 222). Source: WikiDex (https://www.wikidex.net), Spain
 * variant when Spain and Latin America differ. Applied by build-reference.ts only when PokeAPI has no "es" entry.
 */
export const SPANISH_MOVE_NAMES: Readonly<Record<string, string>> = {
  "axe-kick": "Patada Hacha",
  "chilling-water": "Agua Fría",
  "ice-spinner": "Pirueta Helada",
  "last-respects": "Homenaje Póstumo",
  pounce: "Brinco",
  "rage-fist": "Puño Furia",
  "raging-bull": "Furia Taurina",
  "raging-fury": "Erupción de Ira",
  snowscape: "Paisaje Nevado",
  trailblaze: "Abrecaminos",
  "wave-crash": "Envite Acuático",
};

export const SPANISH_ABILITY_NAMES: Readonly<Record<string, string>> = {
  dragonize: "Piel Dragontina",
  "mega-sol": "Megasolar",
  "piercing-drill": "Turbotaladro",
  "spicy-spray": "Salpicante",
};
