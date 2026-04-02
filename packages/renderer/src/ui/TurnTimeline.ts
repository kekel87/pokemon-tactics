import {
  type BattleState,
  PlayerId,
  type PokemonDefinition,
  type PokemonInstance,
} from "@pokemon-tactic/core";
import {
  DEPTH_TIMELINE,
  PORTRAIT_SIZE,
  STATUS_ASSET_KEY,
  TEAM_COLOR_PLAYER_1,
  TEAM_COLOR_PLAYER_2,
  TIMELINE_ACTIVE_BORDER_COLOR,
  TIMELINE_ACTIVE_BORDER_WIDTH,
  TIMELINE_ACTIVE_SIZE,
  TIMELINE_BORDER_WIDTH,
  TIMELINE_ENTRY_SIZE,
  TIMELINE_ENTRY_SPACING,
  TIMELINE_PAST_ENTRY_ALPHA,
  TIMELINE_SEPARATOR_ALPHA,
  TIMELINE_SEPARATOR_COLOR,
  TIMELINE_SEPARATOR_LINE_HEIGHT,
  TIMELINE_X,
  TIMELINE_Y,
  TYPE_COLORS,
} from "../constants";
import { getPortraitKey } from "../sprites/SpriteLoader";

export class TurnTimeline {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private entries: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(TIMELINE_X, TIMELINE_Y);
    this.container.setDepth(DEPTH_TIMELINE);
  }

  update(state: BattleState, pokemonDefinitions: Map<string, PokemonDefinition>): void {
    this.clearEntries();

    const turnOrder = state.turnOrder;
    const currentIndex = state.currentTurnIndex;

    const activePokemonId = turnOrder[currentIndex];
    const remainingIds = turnOrder.slice(currentIndex + 1);

    const alreadyActedSet = new Set<string>();
    for (let i = 0; i < currentIndex; i++) {
      const id = turnOrder[i];
      if (id) {
        alreadyActedSet.add(id);
      }
    }

    const nextRoundForActed = state.predictedNextRoundOrder.filter((id) => alreadyActedSet.has(id));

    let y = 0;

    if (activePokemonId) {
      const pokemon = state.pokemon.get(activePokemonId);
      if (pokemon && pokemon.currentHp > 0) {
        y = this.renderEntry(y, pokemon, pokemonDefinitions, true, 1.0);
      }
    }

    for (const pokemonId of remainingIds) {
      const pokemon = state.pokemon.get(pokemonId);
      if (!pokemon || pokemon.currentHp <= 0) {
        continue;
      }
      y = this.renderEntry(y, pokemon, pokemonDefinitions, false, 1.0);
    }

    if (nextRoundForActed.length > 0) {
      y = this.renderSeparator(y, state.roundNumber + 1);

      for (const pokemonId of nextRoundForActed) {
        const pokemon = state.pokemon.get(pokemonId);
        if (!pokemon || pokemon.currentHp <= 0) {
          continue;
        }
        y = this.renderEntry(y, pokemon, pokemonDefinitions, false, TIMELINE_PAST_ENTRY_ALPHA);
      }
    }
  }

  destroy(): void {
    this.clearEntries();
    this.container.destroy();
  }

  private renderEntry(
    y: number,
    pokemon: PokemonInstance,
    pokemonDefinitions: Map<string, PokemonDefinition>,
    isActive: boolean,
    alpha: number,
  ): number {
    const size = isActive ? TIMELINE_ACTIVE_SIZE : TIMELINE_ENTRY_SIZE;
    const half = size / 2;
    const children: Phaser.GameObjects.GameObject[] = [];

    const definition = pokemonDefinitions.get(pokemon.definitionId);
    const primaryType = definition?.types[0] ?? "normal";
    const typeColor = TYPE_COLORS[primaryType] ?? 0xa0a0a0;
    const teamColor =
      pokemon.playerId === PlayerId.Player1 ? TEAM_COLOR_PLAYER_1 : TEAM_COLOR_PLAYER_2;

    const background = this.scene.add.graphics();
    background.fillStyle(0x111122, 0.8);
    background.fillRoundedRect(-half, -half, size, size, 4);
    children.push(background);

    const portraitKey = getPortraitKey(pokemon.definitionId);
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

    const entry = this.scene.add.container(half, y + half, children);
    entry.setAlpha(alpha);
    this.container.add(entry);
    this.entries.push(entry);

    return y + size + TIMELINE_ENTRY_SPACING;
  }

  private renderSeparator(y: number, roundNumber: number): number {
    const centerX = TIMELINE_ENTRY_SIZE / 2;
    const lineY = y + TIMELINE_SEPARATOR_LINE_HEIGHT / 2;

    const line = this.scene.add.graphics();
    line.lineStyle(5, TIMELINE_ACTIVE_BORDER_COLOR, 0.5);
    line.lineBetween(0, lineY, TIMELINE_ENTRY_SIZE, lineY);
    this.container.add(line);
    this.entries.push(line);

    const label = this.scene.add.text(centerX, lineY, `${roundNumber}`, {
      fontSize: "13px",
      color: "#ffdd44",
      fontFamily: "monospace",
      fontStyle: "bold",
      backgroundColor: "#1a1a2e",
      padding: { x: 4, y: 1 },
    });
    label.setOrigin(0.5, 0.5);
    this.container.add(label);
    this.entries.push(label);

    return lineY + TIMELINE_SEPARATOR_LINE_HEIGHT / 2 + TIMELINE_ENTRY_SPACING;
  }

  private createStatusIcon(
    statusType: string | undefined,
    half: number,
  ): Phaser.GameObjects.GameObject | null {
    if (!statusType) {
      return null;
    }

    const assetKey = STATUS_ASSET_KEY[statusType];
    if (!assetKey) {
      return null;
    }

    const textureKey = `status-icon-${assetKey}`;
    const texture = this.scene.textures.get(textureKey);
    if (texture.key === "__MISSING") {
      return null;
    }

    const targetHeight = 10;
    const icon = this.scene.add.image(0, 0, textureKey);
    const scale = targetHeight / icon.height;
    icon.setScale(scale);
    icon.setPosition(half + (icon.width * scale) / 2 - 10, -half + targetHeight / 2 - 2);

    return icon;
  }

  private clearEntries(): void {
    for (const entry of this.entries) {
      entry.destroy();
    }
    this.entries = [];
  }
}
