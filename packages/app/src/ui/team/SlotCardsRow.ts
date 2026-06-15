import type { TeamSlot } from "@pokemon-tactic/core";
import { t } from "../../i18n";
import { getTypeIconUrl } from "../../team/asset-paths";
import { getPlayablePokemonById, getPortraitUrl } from "../../team/team-builder-data";

export interface SlotCardsRowCallbacks {
  onSlotClick: (index: number) => void;
  onSlotClear: (index: number) => void;
}

interface SlotElement {
  wrapper: HTMLDivElement;
  card: HTMLButtonElement;
  clear: HTMLButtonElement;
}

export class SlotCardsRow {
  readonly element: HTMLDivElement;
  private slots: SlotElement[] = [];

  constructor(private readonly callbacks: SlotCardsRowCallbacks) {
    this.element = document.createElement("div");
    this.element.className = "tb-slots-row";
    for (let i = 0; i < 6; i++) {
      const wrapper = document.createElement("div");
      wrapper.className = "tb-slot";

      const card = document.createElement("button");
      card.type = "button";
      card.className = "tb-slot-card";
      card.dataset.testid = "team-slot-card";
      card.addEventListener("click", () => this.callbacks.onSlotClick(i));
      wrapper.appendChild(card);

      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "tb-slot-card-clear";
      clear.setAttribute("aria-label", t("teamBuilder.aria.clearSlot"));
      clear.textContent = "×";
      clear.hidden = true;
      clear.addEventListener("click", (event) => {
        event.stopPropagation();
        this.callbacks.onSlotClear(i);
      });
      wrapper.appendChild(clear);

      this.element.appendChild(wrapper);
      this.slots.push({ wrapper, card, clear });
    }
  }

  render(slots: ReadonlyArray<TeamSlot | undefined>, activeIndex: number): void {
    for (let i = 0; i < 6; i++) {
      const elements = this.slots[i];
      if (elements === undefined) {
        continue;
      }
      const slot = slots[i];
      const { card, clear } = elements;
      card.innerHTML = "";
      const state = slot === undefined ? "empty" : i === activeIndex ? "active" : "filled";
      card.dataset.state = state;
      clear.hidden = slot === undefined;
      if (slot === undefined) {
        const plus = document.createElement("div");
        plus.className = "tb-slot-card-plus";
        plus.textContent = "+";
        card.appendChild(plus);
        const label = document.createElement("div");
        label.className = "tb-slot-card-label";
        label.textContent = t("teamBuilder.slot").replace("{n}", String(i + 1));
        card.appendChild(label);
        continue;
      }
      const pokemon = getPlayablePokemonById(slot.pokemonId);
      const portrait = document.createElement("div");
      portrait.className = "tb-slot-card-portrait";
      portrait.style.backgroundImage = `url(${getPortraitUrl(slot.pokemonId)})`;
      card.appendChild(portrait);
      const name = document.createElement("div");
      name.className = "tb-slot-card-name";
      name.textContent = pokemon?.name ?? slot.pokemonId;
      card.appendChild(name);
      if (pokemon !== null) {
        const types = document.createElement("div");
        types.className = "tb-slot-card-types";
        for (const type of pokemon.types) {
          const badge = document.createElement("span");
          badge.className = "tb-type-badge";
          badge.dataset.type = type;
          const icon = document.createElement("img");
          icon.src = getTypeIconUrl(type);
          icon.className = "tb-type-icon";
          icon.alt = "";
          icon.loading = "lazy";
          icon.decoding = "async";
          badge.appendChild(icon);
          badge.appendChild(document.createTextNode(type));
          types.appendChild(badge);
        }
        card.appendChild(types);
      }
    }
  }
}
