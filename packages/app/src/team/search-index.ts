// Combining diacritical marks (U+0300–U+036F) left behind by NFD decomposition.
const DIACRITICS = /[\u0300-\u036f]/g;
const SEPARATORS = /[-\s]/g;

/**
 * Accent- and separator-tolerant text normalization for picker search.
 *
 * Lowercases, strips diacritics (é → e) and drops hyphens/spaces so a query like
 * "leviator" matches "Léviator" and "lamederoche" matches "Lame de Roche".
 */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(DIACRITICS, "").replace(SEPARATORS, "");
}

/**
 * Build a normalized search haystack from several terms (FR name, EN name, id).
 * Terms are joined with "|" — never produced by {@link normalizeSearchText} — so a
 * normalized query can never straddle two terms and false-match.
 */
export function buildSearchText(...terms: string[]): string {
  return terms.map(normalizeSearchText).join("|");
}
