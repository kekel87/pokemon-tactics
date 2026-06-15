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

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const translations = LOCALES[currentLanguage];
  let text = translations[key] ?? LOCALES.en[key] ?? key;
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replaceAll(`{${paramKey}}`, String(value));
    }
  }
  return text;
}
