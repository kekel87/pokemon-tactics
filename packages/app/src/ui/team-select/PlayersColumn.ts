import {
  createPlayerCellElement,
  type PlayerCellCallbacks,
  type PlayerCellProps,
} from "./PlayerCell";

export interface PlayerColumnEntry {
  props: PlayerCellProps;
  callbacks: PlayerCellCallbacks;
}

/** Au-delà de ce nombre de camps, la grille passe à deux colonnes (retour humain 2026-08-25). */
const TWO_COLUMNS_ABOVE = 6;

/**
 * Les cartes de camp, en une grille d'une ou deux colonnes (plan 188).
 *
 * Le `side` (`"left"` / `"right"`) a disparu avec la liste d'équipes centrale : il ne servait qu'à
 * répartir les camps de part et d'autre d'elle. Le dédoublement qui le remplace n'a pas le même
 * motif — ce n'est plus la liste à contourner, c'est la hauteur des cartes.
 */
export function createPlayersColumnElement(entries: readonly PlayerColumnEntry[]): HTMLElement {
  const column = document.createElement("div");
  column.className = "ts-players-column";
  // Deux colonnes au-delà de 6 camps. Le seuil est le même qu'avant le plan 188, mais le motif a
  // changé : ce n'était plus la liste d'équipes centrale à contourner, c'est la HAUTEUR des cartes,
  // qui portent désormais un segment sur sa propre rangée et une rangée de portraits. À 12 camps,
  // une colonne unique déborderait sans qu'on voie plus de deux ou trois camps à la fois.
  column.dataset.layout = entries.length > TWO_COLUMNS_ABOVE ? "two" : "one";
  for (const entry of entries) {
    column.appendChild(createPlayerCellElement(entry.props, entry.callbacks));
  }
  return column;
}
