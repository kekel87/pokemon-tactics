import type { PlayerId } from "@pokemon-tactic/core";
import { getPokemonName } from "@pokemon-tactic/data";
import { teamColorToHex } from "@pokemon-tactic/render-ports";
import type { UiDomConfig } from "./config.js";

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
 * DOM placement roster panel (plan 120 step 6): top bar listing
 * the current player's Pokemon (click to pick the next one to place), a
 * placed/remaining counter, and the "Done" button. Minimal chrome — restyled 4b.
 */
export class PlacementRoster {
  /** Bouton « Terminer », pour que le clavier puisse l'atteindre (plan 184). */
  private finishButton: HTMLButtonElement | null = null;

  readonly element: HTMLElement;
  private callbacks: PlacementRosterCallbacks | null = null;
  private readonly config: UiDomConfig;

  constructor(config: UiDomConfig) {
    this.config = config;
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
    const instruction = document.createElement("h2");
    instruction.className = "pl-roster-instruction";
    instruction.textContent = this.config.translate("placement.instruction", {
      player: playerNumber,
    });
    const placedCount = state.roster.filter((entry) => entry.placed).length;
    const counter = document.createElement("span");
    counter.className = "pl-roster-counter";
    counter.textContent = this.config.translate("placement.counter", {
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
    finish.textContent = this.config.translate("placement.done");
    finish.hidden = callbacks.onFinish === undefined;
    finish.addEventListener("click", () => this.callbacks?.onFinish?.());
    this.finishButton = finish;

    this.element.replaceChildren(header, list, finish);
  }

  /**
   * Donne le focus au bouton « Terminer » s'il est proposé (plan 184). Le placement se pilote au
   * plateau, donc les flèches n'y déplacent aucun focus DOM : sans ce point d'entrée, « Terminer »
   * était inatteignable au clavier et une équipe incomplète ne pouvait pas être validée.
   */
  focusFinish(): boolean {
    if (this.finishButton === null || this.finishButton.hidden) {
      return false;
    }
    this.finishButton.focus();
    return true;
  }

  /** Le bouton « Terminer » détient-il le focus ? (le navigateur l'activera lui-même à l'Espace) */
  isFinishFocused(): boolean {
    return this.finishButton !== null && document.activeElement === this.finishButton;
  }

  /** Clique « Terminer » (manette : aucune activation native ne suit un appui de pad). */
  activateFinish(): void {
    this.finishButton?.click();
  }

  /** Rend le focus au plateau : plus aucun contrôle du roster ne le détient. */
  blurFinish(): void {
    if (this.isFinishFocused()) {
      this.finishButton?.blur();
    }
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
    image.src = this.config.getPortraitUrl(entry.definitionId);
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
    name.textContent = getPokemonName(entry.definitionId, this.config.getLanguage());

    item.append(button, name);
    return item;
  }
}
