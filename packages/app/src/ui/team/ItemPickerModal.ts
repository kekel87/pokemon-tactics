import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";
import { InputSource } from "../../input/input-source";
import { normalizeSearchText } from "../../team/search-index";
import {
  type AvailableItem,
  getAllAvailableItems,
  getItemIconUrl,
} from "../../team/team-builder-data";
import { renderPreservingFocus } from "../dom/preserve-focus";
import { focusPickerEntry } from "./picker-focus";

export interface ItemPickerOptions {
  onSelect: (item: AvailableItem | null) => void;
}

type CategoryFilter = "all" | "offensive" | "defensive" | "berry" | "other";

function classifyCategory(category: string): CategoryFilter {
  const c = category.toLowerCase();
  if (c.includes("berry")) {
    return "berry";
  }
  if (c.includes("offens")) {
    return "offensive";
  }
  if (c.includes("defens")) {
    return "defensive";
  }
  return "other";
}

export function openItemPickerModal(options: ItemPickerOptions): void {
  const modal = new Modal({
    title: t("teamBuilder.picker.itemTitle"),
    closeAriaLabel: t("teamBuilder.aria.close"),
    size: "picker",
  });
  const body = modal.getBody();

  const search = document.createElement("input");
  search.type = "text";
  search.className = "tb-picker-search";
  search.placeholder = t("teamBuilder.picker.search");
  // Sauté par la navigation MANETTE (plan 188, décision humaine 2026-08-26 : pas de saisie au pad).
  // Une manette ne peut pas taper, donc s'y arrêter est un cul-de-sac ; tout ce qui compte reste
  // atteignable autrement — ici les chips de filtre. `data-nav-skip` est le mécanisme du plan 186.
  search.dataset.navSkip = InputSource.Gamepad;
  body.appendChild(search);

  const filters = document.createElement("div");
  filters.className = "tb-picker-filters";
  body.appendChild(filters);

  const list = document.createElement("div");
  list.className = "tb-list";
  list.dataset.testid = "item-picker-list";
  body.appendChild(list);

  let category: CategoryFilter = "all";
  let query = "";

  const renderFilters = (): void => {
    filters.innerHTML = "";
    const items: { key: CategoryFilter; label: string }[] = [
      { key: "all", label: t("teamBuilder.picker.itemAll") },
      { key: "offensive", label: t("teamBuilder.picker.itemOffensive") },
      { key: "defensive", label: t("teamBuilder.picker.itemDefensive") },
      { key: "berry", label: t("teamBuilder.picker.itemBerries") },
      { key: "other", label: t("teamBuilder.picker.itemOther") },
    ];
    for (const item of items) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tb-filter-chip";
      if (category === item.key) {
        chip.dataset.state = "active";
      }
      chip.textContent = item.label;
      chip.addEventListener("click", () => {
        category = item.key;
        render();
      });
      filters.appendChild(chip);
    }
  };

  // Envelopé pour que cliquer un chip de filtre ne renvoie pas le focus au `<body>` (retour humain
  // 2026-08-26). `body` est la racine du contenu de la modale, donc couvre filtres ET résultats.
  const render = (): void => renderPreservingFocus(body, renderNow);

  const renderNow = (): void => {
    renderFilters();
    list.innerHTML = "";

    const clearRow = document.createElement("button");
    clearRow.type = "button";
    clearRow.className = "tb-list-row tb-item-list-row-clear";
    clearRow.textContent = t("teamBuilder.itemNone");
    clearRow.addEventListener("click", () => {
      options.onSelect(null);
      modal.close();
    });
    list.appendChild(clearRow);

    const normalizedQuery = normalizeSearchText(query);
    const filtered = getAllAvailableItems().filter((i) => {
      if (category !== "all" && classifyCategory(i.category) !== category) {
        return false;
      }
      if (normalizedQuery !== "" && !i.searchText.includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
    for (const item of filtered) {
      const row = document.createElement("button");
      row.type = "button";
      // `tb-item-list-row` porte la grille (icône / texte / étiquette) en CSS, et
      // `tb-item-list-row-text` la colonne de texte — les deux étaient en styles inline, ce que
      // les règles du projet interdisent.
      row.className = "tb-list-row tb-item-list-row";
      row.dataset.testid = "item-picker-row";
      row.dataset.itemId = item.id;
      // `disabled` réel plutôt qu'un `data-state` : c'est ce que `focusableControls()` lit pour ne
      // pas proposer un objet non implémenté au clavier / à la manette (plan 188, trou A).
      row.disabled = !item.implemented;
      // Icône officielle de l'objet (demande humaine 2026-08-06), même source que l'InfoPanel.
      const icon = document.createElement("img");
      icon.className = "tb-item-icon";
      icon.src = getItemIconUrl(item.id);
      icon.alt = "";
      icon.loading = "lazy";
      icon.decoding = "async";
      row.appendChild(icon);
      const left = document.createElement("div");
      left.className = "tb-item-list-row-text";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = item.name;
      left.appendChild(name);
      const desc = document.createElement("span");
      desc.className = "meta";
      desc.textContent = item.shortDescription;
      left.appendChild(desc);
      row.appendChild(left);
      if (item.implemented) {
        const filler = document.createElement("span");
        row.appendChild(filler);
      } else {
        const tag = document.createElement("span");
        tag.className = "meta";
        tag.textContent = t("teamBuilder.picker.notImplemented");
        row.appendChild(tag);
      }
      row.addEventListener("click", () => {
        options.onSelect(item);
        modal.close();
      });
      list.appendChild(row);
    }
  };

  search.addEventListener("input", () => {
    query = search.value;
    render();
  });

  render();
  focusPickerEntry(search, () => list.querySelector<HTMLElement>("button:not(:disabled)"));
}
