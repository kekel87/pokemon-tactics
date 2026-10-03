import type { LocalizedText } from "@pokemon-tactic/core";

/**
 * The text in `language`, falling back to English when that language has none — PokeAPI leaves some
 * descriptions empty outside English (plan 222), and an unknown language code reaches here as a
 * plain `string`.
 */
export function localizedText(text: Readonly<LocalizedText>, language: string): string {
  const own = (text as Readonly<Partial<Record<string, string | null>>>)[language];
  return own || text.en;
}

/** A `LocalizedText` as the reference JSON stores it: PokeAPI has no text in some languages. */
export type ReferenceLocalizedText = Readonly<Record<keyof LocalizedText, string | null>>;

/** Turns the reference's missing texts into empty ones, which `localizedText` reads as "fall back to English". */
export function completeLocalizedText(text: ReferenceLocalizedText): LocalizedText {
  return { fr: text.fr ?? "", en: text.en ?? "", es: text.es ?? "" };
}
