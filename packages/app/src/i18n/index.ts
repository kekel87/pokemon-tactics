import en from "./locales/en";
import fr from "./locales/fr";
import type { TranslationKey, Translations } from "./types";
import { Language } from "./types";

export { Language } from "./types";
export type { TranslationKey, Translations };

const LOCALES: Record<Language, Translations> = { fr, en };
const STORAGE_KEY = "pt-lang";

type LanguageChangeCallback = (language: Language) => void;

let currentLanguage: Language = Language.French;
const listeners: Set<LanguageChangeCallback> = new Set();

function isLanguage(value: string): value is Language {
  return value === Language.French || value === Language.English;
}

export function detectLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isLanguage(stored)) {
    return stored;
  }
  const browserLanguages = navigator.languages ?? [navigator.language];
  for (const lang of browserLanguages) {
    if (lang.startsWith("fr")) {
      return Language.French;
    }
  }
  return Language.English;
}

export function initLanguage(): void {
  currentLanguage = detectLanguage();
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: Language): void {
  if (language === currentLanguage) {
    return;
  }
  currentLanguage = language;
  localStorage.setItem(STORAGE_KEY, language);
  for (const callback of listeners) {
    callback(language);
  }
}

export function onLanguageChange(callback: LanguageChangeCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Traduit dans une locale EXPLICITE, sans toucher à la langue courante du module.
 *
 * Extrait de `t()` (plan 190) pour que les appelants qui connaissent déjà leur locale — au premier
 * chef les tests, qui comparent le rendu FR et EN dans le même fichier — n'aient pas à piloter le
 * singleton `currentLanguage` ni son `localStorage`.
 */
export function translateIn(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const own = LOCALES[language][key];
  if (own === undefined && import.meta.env.DEV) {
    /*
     * Le repli sur l'anglais est SILENCIEUX, et c'est un piège mesuré (plan 190 §10) : une clé
     * absente du seul `fr.ts` produit « Attack de Florizarre augmente ! » — de l'anglais dans une
     * phrase française, sans aucune alerte. Le type `Translations` verrouille les clés littérales,
     * mais il ne voit rien des clés COMPOSÉES à l'exécution (`battleLog.status.${status}.applied`),
     * qui n'existent dans aucun type.
     *
     * On garde le repli (mieux qu'une clé brute à l'écran pour le joueur) et on le rend bruyant
     * hors production, là où quelqu'un peut encore le corriger.
     */
    // biome-ignore lint/suspicious/noConsole: diagnostique de développement uniquement — le repli sur l'anglais reste silencieux pour le joueur, et c'est la seule trace d'une clé manquante que le type `Translations` ne peut pas voir (clés composées à l'exécution)
    console.warn(`[i18n] clé absente de « ${language} », repli sur l'anglais : ${key}`);
  }
  let text = own ?? LOCALES.en[key] ?? key;
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replaceAll(`{${paramKey}}`, String(value));
    }
  }
  return text;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translateIn(currentLanguage, key, params);
}
