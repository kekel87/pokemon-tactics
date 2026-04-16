import {
  type BattleState,
  CT_THRESHOLD,
  type CtTimelineEntry,
  type PokemonDefinition,
  type PokemonInstance,
  TurnSystemKind,
} from "@pokemon-tactic/core";
import {
  BACKGROUND_COLOR_CSS,
  DEPTH_TIMELINE,
  FONT_FAMILY,
  getTeamColorByPlayerId,
  INFO_PANEL_Y,
  PORTRAIT_SIZE,
  STATUS_ASSET_KEY,
  TEXT_COLOR_ACCENT,
  TIMELINE_ACTIVE_BORDER_COLOR,
  TIMELINE_ACTIVE_BORDER_WIDTH,
  TIMELINE_ACTIVE_SIZE,
  TIMELINE_BG_ALPHA,
  TIMELINE_BG_COLOR,
  TIMELINE_BORDER_WIDTH,
  TIMELINE_CT_BAR_BG_COLOR,
  TIMELINE_CT_BAR_COLOR,
  TIMELINE_CT_BAR_GAP,
  TIMELINE_CT_BAR_THICKNESS,
  TIMELINE_ENTRY_SIZE,
  TIMELINE_ENTRY_SPACING,
  TIMELINE_HIGHLIGHT_BORDER_COLOR,
  TIMELINE_HIGHLIGHT_COLOR_CSS,
  TIMELINE_PAST_ENTRY_ALPHA,
  TIMELINE_SEPARATOR_ALPHA,
  TIMELINE_SEPARATOR_COLOR,
  TIMELINE_SEPARATOR_LINE_HEIGHT,
  TIMELINE_SEPARATOR_THICKNESS,
  TIMELINE_TAIL_ENTRY_ALPHA,
  TIMELINE_VISIBLE_SLOTS,
  TIMELINE_X,
  TIMELINE_Y,
  TYPE_COLORS,
} from "../constants";
import { getPortraitKey } from "../sprites/SpriteLoader";

export class TurnTimeline {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private entries: Phaser.GameObjects.GameObject[] = [];
  private scrollOffset = 0;
  private scrollZone: Phaser.GameObjects.Rectangle | null = null;
  private cachedState: BattleState | null = null;
  private cachedDefinitions: Map<string, PokemonDefinition> | null = null;
  private cachedSequence: CtTimelineEntry[] | undefined = undefined;
  private cachedHighlightId: string | undefined = undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(TIMELINE_X, TIMELINE_Y);
    this.container.setDepth(DEPTH_TIMELINE);
    this.setupScrollZone();
  }

  update(
    state: BattleState,
    pokemonDefinitions: Map<string, PokemonDefinition>,
    options?: { sequence?: CtTimelineEntry[]; highlightPokemonId?: string },
  ): void {
    this.cachedState = state;
    this.cachedDefinitions = pokemonDefinitions;
    this.cachedSequence = options?.sequence;
    this.cachedHighlightId = options?.highlightPokemonId;
    this.renderCurrentSequence();
  }

  resetScroll(): void {
    this.scrollOffset = 0;
  }

  scrollToHighlight(sequence: CtTimelineEntry[], pokemonId: string): void {
    const idx = sequence.findIndex((e) => e.pokemonId === pokemonId);
    if (idx === -1) {
      return;
    }
    this.scrollOffset = Math.max(0, idx - Math.floor(TIMELINE_VISIBLE_SLOTS / 2));
  }

  destroy(): void {
    this.clearEntries();
    this.container.destroy();
  }

  private setupScrollZone(): void {
    const zoneH = INFO_PANEL_Y - TIMELINE_Y;
    const zoneW = TIMELINE_ACTIVE_SIZE + TIMELINE_CT_BAR_THICKNESS + TIMELINE_CT_BAR_GAP + 4;
    this.scrollZone = this.scene.add
      .rectangle(TIMELINE_X + zoneW / 2, TIMELINE_Y + zoneH / 2, zoneW, zoneH, 0, 0)
      .setDepth(DEPTH_TIMELINE + 1)
      .setInteractive();
    this.scene.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
        if (!this.scrollZone?.getBounds().contains(pointer.x, pointer.y)) {
          return;
        }
        this.scrollOffset = Math.max(0, this.scrollOffset + (deltaY > 0 ? 1 : -1));
        this.renderCurrentSequence();
      },
    );
  }

  private renderCurrentSequence(): void {
    if (!this.cachedState || !this.cachedDefinitions) {
      return;
    }
    this.clearEntries();

    if (
      this.cachedState.turnSystemKind === TurnSystemKind.ChargeTime &&
      this.cachedState.ctSnapshot
    ) {
      this.updateCt(
        this.cachedState,
        this.cachedDefinitions,
        this.cachedSequence,
        this.cachedHighlightId,
      );
    } else {
      this.updateRoundRobin(this.cachedState, this.cachedDefinitions);
    }
  }

  private updateRoundRobin(
    state: BattleState,
    pokemonDefinitions: Map<string, PokemonDefinition>,
  ): void {
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
        this.renderEntry(y, pokemon, pokemonDefinitions, false, TIMELINE_PAST_ENTRY_ALPHA);
      }
    }
  }

  private updateCt(
    state: BattleState,
    pokemonDefinitions: Map<string, PokemonDefinition>,
    sequence: CtTimelineEntry[] | undefined,
    highlightPokemonId: string | undefined,
  ): void {
    const ctSnapshot = state.ctSnapshot ?? {};
    const activePokemonId = state.turnOrder[0];

    let y = 0;
    if (activePokemonId) {
      const activePokemon = state.pokemon.get(activePokemonId);
      if (activePokemon && activePokemon.currentHp > 0) {
        const activeCt = ctSnapshot[activePokemonId] ?? 0;
        y = this.renderEntry(y, activePokemon, pokemonDefinitions, true, 1.0, activeCt);
      }
    }

    if (!sequence || sequence.length === 0) {
      return;
    }

    const maxScroll = Math.max(0, sequence.length - TIMELINE_VISIBLE_SLOTS);

    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);

    const highlightSequenceIndex =
      highlightPokemonId === undefined
        ? -1
        : sequence.findIndex((e) => e.pokemonId === highlightPokemonId);

    const sliceStart = this.scrollOffset;
    const visibleSlice = sequence.slice(sliceStart, sliceStart + TIMELINE_VISIBLE_SLOTS);

    for (let i = 0; i < visibleSlice.length; i++) {
      const entry = visibleSlice[i];
      if (!entry) {
        continue;
      }
      const pokemon = state.pokemon.get(entry.pokemonId);
      if (!pokemon || pokemon.currentHp <= 0) {
        continue;
      }

      const sequenceIndex = sliceStart + i;
      const isHighlighted = sequenceIndex === highlightSequenceIndex;
      y = this.renderEntry(y, pokemon, pokemonDefinitions, false, 1.0, entry.ct, isHighlighted);
    }

    if (highlightPokemonId !== undefined && highlightSequenceIndex === -1) {
      const highlightPokemon = state.pokemon.get(highlightPokemonId);
      if (highlightPokemon && highlightPokemon.currentHp > 0) {
        this.renderTailEntry(y, highlightPokemon, pokemonDefinitions);
      }
    }
  }

  private renderEntry(
    y: number,
    pokemon: PokemonInstance,
    pokemonDefinitions: Map<string, PokemonDefinition>,
    isActive: boolean,
    alpha: number,
    ctValue?: number,
    isHighlighted?: boolean,
  ): number {
    const size = isActive ? TIMELINE_ACTIVE_SIZE : TIMELINE_ENTRY_SIZE;
    const half = size / 2;
    const children: Phaser.GameObjects.GameObject[] = [];
    const hasCtBar = ctValue !== undefined;
    const ctBarOffset = hasCtBar ? TIMELINE_CT_BAR_THICKNESS + TIMELINE_CT_BAR_GAP : 0;

    const definition = pokemonDefinitions.get(pokemon.definitionId);
    const primaryType = definition?.types[0] ?? "normal";
    const typeColor = TYPE_COLORS[primaryType] ?? 0xa0a0a0;
    const teamColor = getTeamColorByPlayerId(pokemon.playerId);

    const background = this.scene.add.graphics();
    background.fillStyle(TIMELINE_BG_COLOR, TIMELINE_BG_ALPHA);
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

    if (isHighlighted) {
      const highlightBorder = this.scene.add.graphics();
      highlightBorder.lineStyle(TIMELINE_BORDER_WIDTH, TIMELINE_HIGHLIGHT_BORDER_COLOR, 1);
      highlightBorder.strokeRoundedRect(-half - 2, -half - 2, size + 4, size + 4, 5);
      children.push(highlightBorder);
    }

    if (hasCtBar) {
      const barFill = Math.min(1, Math.max(0, ctValue / CT_THRESHOLD));
      const barX = -half - TIMELINE_CT_BAR_GAP - TIMELINE_CT_BAR_THICKNESS;
      const barBg = this.scene.add.graphics();
      barBg.fillStyle(TIMELINE_CT_BAR_BG_COLOR, 1);
      barBg.fillRect(barX, -half, TIMELINE_CT_BAR_THICKNESS, size);
      children.push(barBg);

      if (barFill > 0) {
        const filledHeight = Math.floor(size * barFill);
        const barFg = this.scene.add.graphics();
        barFg.fillStyle(TIMELINE_CT_BAR_COLOR, 1);
        barFg.fillRect(barX, -half + size - filledHeight, TIMELINE_CT_BAR_THICKNESS, filledHeight);
        children.push(barFg);
      }
    }

    if (pokemon.statusEffects.length > 0) {
      const statusIcon = this.createStatusIcon(pokemon.statusEffects[0]?.type, half);
      if (statusIcon) {
        children.push(statusIcon);
      }
    }

    const entry = this.scene.add.container(ctBarOffset + half, y + half, children);
    entry.setAlpha(alpha);
    this.container.add(entry);
    this.entries.push(entry);

    return y + size + TIMELINE_ENTRY_SPACING;
  }

  private renderTailEntry(
    y: number,
    pokemon: PokemonInstance,
    pokemonDefinitions: Map<string, PokemonDefinition>,
  ): void {
    const size = TIMELINE_ENTRY_SIZE;
    const half = size / 2;
    const children: Phaser.GameObjects.GameObject[] = [];
    const ctBarOffset = TIMELINE_CT_BAR_THICKNESS + TIMELINE_CT_BAR_GAP;

    const definition = pokemonDefinitions.get(pokemon.definitionId);
    const primaryType = definition?.types[0] ?? "normal";
    const typeColor = TYPE_COLORS[primaryType] ?? 0xa0a0a0;

    const background = this.scene.add.graphics();
    background.fillStyle(TIMELINE_BG_COLOR, TIMELINE_BG_ALPHA);
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

    const highlightBorder = this.scene.add.graphics();
    highlightBorder.lineStyle(TIMELINE_BORDER_WIDTH, TIMELINE_HIGHLIGHT_BORDER_COLOR, 0.6);
    highlightBorder.strokeRoundedRect(-half - 2, -half - 2, size + 4, size + 4, 5);
    children.push(highlightBorder);

    const dotsLabel = this.scene.add.text(0, 0, "...", {
      fontSize: "10px",
      color: TIMELINE_HIGHLIGHT_COLOR_CSS,
      fontFamily: FONT_FAMILY,
    });
    dotsLabel.setOrigin(0.5, 0.5);
    children.push(dotsLabel);

    const entry = this.scene.add.container(ctBarOffset + half, y + half, children);
    entry.setAlpha(TIMELINE_TAIL_ENTRY_ALPHA);
    this.container.add(entry);
    this.entries.push(entry);
  }

  private renderSeparator(y: number, roundNumber: number): number {
    const centerX = TIMELINE_ENTRY_SIZE / 2;
    const lineY = y + TIMELINE_SEPARATOR_LINE_HEIGHT / 2;

    const line = this.scene.add.graphics();
    line.lineStyle(
      TIMELINE_SEPARATOR_THICKNESS,
      TIMELINE_SEPARATOR_COLOR,
      TIMELINE_SEPARATOR_ALPHA,
    );
    line.lineBetween(0, lineY, TIMELINE_ENTRY_SIZE, lineY);
    this.container.add(line);
    this.entries.push(line);

    const label = this.scene.add.text(centerX, lineY, `${roundNumber}`, {
      fontSize: "20px",
      color: TEXT_COLOR_ACCENT,
      fontFamily: FONT_FAMILY,
      fontStyle: "bold",
      backgroundColor: BACKGROUND_COLOR_CSS,
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
