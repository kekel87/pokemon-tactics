import type { PlayerId } from "@pokemon-tactic/core";
import { getPokemonName } from "@pokemon-tactic/data";
import { getLanguage, t } from "../../../i18n";
import { getPortraitUrl } from "../../../team/team-builder-data";
import { teamColorToHex } from "../../team-select/slot-state";

export interface PlacementRosterEntry {
  pokemonId: string;
  definitionId: string;
  placed: boolean;
}

export interface PlacementRosterCallbacks {
  onSelect: (pokemonId: string) => void;
  onFinish?: () => void;
}

export interface PlacementRosterState {
  playerId: PlayerId;
  teamIndex: number;
  roster: PlacementRosterEntry[];
  selectedPokemonId: string | null;
  maxPokemon: number;
}

/**
 * DOM port of the Phaser PlacementRosterPanel (plan 120 step 6): top bar listing
 * the current player's Pokemon (click to pick the next one to place), a
 * placed/remaining counter, and the "Done" button. Minimal chrome — restyled 4b.
 */
export class PlacementRoster {
  readonly element: HTMLElement;
  private callbacks: PlacementRosterCallbacks | null = null;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "pl-roster";
    this.element.hidden = true;
  }

  show(state: PlacementRosterState, callbacks: PlacementRosterCallbacks): void {
    this.callbacks = callbacks;
    this.element.hidden = false;
    // Team colour is runtime data (per active player) — exposed as a CSS custom property.
    this.element.style.setProperty("--pl-team-color", teamColorToHex(state.teamIndex));

    const header = document.createElement("div");
    header.className = "pl-roster-header";
    const playerNumber = state.playerId.match(/player-(\d+)/)?.[1] ?? "1";
    const instruction = document.createElement("span");
    instruction.className = "pl-roster-instruction";
    instruction.textContent = t("placement.instruction", { player: playerNumber });
    const placedCount = state.roster.filter((entry) => entry.placed).length;
    const counter = document.createElement("span");
    counter.className = "pl-roster-counter";
    counter.textContent = t("placement.counter", {
      placed: placedCount,
      max: Math.min(state.roster.length, state.maxPokemon),
    });
    header.append(instruction, counter);

    const list = document.createElement("ul");
    list.className = "pl-roster-list";
    for (const entry of state.roster) {
      list.appendChild(this.buildEntry(entry, entry.pokemonId === state.selectedPokemonId));
    }

    const finish = document.createElement("button");
    finish.type = "button";
    finish.className = "tb-btn pl-roster-finish";
    finish.dataset.variant = "primary";
    finish.textContent = t("placement.done");
    finish.hidden = callbacks.onFinish === undefined;
    finish.addEventListener("click", () => this.callbacks?.onFinish?.());

    this.element.replaceChildren(header, list, finish);
  }

  hide(): void {
    this.element.hidden = true;
    this.element.replaceChildren();
    this.callbacks = null;
  }

  destroy(): void {
    this.element.remove();
  }

  private buildEntry(entry: PlacementRosterEntry, selected: boolean): HTMLLIElement {
    const item = document.createElement("li");
    item.className = "pl-roster-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pl-roster-portrait";
    button.dataset.placed = String(entry.placed);
    button.dataset.selected = String(selected);
    button.disabled = entry.placed;
    button.addEventListener("click", () => this.callbacks?.onSelect(entry.pokemonId));

    const image = document.createElement("img");
    image.className = "pl-roster-portrait-image";
    image.src = getPortraitUrl(entry.definitionId);
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    button.appendChild(image);

    if (entry.placed) {
      const check = document.createElement("span");
      check.className = "pl-roster-check";
      check.textContent = "✓";
      button.appendChild(check);
    }

    const name = document.createElement("span");
    name.className = "pl-roster-name";
    name.textContent = getPokemonName(entry.definitionId, getLanguage());

    item.append(button, name);
    return item;
  }
}
