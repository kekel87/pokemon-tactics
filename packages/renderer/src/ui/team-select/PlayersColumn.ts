import {
  createPlayerCellElement,
  type PlayerCellCallbacks,
  type PlayerCellProps,
} from "./PlayerCell";

export interface PlayerColumnEntry {
  props: PlayerCellProps;
  callbacks: PlayerCellCallbacks;
}

export function createPlayersColumnElement(
  entries: readonly PlayerColumnEntry[],
  side: "left" | "right",
): HTMLElement {
  const column = document.createElement("aside");
  column.className = "ts-players-column";
  column.dataset.side = side;
  for (const entry of entries) {
    column.appendChild(createPlayerCellElement(entry.props, entry.callbacks));
  }
  return column;
}
