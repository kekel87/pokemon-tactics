import {
  type BattleState,
  PlayerId,
  type PokemonDefinition,
  type PokemonInstance,
  StatusType,
} from "@pokemon-tactic/core";
import {
  DEPTH_TIMELINE,
  PORTRAIT_SIZE,
  TEAM_COLOR_PLAYER_1,
  TEAM_COLOR_PLAYER_2,
  TIMELINE_ACTIVE_BORDER_COLOR,
  TIMELINE_ACTIVE_BORDER_WIDTH,
  TIMELINE_ACTIVE_SIZE,
  TIMELINE_BORDER_WIDTH,
  TIMELINE_ENTRY_SIZE,
  TIMELINE_ENTRY_SPACING,
  TIMELINE_X,
  TIMELINE_Y,
  TYPE_COLORS,
} from "../constants";
import { getPortraitKey } from "../sprites/SpriteLoader";

const STATUS_ICON_CONFIG: Record<string, { label: string; color: number }> = {
  [StatusType.Burned]: { label: "B", color: 0xe84020 },
  [StatusType.Poisoned]: { label: "P", color: 0xa040c0 },
  [StatusType.Paralyzed]: { label: "Z", color: 0xd0b020 },
  [StatusType.Asleep]: { label: "S", color: 0x6080c0 },
  [StatusType.Frozen]: { label: "F", color: 0x60c0d0 },
  [StatusType.BadlyPoisoned]: { label: "P", color: 0x802090 },
  [StatusType.Confused]: { label: "?", color: 0xc08040 },
};

export class TurnTimeline {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private entries: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(TIMELINE_X, TIMELINE_Y);
    this.container.setDepth(DEPTH_TIMELINE);
  }

  update(state: BattleState, pokemonDefinitions: Map<string, PokemonDefinition>): void {
    this.clearEntries();

    let y = 0;

    for (let i = 0; i < state.turnOrder.length; i++) {
      const pokemonId = state.turnOrder[i];
      if (!pokemonId) {
        continue;
      }

      const pokemon = state.pokemon.get(pokemonId);
      if (!pokemon || pokemon.currentHp <= 0) {
        continue;
      }

      const isActive = i === state.currentTurnIndex;
      const definition = pokemonDefinitions.get(pokemon.definitionId);
      const primaryType = definition?.types[0] ?? "normal";
      const typeColor = TYPE_COLORS[primaryType] ?? 0xa0a0a0;
      const teamColor =
        pokemon.playerId === PlayerId.Player1 ? TEAM_COLOR_PLAYER_1 : TEAM_COLOR_PLAYER_2;

      const entry = this.createEntry(
        y,
        typeColor,
        teamColor,
        isActive,
        pokemon.definitionId,
        pokemon,
      );
      this.container.add(entry);
      this.entries.push(entry);

      const entrySize = isActive ? TIMELINE_ACTIVE_SIZE : TIMELINE_ENTRY_SIZE;
      y += entrySize + TIMELINE_ENTRY_SPACING;
    }
  }

  destroy(): void {
    this.clearEntries();
    this.container.destroy();
  }

  private createEntry(
    y: number,
    typeColor: number,
    teamColor: number,
    isActive: boolean,
    definitionId: string,
    pokemon: PokemonInstance,
  ): Phaser.GameObjects.Container {
    const size = isActive ? TIMELINE_ACTIVE_SIZE : TIMELINE_ENTRY_SIZE;
    const half = size / 2;
    const children: Phaser.GameObjects.GameObject[] = [];

    const background = this.scene.add.graphics();
    background.fillStyle(0x111122, 0.8);
    background.fillRoundedRect(-half, -half, size, size, 4);
    children.push(background);

    const portraitKey = getPortraitKey(definitionId);
    const texture = this.scene.textures.get(portraitKey);
    const hasPortrait = texture.key !== "__MISSING";

    if (hasPortrait) {
      const portrait = this.scene.add.image(0, 0, portraitKey);
      portrait.setScale(size / PORTRAIT_SIZE);
      children.push(portrait);
    } else {
      const fallback = this.scene.add.graphics();
      fallback.fillStyle(typeColor, 1);
      fallback.fillRoundedRect(-half + 2, -half + 2, size - 4, size - 4, 3);
      children.push(fallback);
    }

    const border = this.scene.add.graphics();
    const borderColor = isActive ? TIMELINE_ACTIVE_BORDER_COLOR : teamColor;
    const borderWidth = isActive ? TIMELINE_ACTIVE_BORDER_WIDTH : TIMELINE_BORDER_WIDTH;
    border.lineStyle(borderWidth, borderColor, 1);
    border.strokeRoundedRect(-half, -half, size, size, 4);
    children.push(border);

    if (pokemon.statusEffects.length > 0) {
      const statusIcon = this.createStatusIcon(pokemon.statusEffects[0]?.type, half);
      if (statusIcon) {
        children.push(statusIcon);
      }
    }

    return this.scene.add.container(0, y + half, children);
  }

  private createStatusIcon(
    statusType: string | undefined,
    half: number,
  ): Phaser.GameObjects.Container | null {
    if (!statusType) {
      return null;
    }

    const statusConfig = STATUS_ICON_CONFIG[statusType];
    if (!statusConfig) {
      return null;
    }

    const iconSize = 12;
    const iconX = half - iconSize / 2;
    const iconY = half - iconSize / 2;

    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(0x000000, 0.7);
    iconBg.fillRoundedRect(iconX - 1, iconY - 1, iconSize + 2, iconSize + 2, 2);
    iconBg.fillStyle(statusConfig.color, 1);
    iconBg.fillRoundedRect(iconX, iconY, iconSize, iconSize, 2);

    const label = this.scene.add
      .text(iconX + iconSize / 2, iconY + iconSize / 2, statusConfig.label, {
        fontSize: "8px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    return this.scene.add.container(0, 0, [iconBg, label]);
  }

  private clearEntries(): void {
    for (const entry of this.entries) {
      entry.destroy();
    }
    this.entries = [];
  }
}
