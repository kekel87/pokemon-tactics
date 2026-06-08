import { getMoveName } from "@pokemon-tactic/data";
import { getLanguage, t } from "../../i18n";
import { getCategoryIconUrl, getTypeIconUrl } from "../../team/asset-paths";
import {
  type AvailableMove,
  getAllMoveInfos,
  getLearnsetForPokemon,
  getMoveInfo,
} from "../../team/team-builder-data";
import { Modal } from "../dom/Modal";

export interface MovePickerOptions {
  pokemonId: string;
  slotIndex: number;
  excludeMoveIds?: readonly string[];
  /** Offer every implemented move instead of the pokemon's learnset (sandbox dummy). */
  allMoves?: boolean;
  onSelect: (move: AvailableMove) => void;
}

type CategoryFilter = "all" | "physical" | "special" | "status";

interface MoveEntry {
  id: string;
  info: AvailableMove | null;
  implemented: boolean;
}

export function openMovePickerModal(options: MovePickerOptions): void {
  const modal = new Modal({
    title: t("teamBuilder.picker.moveTitle").replace("{n}", String(options.slotIndex + 1)),
    size: "picker",
  });
  const body = modal.getBody();

  const search = document.createElement("input");
  search.type = "text";
  search.className = "tb-picker-search";
  search.placeholder = t("teamBuilder.picker.search");
  body.appendChild(search);

  const categoryRow = document.createElement("div");
  categoryRow.className = "tb-picker-filter-row";
  body.appendChild(categoryRow);

  const typeRow = document.createElement("div");
  typeRow.className = "tb-picker-filter-row";
  body.appendChild(typeRow);

  const list = document.createElement("div");
  list.className = "tb-list";
  body.appendChild(list);

  let category: CategoryFilter = "all";
  const activeTypes = new Set<string>();
  let query = "";

  const excluded = new Set(options.excludeMoveIds ?? []);
  const entries: MoveEntry[] = options.allMoves
    ? getAllMoveInfos().map((info) => ({ id: info.id, info, implemented: true }))
    : getLearnsetForPokemon(options.pokemonId).map((id) => {
        const info = getMoveInfo(id);
        return { id, info, implemented: info !== null };
      });
  entries.sort((a, b) => {
    if (a.implemented !== b.implemented) {
      return a.implemented ? -1 : 1;
    }
    const language = getLanguage();
    const an = getMoveName(a.id, language);
    const bn = getMoveName(b.id, language);
    return an.localeCompare(bn);
  });

  const availableTypes = new Set<string>();
  for (const e of entries) {
    if (e.info !== null) {
      availableTypes.add(e.info.type);
    }
  }

  const renderFilters = (): void => {
    categoryRow.innerHTML = "";
    const items: { key: CategoryFilter; label: string; iconKey: string | null }[] = [
      { key: "all", label: t("teamBuilder.picker.allCategories"), iconKey: null },
      { key: "physical", label: t("teamBuilder.picker.physical"), iconKey: "physical" },
      { key: "special", label: t("teamBuilder.picker.special"), iconKey: "special" },
      { key: "status", label: t("teamBuilder.picker.status"), iconKey: "status" },
    ];
    for (const item of items) {
      const chip = document.createElement("div");
      chip.className = "tb-filter-chip";
      if (category === item.key) {
        chip.dataset.state = "active";
      }
      if (item.iconKey !== null) {
        const icon = document.createElement("img");
        icon.src = getCategoryIconUrl(item.iconKey);
        icon.alt = item.iconKey;
        chip.appendChild(icon);
      }
      const label = document.createElement("span");
      label.textContent = item.label;
      chip.appendChild(label);
      chip.addEventListener("click", () => {
        category = item.key;
        render();
      });
      categoryRow.appendChild(chip);
    }

    typeRow.innerHTML = "";
    const types = Array.from(availableTypes).sort();
    for (const type of types) {
      const chip = document.createElement("div");
      chip.className = "tb-filter-chip";
      chip.dataset.type = type;
      if (activeTypes.has(type)) {
        chip.dataset.state = "active";
      }
      const icon = document.createElement("img");
      icon.src = getTypeIconUrl(type);
      icon.alt = type;
      chip.appendChild(icon);
      const label = document.createElement("span");
      label.textContent = type;
      chip.appendChild(label);
      chip.addEventListener("click", () => {
        if (activeTypes.has(type)) {
          activeTypes.delete(type);
        } else {
          activeTypes.add(type);
        }
        render();
      });
      typeRow.appendChild(chip);
    }
    const reset = document.createElement("div");
    reset.className = "tb-filter-chip";
    reset.dataset.variant = "reset";
    reset.textContent = t("teamBuilder.picker.reset");
    reset.addEventListener("click", () => {
      activeTypes.clear();
      category = "all";
      query = "";
      search.value = "";
      render();
    });
    typeRow.appendChild(reset);
  };

  const render = (): void => {
    renderFilters();
    list.innerHTML = "";
    const filtered = entries.filter((e) => {
      if (excluded.has(e.id)) {
        return false;
      }
      if (e.info === null) {
        if (category !== "all" || activeTypes.size > 0) {
          return false;
        }
        if (query !== "" && !e.id.toLowerCase().includes(query.toLowerCase())) {
          return false;
        }
        return true;
      }
      if (category !== "all" && e.info.category !== category) {
        return false;
      }
      if (activeTypes.size > 0 && !activeTypes.has(e.info.type)) {
        return false;
      }
      if (query !== "" && !e.info.name.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
    for (const entry of filtered) {
      const row = document.createElement("div");
      row.className = "tb-list-row tb-move-list-row";
      if (!entry.implemented) {
        row.dataset.state = "disabled";
      }
      if (entry.info !== null) {
        row.title = entry.info.shortDescription;
      }

      const typeIcon = document.createElement("img");
      typeIcon.className = "tb-type-icon";
      if (entry.info === null) {
        typeIcon.style.visibility = "hidden";
      } else {
        typeIcon.src = getTypeIconUrl(entry.info.type);
        typeIcon.alt = entry.info.type;
      }
      row.appendChild(typeIcon);

      const catIcon = document.createElement("img");
      catIcon.className = "tb-category-icon";
      if (entry.info === null) {
        catIcon.style.visibility = "hidden";
      } else {
        catIcon.src = getCategoryIconUrl(entry.info.category);
        catIcon.alt = entry.info.category;
      }
      row.appendChild(catIcon);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = getMoveName(entry.id, getLanguage());
      row.appendChild(name);

      const power = document.createElement("span");
      power.className = "meta";
      power.textContent =
        entry.info?.power !== undefined && entry.info?.power !== null
          ? String(entry.info.power)
          : "—";
      row.appendChild(power);

      const acc = document.createElement("span");
      acc.className = "meta";
      acc.textContent =
        entry.info?.accuracy !== undefined && entry.info?.accuracy !== null
          ? `${entry.info.accuracy}%`
          : "—";
      row.appendChild(acc);

      if (entry.implemented) {
        const pp = document.createElement("span");
        pp.className = "meta";
        pp.textContent =
          entry.info?.pp !== undefined && entry.info?.pp !== null ? `${entry.info.pp}PP` : "—";
        row.appendChild(pp);
      } else {
        const tag = document.createElement("span");
        tag.className = "meta";
        tag.textContent = t("teamBuilder.picker.notImplemented");
        row.appendChild(tag);
      }

      if (entry.implemented) {
        row.addEventListener("click", () => {
          if (entry.info !== null) {
            options.onSelect(entry.info);
            modal.close();
          }
        });
      }

      list.appendChild(row);
    }
  };

  search.addEventListener("input", () => {
    query = search.value;
    render();
  });

  render();
  search.focus();
}
