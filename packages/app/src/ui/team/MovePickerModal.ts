import { CT_TEMPO_MAX } from "@pokemon-tactic/core";
import { getMoveName, getTypeName } from "@pokemon-tactic/data";
import { Modal } from "@pokemon-tactic/ui-dom";
import { getLanguage, t } from "../../i18n";
import { InputSource } from "../../input/input-source";
import { getCategoryIconUrl, getTypeIconUrl } from "../../team/asset-paths";
import { buildSearchText, normalizeSearchText } from "../../team/search-index";
import {
  type AvailableMove,
  getAllMoveInfos,
  getLearnsetForPokemon,
  getMoveInfo,
} from "../../team/team-builder-data";
import { renderPreservingFocus } from "../dom/preserve-focus";
import { focusPickerEntry } from "./picker-focus";

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
  /** Normalized FR+EN+id haystack; unimplemented moves fall back to i18n names + id. */
  searchText: string;
}

export function openMovePickerModal(options: MovePickerOptions): void {
  const modal = new Modal({
    title: t("teamBuilder.picker.moveTitle").replace("{n}", String(options.slotIndex + 1)),
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
    ? getAllMoveInfos().map((info) => ({
        id: info.id,
        info,
        implemented: true,
        searchText: info.searchText,
      }))
    : getLearnsetForPokemon(options.pokemonId).map((id) => {
        const info = getMoveInfo(id);
        return {
          id,
          info,
          implemented: info !== null,
          searchText:
            info?.searchText ?? buildSearchText(getMoveName(id, "fr"), getMoveName(id, "en"), id),
        };
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
      const chip = document.createElement("button");
      chip.type = "button";
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
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tb-filter-chip";
      chip.dataset.type = type;
      // Same test contract as the Pokemon picker's chips, whose label is localised — testid to
      // locate, `data-type` (stable EN id) to pick one. Le `<button>` remplace le `<div>` cliquable
      // depuis le plan 188 : un chip inatteignable au focus n'existait pas pour la manette.
      chip.dataset.testid = "move-type-filter";
      if (activeTypes.has(type)) {
        chip.dataset.state = "active";
      }
      // Localised name, not the raw English id (plan 179) — `getTypeName` is the single source
      // since plan 178.
      const typeName = getTypeName(type, getLanguage());
      const icon = document.createElement("img");
      icon.src = getTypeIconUrl(type);
      icon.alt = typeName;
      chip.appendChild(icon);
      const label = document.createElement("span");
      label.textContent = typeName;
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
    const reset = document.createElement("button");
    reset.type = "button";
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

  // Envelopé pour que cliquer un chip de filtre ne renvoie pas le focus au `<body>` (retour humain
  // 2026-08-26). `body` est la racine du contenu de la modale, donc couvre filtres ET résultats.
  const render = (): void => renderPreservingFocus(body, renderNow);

  const renderNow = (): void => {
    renderFilters();
    list.innerHTML = "";
    const normalizedQuery = normalizeSearchText(query);
    const filtered = entries.filter((e) => {
      if (excluded.has(e.id)) {
        return false;
      }
      if (normalizedQuery !== "" && !e.searchText.includes(normalizedQuery)) {
        return false;
      }
      if (e.info === null) {
        return category === "all" && activeTypes.size === 0;
      }
      if (category !== "all" && e.info.category !== category) {
        return false;
      }
      if (activeTypes.size > 0 && !activeTypes.has(e.info.type)) {
        return false;
      }
      return true;
    });
    for (const entry of filtered) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "tb-list-row tb-move-list-row";
      // `disabled` réel plutôt qu'un `data-state` : c'est ce que `focusableControls()` lit pour ne
      // pas proposer une capacité non implémentée au clavier / à la manette (plan 188, trou A).
      row.disabled = !entry.implemented;
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

      // PP usage was removed (Charge Time regulates move frequency). Show the CT "tempo" instead:
      // filled pips = how heavy the move's cost is (heavier → acts again later).
      if (entry.implemented) {
        const tempo = document.createElement("span");
        tempo.className = "meta tb-move-tempo";
        const pips = entry.info?.costTempo ?? 0;
        tempo.dataset.tempo = String(pips);
        tempo.textContent = "●".repeat(pips) + "○".repeat(Math.max(0, CT_TEMPO_MAX - pips));
        tempo.setAttribute("role", "img");
        tempo.setAttribute("aria-label", `Tempo ${pips}/${CT_TEMPO_MAX}`);
        row.appendChild(tempo);
      } else {
        const tag = document.createElement("span");
        tag.className = "meta";
        tag.textContent = t("teamBuilder.picker.notImplemented");
        row.appendChild(tag);
      }

      row.addEventListener("click", () => {
        if (entry.info !== null) {
          options.onSelect(entry.info);
          modal.close();
        }
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
