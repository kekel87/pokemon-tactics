/**
 * Clé de persistance de la langue, isolée dans son propre module pour une seule raison : la balise
 * de visite injectée dans `index.html` (plan 196, décision #889) doit la lire AVANT que le bundle
 * n'existe, donc depuis `vite.config.ts`. Importer `i18n/index.ts` là-bas embarquerait les deux
 * catalogues de traduction dans la configuration de build pour une chaîne de huit caractères.
 */
export const LANGUAGE_STORAGE_KEY = "pt-lang";
