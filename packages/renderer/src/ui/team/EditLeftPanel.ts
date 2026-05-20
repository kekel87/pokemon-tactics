import { type HeldItemId, Nature, PokemonGender, type TeamSlot } from "@pokemon-tactic/core";
import type { TranslationKey } from "../../i18n";
import { t } from "../../i18n";
import { getCategoryIconUrl, getTypeIconUrl } from "../../team/asset-paths";
import { toggleGender } from "../../team/gender-helpers";
import {
  getAbilityInfo,
  getItemInfo,
  getMoveInfo,
  getOpSetsByPokemonId,
  getPlayablePokemonById,
  getPortraitUrl,
  type PlayablePokemon,
} from "../../team/team-builder-data";
import { openItemPickerModal } from "./ItemPickerModal";
import { openMovePickerModal } from "./MovePickerModal";

const NATURE_ORDER: Nature[] = [
  Nature.Adamant,
  Nature.Jolly,
  Nature.Modest,
  Nature.Timid,
  Nature.Brave,
  Nature.Quiet,
  Nature.Bold,
  Nature.Impish,
  Nature.Calm,
  Nature.Careful,
  Nature.Relaxed,
  Nature.Sassy,
  Nature.Hasty,
  Nature.Naive,
  Nature.Serious,
  Nature.Hardy,
  Nature.Docile,
  Nature.Bashful,
  Nature.Quirky,
  Nature.Lonely,
  Nature.Mild,
  Nature.Rash,
  Nature.Gentle,
  Nature.Naughty,
  Nature.Lax,
];

const NATURE_I18N: Record<Nature, TranslationKey> = {
  [Nature.Adamant]: "teamBuilder.nature.adamant",
  [Nature.Jolly]: "teamBuilder.nature.jolly",
  [Nature.Modest]: "teamBuilder.nature.modest",
  [Nature.Timid]: "teamBuilder.nature.timid",
  [Nature.Brave]: "teamBuilder.nature.brave",
  [Nature.Quiet]: "teamBuilder.nature.quiet",
  [Nature.Bold]: "teamBuilder.nature.bold",
  [Nature.Impish]: "teamBuilder.nature.impish",
  [Nature.Calm]: "teamBuilder.nature.calm",
  [Nature.Careful]: "teamBuilder.nature.careful",
  [Nature.Relaxed]: "teamBuilder.nature.relaxed",
  [Nature.Sassy]: "teamBuilder.nature.sassy",
  [Nature.Hasty]: "teamBuilder.nature.hasty",
  [Nature.Naive]: "teamBuilder.nature.naive",
  [Nature.Serious]: "teamBuilder.nature.serious",
  [Nature.Hardy]: "teamBuilder.nature.hardy",
  [Nature.Docile]: "teamBuilder.nature.docile",
  [Nature.Bashful]: "teamBuilder.nature.bashful",
  [Nature.Quirky]: "teamBuilder.nature.quirky",
  [Nature.Lonely]: "teamBuilder.nature.lonely",
  [Nature.Mild]: "teamBuilder.nature.mild",
  [Nature.Rash]: "teamBuilder.nature.rash",
  [Nature.Gentle]: "teamBuilder.nature.gentle",
  [Nature.Naughty]: "teamBuilder.nature.naughty",
  [Nature.Lax]: "teamBuilder.nature.lax",
};

export interface EditLeftPanelCallbacks {
  onAbilityChange: (abilityId: string) => void;
  onItemChange: (itemId: HeldItemId | null) => void;
  onNatureChange: (nature: Nature) => void;
  onMoveChange: (slotIndex: number, moveId: string) => void;
  onSetOpApply: (setId: string) => void;
  onGenderChange: (gender: PokemonGender) => void;
}

export class EditLeftPanel {
  readonly element: HTMLDivElement;
  private documentClickHandler: ((event: MouseEvent) => void) | null = null;
  private openDropdown: HTMLDivElement | null = null;

  constructor(private readonly callbacks: EditLeftPanelCallbacks) {
    this.element = document.createElement("div");
  }

  destroy(): void {
    if (this.documentClickHandler !== null) {
      document.removeEventListener("click", this.documentClickHandler);
      this.documentClickHandler = null;
    }
    this.openDropdown = null;
  }

  render(slot: TeamSlot): void {
    this.openDropdown = null;
    this.element.innerHTML = "";
    const pokemon = getPlayablePokemonById(slot.pokemonId);
    if (pokemon === null) {
      return;
    }

    // Header
    const header = document.createElement("div");
    header.className = "tb-edit-pokemon-header";
    const portrait = document.createElement("div");
    portrait.className = "tb-edit-portrait";
    portrait.style.backgroundImage = `url(${getPortraitUrl(pokemon.id)})`;
    header.appendChild(portrait);
    const info = document.createElement("div");
    info.className = "tb-edit-info";
    const nameRow = document.createElement("div");
    nameRow.className = "tb-edit-name-row";
    const name = document.createElement("div");
    name.className = "tb-edit-name";
    name.textContent = pokemon.name;
    nameRow.appendChild(name);
    const genderToggle = this.renderGenderToggle(pokemon, slot);
    if (genderToggle !== null) {
      nameRow.appendChild(genderToggle);
    }
    info.appendChild(nameRow);
    const sub = document.createElement("div");
    sub.className = "tb-edit-sub";
    for (const type of pokemon.types) {
      const badge = document.createElement("span");
      badge.className = "tb-type-badge";
      badge.dataset.type = type;
      const icon = document.createElement("img");
      icon.src = getTypeIconUrl(type);
      icon.className = "tb-type-icon";
      icon.alt = "";
      badge.appendChild(icon);
      badge.appendChild(document.createTextNode(type));
      sub.appendChild(badge);
    }
    info.appendChild(sub);
    const lvl = document.createElement("div");
    lvl.className = "tb-edit-sub";
    lvl.textContent = "Lv.50";
    info.appendChild(lvl);
    header.appendChild(info);

    // Set OP button (top-right)
    const setOpWrapper = document.createElement("div");
    setOpWrapper.style.marginLeft = "auto";
    setOpWrapper.appendChild(this.renderSetOpButton(slot.pokemonId));
    header.appendChild(setOpWrapper);
    this.element.appendChild(header);

    this.element.appendChild(this.renderAbilitySection(pokemon, slot));
    this.element.appendChild(this.renderItemSection(slot));
    this.element.appendChild(this.renderNatureSection(slot));
    this.element.appendChild(this.renderMovesSection(slot));
  }

  private renderGenderToggle(pokemon: PlayablePokemon, slot: TeamSlot): HTMLElement | null {
    const ratio = pokemon.definition.genderRatio;
    if (ratio === "genderless") {
      return null;
    }
    const maleOnly = ratio.female === 0 && ratio.male > 0;
    const femaleOnly = ratio.male === 0 && ratio.female > 0;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tb-gender-toggle";

    const current = slot.gender ?? (femaleOnly ? PokemonGender.Female : PokemonGender.Male);
    const isFemale = current === PokemonGender.Female;
    button.dataset.gender = isFemale ? "female" : "male";
    button.textContent = isFemale ? "♀" : "♂";
    button.title = t(isFemale ? "teamBuilder.gender.female" : "teamBuilder.gender.male");

    if (maleOnly || femaleOnly) {
      button.disabled = true;
    } else {
      button.addEventListener("click", () => {
        this.callbacks.onGenderChange(toggleGender(current));
      });
    }

    return button;
  }

  private renderSetOpButton(pokemonId: string): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "tb-set-op-wrapper";
    const button = document.createElement("button");
    button.className = "tb-btn";
    button.type = "button";
    button.textContent = t("teamBuilder.setOp");
    const sets = getOpSetsByPokemonId(pokemonId);
    if (sets.length === 0) {
      button.disabled = true;
      button.title = t("teamBuilder.setOpNone");
    }
    const dropdown = document.createElement("div");
    dropdown.className = "tb-set-op-dropdown";

    for (const set of sets) {
      const row = document.createElement("div");
      row.className = "tb-set-op-row";
      const nameEl = document.createElement("div");
      nameEl.className = "name";
      nameEl.textContent = set.name;
      row.appendChild(nameEl);
      const roleEl = document.createElement("div");
      roleEl.className = "role";
      roleEl.textContent = set.role;
      row.appendChild(roleEl);
      row.addEventListener("click", () => {
        this.callbacks.onSetOpApply(set.id);
        delete dropdown.dataset.state;
      });
      dropdown.appendChild(row);
    }

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = dropdown.dataset.state !== "open";
      if (this.openDropdown !== null && this.openDropdown !== dropdown) {
        delete this.openDropdown.dataset.state;
      }
      if (willOpen) {
        dropdown.dataset.state = "open";
        this.openDropdown = dropdown;
      } else {
        delete dropdown.dataset.state;
        this.openDropdown = null;
      }
    });

    if (this.documentClickHandler === null) {
      this.documentClickHandler = (): void => {
        if (this.openDropdown !== null) {
          delete this.openDropdown.dataset.state;
          this.openDropdown = null;
        }
      };
      document.addEventListener("click", this.documentClickHandler);
    }

    wrapper.appendChild(button);
    wrapper.appendChild(dropdown);
    return wrapper;
  }

  private renderAbilitySection(pokemon: PlayablePokemon, slot: TeamSlot): HTMLElement {
    const section = document.createElement("div");
    section.className = "tb-edit-section";
    const title = document.createElement("div");
    title.className = "tb-edit-section-title";
    title.textContent = t("teamBuilder.section.ability");
    section.appendChild(title);
    const group = document.createElement("div");
    group.className = "tb-radio-group";
    for (const abilityId of pokemon.abilities.all) {
      const info = getAbilityInfo(abilityId);
      const option = document.createElement("label");
      option.className = "tb-radio-option";
      if (info !== null && !info.implemented) {
        option.dataset.state = "disabled";
      }
      const description = info?.shortDescription ?? "";
      if (description !== "" || info !== null) {
        option.title =
          info?.implemented === false
            ? `${description}\n(${t("teamBuilder.picker.notImplemented")})`
            : description;
      }
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `ability-${pokemon.id}`;
      input.value = abilityId;
      input.checked = slot.ability === abilityId;
      input.addEventListener("change", () => this.callbacks.onAbilityChange(abilityId));
      option.appendChild(input);
      const span = document.createElement("span");
      span.textContent = info?.name ?? abilityId;
      option.appendChild(span);
      group.appendChild(option);
    }
    if (pokemon.abilities.all.length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "tb-ability-placeholder";
      placeholder.textContent = slot.ability;
      group.appendChild(placeholder);
    }
    section.appendChild(group);
    return section;
  }

  private renderItemSection(slot: TeamSlot): HTMLElement {
    const section = document.createElement("div");
    section.className = "tb-edit-section";
    const title = document.createElement("div");
    title.className = "tb-edit-section-title";
    title.textContent = t("teamBuilder.section.item");
    section.appendChild(title);
    const input = document.createElement("div");
    input.className = "tb-input-clickable";
    if (slot.heldItemId === undefined) {
      input.dataset.state = "empty";
      input.textContent = t("teamBuilder.itemNone");
    } else {
      const info = getItemInfo(slot.heldItemId);
      input.textContent = info?.name ?? slot.heldItemId;
    }
    input.addEventListener("click", () => {
      openItemPickerModal({
        onSelect: (item) => this.callbacks.onItemChange(item === null ? null : item.id),
      });
    });
    section.appendChild(input);
    return section;
  }

  private renderNatureSection(slot: TeamSlot): HTMLElement {
    const section = document.createElement("div");
    section.className = "tb-edit-section";
    const title = document.createElement("div");
    title.className = "tb-edit-section-title";
    title.textContent = t("teamBuilder.section.nature");
    section.appendChild(title);
    const select = document.createElement("select");
    select.className = "tb-select";
    for (const nature of NATURE_ORDER) {
      const option = document.createElement("option");
      option.value = nature;
      option.textContent = t(NATURE_I18N[nature]);
      if (slot.nature === nature) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      this.callbacks.onNatureChange(select.value as Nature);
    });
    section.appendChild(select);
    return section;
  }

  private renderMovesSection(slot: TeamSlot): HTMLElement {
    const section = document.createElement("div");
    section.className = "tb-edit-section";
    const title = document.createElement("div");
    title.className = "tb-edit-section-title";
    title.textContent = t("teamBuilder.section.moves");
    section.appendChild(title);
    const list = document.createElement("div");
    list.className = "tb-moves-list";
    for (let i = 0; i < 4; i++) {
      const moveId = slot.moveIds[i];
      const row = document.createElement("div");
      row.className = "tb-move-row";
      if (moveId === undefined) {
        row.dataset.state = "empty";
      }

      const meta = moveId === undefined ? null : getMoveInfo(moveId);
      const typeIcon = document.createElement("img");
      typeIcon.className = "tb-type-icon";
      typeIcon.alt = meta?.type ?? "";
      if (meta === null) {
        typeIcon.style.visibility = "hidden";
      } else {
        typeIcon.src = getTypeIconUrl(meta.type);
      }
      row.appendChild(typeIcon);

      const catIcon = document.createElement("img");
      catIcon.className = "tb-category-icon";
      catIcon.alt = meta?.category ?? "";
      if (meta === null) {
        catIcon.style.visibility = "hidden";
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
      power.textContent =
        meta?.power !== undefined && meta?.power !== null ? String(meta.power) : "";
      row.appendChild(power);

      const acc = document.createElement("span");
      acc.className = "tb-move-acc";
      acc.textContent =
        meta?.accuracy !== undefined && meta?.accuracy !== null ? `${meta.accuracy}%` : "";
      row.appendChild(acc);

      row.addEventListener("click", () => {
        openMovePickerModal({
          pokemonId: slot.pokemonId,
          slotIndex: i,
          excludeMoveIds: slot.moveIds.filter((_, idx) => idx !== i),
          onSelect: (move) => this.callbacks.onMoveChange(i, move.id),
        });
      });
      list.appendChild(row);
    }
    section.appendChild(list);
    return section;
  }
}
