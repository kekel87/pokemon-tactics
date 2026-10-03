import type { Language, Translations } from "../types";
import en from "./en";
import es from "./es";
import fr from "./fr";

/** Every UI locale, by language — the type makes a language without its locale a build error. */
export const LOCALES: Readonly<Record<Language, Translations>> = { fr, en, es };
