import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";
import { getTypeIconUrl } from "../../team/asset-paths";
import {
  getPlayablePokemon,
  getPortraitUrl,
  type PlayablePokemon,
} from "../../team/team-builder-data";

export interface PokemonPickerOptions {
  onSelect: (pokemon: PlayablePokemon) => void;
  excludePokemonIds?: readonly string[];
}

const TYPE_FILTERS = [
  "normal",
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

const GEN_FILTERS = [
  { id: "gen1", min: 1, max: 151, label: "Gen 1" },
  { id: "gen2", min: 152, max: 251, label: "Gen 2" },
  { id: "gen3", min: 252, max: 386, label: "Gen 3" },
  { id: "gen4", min: 387, max: 493, label: "Gen 4" },
  { id: "gen5", min: 494, max: 649, label: "Gen 5" },
  { id: "gen6", min: 650, max: 721, label: "Gen 6" },
  { id: "gen7", min: 722, max: 809, label: "Gen 7" },
  { id: "gen8", min: 810, max: 905, label: "Gen 8" },
  { id: "gen9", min: 906, max: 1025, label: "Gen 9" },
];

export function openPokemonPickerModal(options: PokemonPickerOptions): void {
  const excluded = new Set(options.excludePokemonIds ?? []);
  const modal = new Modal({
    title: t("teamBuilder.picker.pokemonTitle"),
    closeAriaLabel: t("teamBuilder.aria.close"),
    size: "picker",
  });
  const body = modal.getBody();

  const search = document.createElement("input");
  search.type = "text";
  search.className = "tb-picker-search";
  search.placeholder = t("teamBuilder.picker.search");
  body.appendChild(search);

  const typeRow = document.createElement("div");
  typeRow.className = "tb-picker-filter-row";
  body.appendChild(typeRow);

  const genRow = document.createElement("div");
  genRow.className = "tb-picker-filter-row";
  body.appendChild(genRow);

  const grid = document.createElement("div");
  grid.className = "tb-pokemon-grid";
  body.appendChild(grid);

  const activeTypes = new Set<string>();
  let activeGen: string | null = null;
  let query = "";

  const availableTypes = new Set<string>();
  for (const p of getPlayablePokemon()) {
    for (const type of p.types) {
      availableTypes.add(type);
    }
  }
  const availableGens = new Set<string>();
  for (const p of getPlayablePokemon()) {
    const gen = GEN_FILTERS.find((g) => p.dexNumber >= g.min && p.dexNumber <= g.max);
    if (gen !== undefined) {
      availableGens.add(gen.id);
    }
  }

  const renderFilters = (): void => {
    typeRow.innerHTML = "";
    for (const type of TYPE_FILTERS) {
      const chip = document.createElement("div");
      chip.className = "tb-filter-chip";
      chip.dataset.type = type;
      if (!availableTypes.has(type)) {
        chip.dataset.state = "disabled";
      } else if (activeTypes.has(type)) {
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
        if (!availableTypes.has(type)) {
          return;
        }
        if (activeTypes.has(type)) {
          activeTypes.delete(type);
        } else {
          activeTypes.add(type);
        }
        render();
      });
      typeRow.appendChild(chip);
    }

    genRow.innerHTML = "";
    for (const gen of GEN_FILTERS) {
      const chip = document.createElement("div");
      chip.className = "tb-filter-chip";
      if (!availableGens.has(gen.id)) {
        chip.dataset.state = "disabled";
      } else if (activeGen === gen.id) {
        chip.dataset.state = "active";
      }
      chip.textContent = gen.label;
      chip.addEventListener("click", () => {
        if (!availableGens.has(gen.id)) {
          return;
        }
        activeGen = activeGen === gen.id ? null : gen.id;
        render();
      });
      genRow.appendChild(chip);
    }
    const reset = document.createElement("div");
    reset.className = "tb-filter-chip";
    reset.dataset.variant = "reset";
    reset.textContent = t("teamBuilder.picker.reset");
    reset.addEventListener("click", () => {
      activeTypes.clear();
      activeGen = null;
      query = "";
      search.value = "";
      render();
    });
    genRow.appendChild(reset);
  };

  const render = (): void => {
    renderFilters();
    grid.innerHTML = "";
    const genRange = activeGen === null ? null : GEN_FILTERS.find((g) => g.id === activeGen);
    const pool = getPlayablePokemon().filter((p) => {
      if (activeTypes.size > 0) {
        const matches = p.types.some((tp) => activeTypes.has(tp));
        if (!matches) {
          return false;
        }
      }
      if (genRange !== null && genRange !== undefined) {
        if (p.dexNumber < genRange.min || p.dexNumber > genRange.max) {
          return false;
        }
      }
      if (query !== "" && !p.name.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
    for (const pokemon of pool) {
      const cell = document.createElement("div");
      const isExcluded = excluded.has(pokemon.id);
      cell.className = "tb-pokemon-cell";
      if (isExcluded) {
        cell.dataset.state = "disabled";
      }
      const portrait = document.createElement("div");
      portrait.className = "tb-pokemon-cell-portrait";
      portrait.style.backgroundImage = `url(${getPortraitUrl(pokemon.id)})`;
      cell.appendChild(portrait);
      const name = document.createElement("div");
      name.className = "tb-pokemon-cell-name";
      name.textContent = pokemon.name;
      cell.appendChild(name);
      if (!isExcluded) {
        cell.addEventListener("click", () => {
          options.onSelect(pokemon);
          modal.close();
        });
      }
      grid.appendChild(cell);
    }
  };

  search.addEventListener("input", () => {
    query = search.value;
    render();
  });

  render();
  search.focus();
}
