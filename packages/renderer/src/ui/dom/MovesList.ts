import { t } from "../../i18n";
import { getCategoryIconUrl, getTypeIconUrl } from "../../team/asset-paths";
import { getMoveInfo } from "../../team/team-builder-data";
import { openMovePickerModal } from "../team/MovePickerModal";

export interface CreateMovesListOptions {
  pokemonId: string;
  moves: string[];
  slotsCount?: number;
  onChange: (slotIndex: number, moveId: string) => void;
  signal?: AbortSignal;
}

export interface MovesList {
  element: HTMLDivElement;
  refresh: (pokemonId: string, moves: string[]) => void;
}

const DEFAULT_SLOTS = 4;

export function createMovesList(options: CreateMovesListOptions): MovesList {
  const slotsCount = options.slotsCount ?? DEFAULT_SLOTS;
  let currentPokemonId = options.pokemonId;
  let currentMoves = [...options.moves];

  const list = document.createElement("div");
  list.className = "tb-moves-list";

  const rows: HTMLDivElement[] = [];

  const renderRow = (index: number): void => {
    const row = rows[index];
    if (row === undefined) {
      return;
    }
    row.replaceChildren();
    const moveId = currentMoves[index];
    const meta = moveId === undefined || moveId === "" ? null : getMoveInfo(moveId);

    if (meta === null) {
      row.dataset.state = "empty";
    } else {
      delete row.dataset.state;
    }

    const typeIcon = document.createElement("img");
    typeIcon.className = "tb-type-icon";
    typeIcon.loading = "lazy";
    typeIcon.decoding = "async";
    typeIcon.alt = meta?.type ?? "";
    if (meta === null) {
      typeIcon.hidden = true;
    } else {
      typeIcon.src = getTypeIconUrl(meta.type);
    }
    row.appendChild(typeIcon);

    const catIcon = document.createElement("img");
    catIcon.className = "tb-category-icon";
    catIcon.loading = "lazy";
    catIcon.decoding = "async";
    catIcon.alt = meta?.category ?? "";
    if (meta === null) {
      catIcon.hidden = true;
    } else {
      catIcon.src = getCategoryIconUrl(meta.category);
    }
    row.appendChild(catIcon);

    const name = document.createElement("span");
    name.className = "tb-move-name";
    name.textContent = meta?.name ?? t("teamBuilder.moveNone");
    if (meta !== null) {
      name.title = meta.shortDescription;
    }
    row.appendChild(name);

    const power = document.createElement("span");
    power.className = "tb-move-power";
    power.textContent = meta?.power !== undefined && meta?.power !== null ? String(meta.power) : "";
    row.appendChild(power);

    const acc = document.createElement("span");
    acc.className = "tb-move-acc";
    acc.textContent =
      meta?.accuracy !== undefined && meta?.accuracy !== null ? `${meta.accuracy}%` : "";
    row.appendChild(acc);
  };

  const openPicker = (slotIndex: number): void => {
    if (currentPokemonId === "") {
      return;
    }
    const excludeMoveIds = currentMoves.filter((id, idx) => id !== "" && idx !== slotIndex);
    openMovePickerModal({
      pokemonId: currentPokemonId,
      slotIndex,
      excludeMoveIds,
      onSelect: (move) => {
        currentMoves[slotIndex] = move.id;
        renderRow(slotIndex);
        options.onChange(slotIndex, move.id);
      },
    });
  };

  for (let i = 0; i < slotsCount; i++) {
    const row = document.createElement("div");
    row.className = "tb-move-row";
    row.addEventListener("click", () => openPicker(i), { signal: options.signal });
    rows.push(row);
    list.appendChild(row);
  }

  while (currentMoves.length < slotsCount) {
    currentMoves.push("");
  }
  for (let i = 0; i < slotsCount; i++) {
    renderRow(i);
  }

  return {
    element: list,
    refresh: (pokemonId: string, moves: string[]): void => {
      currentPokemonId = pokemonId;
      currentMoves = [...moves];
      while (currentMoves.length < slotsCount) {
        currentMoves.push("");
      }
      for (let i = 0; i < slotsCount; i++) {
        renderRow(i);
      }
    },
  };
}
