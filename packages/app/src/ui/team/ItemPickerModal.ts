import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";
import { type AvailableItem, getAllAvailableItems } from "../../team/team-builder-data";

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
  body.appendChild(search);

  const filters = document.createElement("div");
  filters.className = "tb-picker-filters";
  body.appendChild(filters);

  const list = document.createElement("div");
  list.className = "tb-list";
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
      const chip = document.createElement("div");
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

  const render = (): void => {
    renderFilters();
    list.innerHTML = "";

    const clearRow = document.createElement("div");
    clearRow.className = "tb-list-row";
    clearRow.style.gridTemplateColumns = "1fr";
    clearRow.textContent = t("teamBuilder.itemNone");
    clearRow.addEventListener("click", () => {
      options.onSelect(null);
      modal.close();
    });
    list.appendChild(clearRow);

    const filtered = getAllAvailableItems().filter((i) => {
      if (category !== "all" && classifyCategory(i.category) !== category) {
        return false;
      }
      if (query !== "" && !i.name.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
    for (const item of filtered) {
      const row = document.createElement("div");
      row.className = "tb-list-row";
      row.style.gridTemplateColumns = "minmax(0,1fr) auto";
      if (!item.implemented) {
        row.dataset.state = "disabled";
      }
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = item.name;
      left.appendChild(name);
      const desc = document.createElement("span");
      desc.className = "meta";
      desc.style.textAlign = "left";
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
        if (!item.implemented) {
          return;
        }
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
  search.focus();
}
