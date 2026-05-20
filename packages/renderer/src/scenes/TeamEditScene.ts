import type {
  HeldItemId,
  Nature,
  PokemonGender,
  StatSpread,
  TeamSet,
  TeamSlot,
} from "@pokemon-tactic/core";
import { t } from "../i18n";
import { resolveSlotGender } from "../team/gender-helpers";
import { getOpSetsByPokemonId } from "../team/team-builder-data";
import { SaveDebouncer, touchTeam } from "../team/team-helpers";
import { loadTeam, saveTeam } from "../team/team-storage";
import { EditLeftPanel } from "../ui/team/EditLeftPanel";
import { EditRightPanel } from "../ui/team/EditRightPanel";
import { openPokemonPickerModal } from "../ui/team/PokemonPickerModal";
import { openShowdownIoModal } from "../ui/team/ShowdownIoModal";
import { SlotCardsRow } from "../ui/team/SlotCardsRow";

export interface TeamEditSceneData {
  teamId: string;
}

export class TeamEditScene extends Phaser.Scene {
  private root: HTMLDivElement | null = null;
  private team: TeamSet | null = null;
  private activeSlotIndex = 0;
  private slotsRow: SlotCardsRow | null = null;
  private leftPanel: EditLeftPanel | null = null;
  private rightPanel: EditRightPanel | null = null;
  private savedIndicator: HTMLDivElement | null = null;
  private countLabel: HTMLDivElement | null = null;
  private readonly saveDebouncer = new SaveDebouncer(300);

  constructor() {
    super("TeamEditScene");
  }

  init(data: TeamEditSceneData): void {
    const team = loadTeam(data.teamId);
    this.team = team;
    this.activeSlotIndex = team === null ? 0 : Math.max(0, team.slots.length - 1);
  }

  create(): void {
    this.saveDebouncer.onSaved(() => this.flashSaved());
    this.mountRoot();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveDebouncer.flush();
      this.leftPanel?.destroy();
      this.unmountRoot();
    });
  }

  private mountRoot(): void {
    this.unmountRoot();
    const root = document.createElement("div");
    root.className = "tb-root";
    root.dataset.scene = "TeamEditScene";

    const topbar = document.createElement("div");
    topbar.className = "tb-topbar";

    const backBtn = document.createElement("button");
    backBtn.className = "tb-btn";
    backBtn.dataset.variant = "ghost";
    backBtn.type = "button";
    backBtn.textContent = t("teamBuilder.back");
    backBtn.addEventListener("click", () => this.scene.start("MyTeamsScene"));
    topbar.appendChild(backBtn);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "tb-topbar-name-input";
    nameInput.value = this.team?.name ?? t("teamBuilder.untitledTeam");
    nameInput.addEventListener("input", () => {
      if (this.team === null) {
        return;
      }
      this.team = touchTeam({ ...this.team, name: nameInput.value });
      this.saveDebouncer.schedule(this.team);
    });
    topbar.appendChild(nameInput);

    const countLabel = document.createElement("div");
    countLabel.className = "tb-topbar-count";
    topbar.appendChild(countLabel);
    this.countLabel = countLabel;

    const spacer = document.createElement("div");
    spacer.className = "tb-topbar-spacer";
    topbar.appendChild(spacer);

    const savedIndicator = document.createElement("div");
    savedIndicator.className = "tb-topbar-saved";
    savedIndicator.textContent = t("teamBuilder.saved");
    topbar.appendChild(savedIndicator);
    this.savedIndicator = savedIndicator;

    const showdownBtn = document.createElement("button");
    showdownBtn.className = "tb-btn";
    showdownBtn.type = "button";
    showdownBtn.textContent = t("teamBuilder.showdown");
    showdownBtn.addEventListener("click", () => {
      if (this.team === null) {
        return;
      }
      openShowdownIoModal({
        team: this.team,
        mode: "export",
        onImport: (imported) => {
          this.team = imported;
          saveTeam(imported);
          this.renderAll();
        },
      });
    });
    topbar.appendChild(showdownBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className = "tb-btn";
    clearBtn.dataset.variant = "danger";
    clearBtn.type = "button";
    clearBtn.textContent = t("teamBuilder.clearAll");
    clearBtn.addEventListener("click", () => this.clearAll());
    topbar.appendChild(clearBtn);

    root.appendChild(topbar);

    const content = document.createElement("div");
    content.className = "tb-content";
    root.appendChild(content);

    this.slotsRow = new SlotCardsRow({
      onSlotClick: (i) => this.handleSlotClick(i),
      onSlotClear: (i) => this.handleSlotClear(i),
    });
    content.appendChild(this.slotsRow.element);

    this.leftPanel = new EditLeftPanel({
      onAbilityChange: (id) => this.handleAbilityChange(id),
      onItemChange: (id) => this.handleItemChange(id),
      onNatureChange: (n) => this.handleNatureChange(n),
      onMoveChange: (idx, id) => this.handleMoveChange(idx, id),
      onSetOpApply: (setId) => this.handleSetOpApply(setId),
      onGenderChange: (g) => this.handleGenderChange(g),
    });
    this.rightPanel = new EditRightPanel({
      onSpChange: (sp) => this.handleSpChange(sp),
      onPresetApply: (sp) => this.handleSpChange(sp),
    });

    const editGrid = document.createElement("div");
    editGrid.className = "tb-edit-grid";
    editGrid.appendChild(this.leftPanel.element);
    editGrid.appendChild(this.rightPanel.element);
    content.appendChild(editGrid);

    document.body.appendChild(root);
    this.root = root;

    this.renderAll();
  }

  private unmountRoot(): void {
    if (this.root !== null) {
      this.root.remove();
      this.root = null;
    }
  }

  private renderAll(): void {
    if (this.team === null || this.slotsRow === null) {
      return;
    }
    const slots: Array<TeamSlot | undefined> = [];
    for (let i = 0; i < 6; i++) {
      slots.push(this.team.slots[i]);
    }
    this.slotsRow.render(slots, this.activeSlotIndex);
    if (this.countLabel !== null) {
      this.countLabel.textContent = t("teamBuilder.slotCount").replace(
        "{count}",
        String(this.team.slots.length),
      );
    }
    const activeSlot: TeamSlot | undefined = this.team.slots[this.activeSlotIndex];
    if (activeSlot === undefined) {
      this.renderEmptyEdit();
    } else {
      this.leftPanel?.render(activeSlot);
      this.rightPanel?.render(activeSlot);
    }
  }

  private renderEmptyEdit(): void {
    if (this.leftPanel !== null) {
      this.leftPanel.element.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.className = "tb-edit-empty";
      const title = document.createElement("div");
      title.className = "tb-edit-empty-title";
      title.textContent = t("teamBuilder.startTitle");
      wrapper.appendChild(title);
      const hint = document.createElement("div");
      hint.textContent = t("teamBuilder.startHint");
      wrapper.appendChild(hint);
      this.leftPanel.element.appendChild(wrapper);
    }
    if (this.rightPanel !== null) {
      this.rightPanel.element.innerHTML = "";
    }
  }

  private flashSaved(): void {
    if (this.savedIndicator === null) {
      return;
    }
    this.savedIndicator.dataset.visible = "true";
    setTimeout(() => {
      if (this.savedIndicator !== null) {
        this.savedIndicator.dataset.visible = "false";
      }
    }, 1000);
  }

  private commitTeam(team: TeamSet): void {
    this.team = touchTeam(team);
    this.saveDebouncer.schedule(this.team);
    this.renderAll();
  }

  private commitStatsOnly(team: TeamSet): void {
    this.team = touchTeam(team);
    this.saveDebouncer.schedule(this.team);
    if (this.team === null) {
      return;
    }
    const activeSlot = this.team.slots[this.activeSlotIndex];
    if (activeSlot !== undefined) {
      this.rightPanel?.render(activeSlot);
    }
  }

  private handleSlotClick(index: number): void {
    if (this.team === null) {
      return;
    }
    const slot = this.team.slots[index];
    if (slot === undefined) {
      openPokemonPickerModal({
        excludePokemonIds: this.team.slots.map((s) => s.pokemonId),
        onSelect: (pokemon) => {
          if (this.team === null) {
            return;
          }
          const fallbackAbility = pokemon.abilities.primary ?? pokemon.definition.abilityId ?? "";
          const newSlot: TeamSlot = {
            pokemonId: pokemon.id,
            ability: fallbackAbility,
            nature: "hardy" as Nature,
            moveIds: [],
            statSpread: {},
          };
          const defaultGender = resolveSlotGender(pokemon.id, undefined);
          if (defaultGender !== undefined) {
            newSlot.gender = defaultGender;
          }
          const slots = [...this.team.slots];
          if (slots.length <= index) {
            slots.push(newSlot);
          } else {
            slots[index] = newSlot;
          }
          this.activeSlotIndex = index;
          this.commitTeam({ ...this.team, slots });
        },
      });
      return;
    }
    this.activeSlotIndex = index;
    this.renderAll();
  }

  private handleSlotClear(index: number): void {
    if (this.team === null) {
      return;
    }
    const slots = this.team.slots.filter((_, i) => i !== index);
    this.activeSlotIndex = Math.min(this.activeSlotIndex, Math.max(0, slots.length - 1));
    this.commitTeam({ ...this.team, slots });
  }

  private updateActiveSlot(mutate: (slot: TeamSlot) => TeamSlot): void {
    if (this.team === null) {
      return;
    }
    const slots = [...this.team.slots];
    const slot = slots[this.activeSlotIndex];
    if (slot === undefined) {
      return;
    }
    slots[this.activeSlotIndex] = mutate(slot);
    this.commitTeam({ ...this.team, slots });
  }

  private handleAbilityChange(abilityId: string): void {
    this.updateActiveSlot((slot) => ({ ...slot, ability: abilityId }));
  }

  private handleItemChange(itemId: HeldItemId | null): void {
    this.updateActiveSlot((slot) => {
      const next = { ...slot };
      if (itemId === null) {
        next.heldItemId = undefined;
      } else {
        next.heldItemId = itemId;
      }
      return next;
    });
  }

  private handleGenderChange(gender: PokemonGender): void {
    this.updateActiveSlot((slot) => ({ ...slot, gender }));
  }

  private handleNatureChange(nature: Nature): void {
    if (this.team === null) {
      return;
    }
    const slots = [...this.team.slots];
    const slot = slots[this.activeSlotIndex];
    if (slot === undefined) {
      return;
    }
    slots[this.activeSlotIndex] = { ...slot, nature };
    this.commitStatsOnly({ ...this.team, slots });
  }

  private handleMoveChange(index: number, moveId: string): void {
    this.updateActiveSlot((slot) => {
      const moves = [...slot.moveIds];
      while (moves.length <= index) {
        moves.push("");
      }
      moves[index] = moveId;
      return { ...slot, moveIds: moves.filter((m) => m !== "") };
    });
  }

  private handleSpChange(statSpread: StatSpread): void {
    if (this.team === null) {
      return;
    }
    const slots = [...this.team.slots];
    const slot = slots[this.activeSlotIndex];
    if (slot === undefined) {
      return;
    }
    slots[this.activeSlotIndex] = { ...slot, statSpread };
    this.commitStatsOnly({ ...this.team, slots });
  }

  private handleSetOpApply(setId: string): void {
    this.updateActiveSlot((slot) => {
      const sets = getOpSetsByPokemonId(slot.pokemonId);
      const set = sets.find((s) => s.id === setId);
      if (set === undefined) {
        return slot;
      }
      const next: TeamSlot = {
        pokemonId: slot.pokemonId,
        ability: set.ability,
        nature: set.nature,
        moveIds: [...set.moveIds].slice(0, 4),
        statSpread: { ...set.statSpread },
      };
      if (set.heldItemId !== null) {
        next.heldItemId = set.heldItemId;
      }
      const gender = resolveSlotGender(slot.pokemonId, slot.gender);
      if (gender !== undefined) {
        next.gender = gender;
      }
      return next;
    });
  }

  private clearAll(): void {
    if (this.team === null) {
      return;
    }
    this.commitTeam({ ...this.team, slots: [] });
    this.activeSlotIndex = 0;
    this.renderAll();
  }
}
