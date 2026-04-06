import {
  PlayerController,
  PlayerId,
  type PokemonDefinition,
  type TeamSelection,
  validateTeamSelection,
} from "@pokemon-tactic/core";
import { loadData } from "@pokemon-tactic/data";
import { BACKGROUND_COLOR, CANVAS_HEIGHT, CANVAS_WIDTH, TEAM_COLORS } from "../constants";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import { sandboxBootConfig } from "../sandbox-boot";
import { preloadPortraitsOnly } from "../sprites/SpriteLoader";

const ALLOWED_TEAM_COUNTS = [2, 3, 4, 6, 12] as const;
const MAX_TOTAL_POKEMON = 12;

const TITLE_Y = 30;
const GRID_TOP_Y = 70;
const GRID_COLS = 5;
const GRID_CELL_SIZE = 82;
const GRID_CELL_GAP = 6;
const GRID_PORTRAIT_SIZE = 56;

const COLUMN_WIDTH = 180;
const COMPACT_COLUMN_WIDTH = 290;
const COLUMN_LEFT_X = 30;
const COLUMN_RIGHT_X = CANVAS_WIDTH - COLUMN_WIDTH - 30;
const COMPACT_COLUMN_RIGHT_X = CANVAS_WIDTH - COMPACT_COLUMN_WIDTH - 20;
const COLUMN_TOP_Y = 80;
const SLOT_SIZE = 40;
const SLOT_GAP = 6;

const BUTTON_GAP = 4;
const BUTTON_HEIGHT = 24;
const COMPACT_BUTTON_SIZE = 22;

const COLUMN_PADDING = 8;

const LAUNCH_BUTTON_Y = CANVAS_HEIGHT - 50;
const LAUNCH_BUTTON_WIDTH = 200;
const LAUNCH_BUTTON_HEIGHT = 36;

const PLAYER_IDS: PlayerId[] = [
  PlayerId.Player1,
  PlayerId.Player2,
  PlayerId.Player3,
  PlayerId.Player4,
  PlayerId.Player5,
  PlayerId.Player6,
  PlayerId.Player7,
  PlayerId.Player8,
  PlayerId.Player9,
  PlayerId.Player10,
  PlayerId.Player11,
  PlayerId.Player12,
];

interface PlayerColumnState {
  controller: PlayerController;
  selectedIds: string[];
  validated: boolean;
}

export interface TeamSelectResult {
  teams: TeamSelection[];
  autoPlacement: boolean;
}

export class TeamSelectScene extends Phaser.Scene {
  private pokemonDefinitions: PokemonDefinition[] = [];
  private allDefinitionIds: string[] = [];

  private teamCount = 2;
  private playerStates: PlayerColumnState[] = [];
  private activeColumnIndex = 0;

  private dynamicContainer: Phaser.GameObjects.Container | null = null;
  private gridContainer: Phaser.GameObjects.Container | null = null;
  private launchBg: Phaser.GameObjects.Rectangle | null = null;
  private launchText: Phaser.GameObjects.Text | null = null;
  private autoPlacement = false;
  private placementToggleBg: Phaser.GameObjects.Rectangle | null = null;
  private placementToggleText: Phaser.GameObjects.Text | null = null;
  private teamCountText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("TeamSelectScene");
  }

  preload(): void {
    const gameData = loadData();
    this.pokemonDefinitions = gameData.pokemon.filter((p) => p.id !== "dummy");
    this.allDefinitionIds = this.pokemonDefinitions.map((p) => p.id);
    preloadPortraitsOnly(this, this.allDefinitionIds);
  }

  create(): void {
    if (sandboxBootConfig.enabled) {
      this.scene.start("BattleScene", {
        sandboxMode: true,
        sandboxConfig: sandboxBootConfig.config,
      });
      return;
    }

    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

    this.add
      .text(CANVAS_WIDTH / 2, TITLE_Y, t("teamSelect.title"), {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);

    this.initPlayerStates();
    this.buildGrid();
    this.buildBottomBar();
    this.rebuildColumns();
    this.refreshAll();
  }

  private get maxTeamSize(): number {
    return Math.floor(MAX_TOTAL_POKEMON / this.teamCount);
  }

  private initPlayerStates(): void {
    this.playerStates = [];
    for (let i = 0; i < this.teamCount; i++) {
      this.playerStates.push({
        controller: i === 0 ? PlayerController.Human : PlayerController.Ai,
        selectedIds: [],
        validated: false,
      });
    }
  }

  private getTeamColor(teamIndex: number): number {
    return TEAM_COLORS[teamIndex] ?? 0xaaaaaa;
  }

  private getPlayerLabel(teamIndex: number): string {
    const playerKey = `teamSelect.player${teamIndex + 1}` as TranslationKey;
    return t(playerKey);
  }

  private getPokemonName(definitionId: string): string {
    const key = `pokemon.${definitionId}` as TranslationKey;
    const translated = t(key);
    if (translated === key) {
      const definition = this.pokemonDefinitions.find((p) => p.id === definitionId);
      return definition?.name ?? definitionId;
    }
    return translated;
  }

  private rebuildColumns(): void {
    if (this.dynamicContainer) {
      this.dynamicContainer.destroy(true);
    }
    this.dynamicContainer = this.add.container(0, 0);

    const leftTeams: number[] = [];
    const rightTeams: number[] = [];
    for (let i = 0; i < this.teamCount; i++) {
      if (i % 2 === 0) {
        leftTeams.push(i);
      } else {
        rightTeams.push(i);
      }
    }

    this.buildColumnStack(leftTeams, COLUMN_LEFT_X);
    this.buildColumnStack(rightTeams, COLUMN_RIGHT_X);
  }

  private get useCompactLayout(): boolean {
    return this.maxTeamSize <= 2;
  }

  private buildColumnStack(teamIndices: number[], columnX: number): void {
    if (teamIndices.length === 0) {
      return;
    }

    if (this.useCompactLayout) {
      this.buildCompactStack(teamIndices, columnX);
      return;
    }

    const maxTeamSize = this.maxTeamSize;
    const slotCols = maxTeamSize <= 3 ? maxTeamSize : 3;
    const slotRows = Math.ceil(maxTeamSize / slotCols);

    const teamBlockHeight = this.getTeamBlockHeight(slotRows);
    const availableHeight = LAUNCH_BUTTON_Y - 60 - COLUMN_TOP_Y;
    const gap =
      teamIndices.length > 1
        ? Math.min(
            12,
            (availableHeight - teamIndices.length * teamBlockHeight) / (teamIndices.length - 1),
          )
        : 0;

    for (let stackIndex = 0; stackIndex < teamIndices.length; stackIndex++) {
      const teamIndex = teamIndices[stackIndex];
      if (teamIndex === undefined) {
        continue;
      }
      const blockY = COLUMN_TOP_Y + stackIndex * (teamBlockHeight + gap);
      this.buildTeamBlock(teamIndex, columnX, blockY, slotCols, slotRows);
    }
  }

  private buildCompactStack(teamIndices: number[], columnX: number): void {
    const compactSlotSize = 34;
    const rowHeight = compactSlotSize + 12;
    const availableHeight = LAUNCH_BUTTON_Y - 60 - COLUMN_TOP_Y;
    const totalRowsHeight = teamIndices.length * rowHeight;
    const gap =
      teamIndices.length > 1
        ? Math.min(10, (availableHeight - totalRowsHeight) / (teamIndices.length - 1))
        : 0;

    const isLeft = columnX < CANVAS_WIDTH / 2;
    const actualX = isLeft ? COLUMN_LEFT_X : COMPACT_COLUMN_RIGHT_X;

    for (let stackIndex = 0; stackIndex < teamIndices.length; stackIndex++) {
      const teamIndex = teamIndices[stackIndex];
      if (teamIndex === undefined) {
        continue;
      }
      const rowY = COLUMN_TOP_Y + stackIndex * (rowHeight + gap);
      this.buildCompactRow(teamIndex, actualX, rowY, compactSlotSize);
    }
  }

  private buildCompactRow(
    teamIndex: number,
    columnX: number,
    rowY: number,
    slotSize: number,
  ): void {
    const colWidth = COMPACT_COLUMN_WIDTH;
    const teamColor = this.getTeamColor(teamIndex);
    const state = this.playerStates[teamIndex];
    if (!state) {
      return;
    }
    const isActive = teamIndex === this.activeColumnIndex;
    const centerY = rowY + slotSize / 2 + 6;
    const rowHeight = slotSize + 12;

    const highlight = this.add.rectangle(
      columnX + colWidth / 2,
      centerY,
      colWidth + 6,
      rowHeight,
      teamColor,
      isActive ? 0.12 : 0.04,
    );
    highlight.setStrokeStyle(isActive ? 2 : 1, teamColor, isActive ? 0.5 : 0.15);
    highlight.setDepth(-1);
    highlight.setInteractive({ useHandCursor: true });
    highlight.on("pointerdown", () => {
      if (this.activeColumnIndex !== teamIndex) {
        this.activeColumnIndex = teamIndex;
        this.rebuildColumns();
        this.refreshGrid();
        this.refreshLaunchButton();
      }
    });
    this.dynamicContainer?.add(highlight);

    let cursorX = columnX + 6;

    const shortLabel = this.getPlayerLabel(teamIndex);
    const labelText = this.add
      .text(cursorX, centerY, shortLabel, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: `#${teamColor.toString(16).padStart(6, "0")}`,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.dynamicContainer?.add(labelText);
    cursorX += 62;

    const isHuman = state.controller === PlayerController.Human;
    const toggleW = 28;
    const toggleBg = this.add
      .rectangle(cursorX + toggleW / 2, centerY, toggleW, 18, isHuman ? 0x225522 : 0x442255, 0.8)
      .setInteractive({ useHandCursor: true });
    const toggleLabel = isHuman ? "H" : "IA";
    const toggleText = this.add
      .text(cursorX + toggleW / 2, centerY, toggleLabel, {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    toggleBg.on("pointerdown", () => {
      if (state.validated) {
        return;
      }
      state.controller =
        state.controller === PlayerController.Human ? PlayerController.Ai : PlayerController.Human;
      this.rebuildColumns();
    });
    this.dynamicContainer?.add([toggleBg, toggleText]);
    cursorX += toggleW + 6;

    const buttonsRightEdge = columnX + colWidth - 4;
    const btnSize = COMPACT_BUTTON_SIZE;
    const btnGap = 3;
    const totalBtns = 3;
    const totalBtnWidth = totalBtns * btnSize + (totalBtns - 1) * btnGap;
    const btnsLeftEdge = buttonsRightEdge - totalBtnWidth;

    const slotsWidth = this.maxTeamSize * (slotSize + 4) - 4;
    const availableForSlots = btnsLeftEdge - cursorX - 6;
    const slotsStartX = cursorX + (availableForSlots - slotsWidth) / 2;

    for (let i = 0; i < this.maxTeamSize; i++) {
      const cx = slotsStartX + i * (slotSize + 4) + slotSize / 2;
      const slotBg = this.add.rectangle(cx, centerY, slotSize, slotSize, teamColor, 0.15);
      slotBg.setStrokeStyle(1, teamColor, 0.3);
      this.dynamicContainer?.add(slotBg);

      if (i < state.selectedIds.length) {
        const defId = state.selectedIds[i];
        if (!defId) {
          continue;
        }
        const portrait = this.add.image(cx, centerY, `${defId}-portrait`);
        portrait.setDisplaySize(slotSize - 4, slotSize - 4);
        if (!state.validated) {
          portrait.setInteractive({ useHandCursor: true });
          portrait.on("pointerdown", () => {
            state.selectedIds.splice(i, 1);
            this.rebuildColumns();
            this.refreshGrid();
            this.refreshLaunchButton();
          });
        }
        this.dynamicContainer?.add(portrait);
      }
    }

    let btnX = btnsLeftEdge;

    const valBg = this.add
      .rectangle(
        btnX + btnSize / 2,
        centerY,
        btnSize,
        btnSize,
        state.validated ? 0x553322 : 0x335533,
        0.9,
      )
      .setInteractive({ useHandCursor: true });
    valBg.setStrokeStyle(1, state.validated ? 0x775544 : 0x558855);
    const valLabel = state.validated ? "✎" : "✓";
    const valText = this.add
      .text(btnX + btnSize / 2, centerY, valLabel, {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    valBg.on("pointerdown", () => this.onValidateClick(teamIndex));
    this.dynamicContainer?.add([valBg, valText]);
    btnX += btnSize + btnGap;

    const autoBg = this.add
      .rectangle(btnX + btnSize / 2, centerY, btnSize, btnSize, 0x333355, 0.9)
      .setInteractive({ useHandCursor: true });
    autoBg.setStrokeStyle(1, 0x555577);
    const autoText = this.add
      .text(btnX + btnSize / 2, centerY, "⟳", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#aaaacc",
      })
      .setOrigin(0.5);
    autoBg.on("pointerdown", () => {
      if (state.validated) {
        return;
      }
      this.autoFillTeam(teamIndex);
      this.rebuildColumns();
      this.refreshGrid();
      this.refreshLaunchButton();
    });
    this.dynamicContainer?.add([autoBg, autoText]);
    btnX += btnSize + btnGap;

    const clearBg = this.add
      .rectangle(btnX + btnSize / 2, centerY, btnSize, btnSize, 0x443333, 0.9)
      .setInteractive({ useHandCursor: true });
    clearBg.setStrokeStyle(1, 0x775555);
    const clearText = this.add
      .text(btnX + btnSize / 2, centerY, "✕", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#ccaaaa",
      })
      .setOrigin(0.5);
    clearBg.on("pointerdown", () => {
      if (state.validated) {
        return;
      }
      state.selectedIds = [];
      this.rebuildColumns();
      this.refreshGrid();
      this.refreshLaunchButton();
    });
    this.dynamicContainer?.add([clearBg, clearText]);
  }

  private getTeamBlockHeight(slotRows: number): number {
    const headerHeight = 25;
    const slotsHeight = slotRows * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
    const buttonsHeight = BUTTON_HEIGHT;
    return headerHeight + slotsHeight + 8 + buttonsHeight + COLUMN_PADDING;
  }

  private buildTeamBlock(
    teamIndex: number,
    columnX: number,
    blockY: number,
    slotCols: number,
    slotRows: number,
  ): void {
    const teamColor = this.getTeamColor(teamIndex);
    const state = this.playerStates[teamIndex];
    if (!state) {
      return;
    }

    const headerHeight = 25;
    const slotsTopY = blockY + headerHeight;
    const slotsHeight = slotRows * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
    const buttonsY = slotsTopY + slotsHeight + 8;
    const totalHeight = buttonsY + BUTTON_HEIGHT - blockY + COLUMN_PADDING;

    const isActive = teamIndex === this.activeColumnIndex;
    const bgAlpha = isActive ? 0.12 : 0.04;
    const strokeAlpha = isActive ? 0.5 : 0.15;

    const highlight = this.add.rectangle(
      columnX + COLUMN_WIDTH / 2,
      blockY + totalHeight / 2 - COLUMN_PADDING / 2,
      COLUMN_WIDTH + 10,
      totalHeight,
      teamColor,
      bgAlpha,
    );
    highlight.setStrokeStyle(isActive ? 2 : 1, teamColor, strokeAlpha);
    highlight.setDepth(-1);
    highlight.setInteractive({ useHandCursor: true });
    highlight.on("pointerdown", () => {
      if (this.activeColumnIndex !== teamIndex) {
        this.activeColumnIndex = teamIndex;
        this.rebuildColumns();
        this.refreshGrid();
        this.refreshLaunchButton();
      }
    });
    this.dynamicContainer?.add(highlight);

    const label = this.getPlayerLabel(teamIndex);
    const headerText = this.add.text(columnX, blockY, label, {
      fontSize: "13px",
      fontFamily: "monospace",
      color: `#${teamColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
    });
    this.dynamicContainer?.add(headerText);

    const toggleX = columnX + COLUMN_WIDTH - 40;
    const toggleY = blockY + 7;
    const isHuman = state.controller === PlayerController.Human;
    const toggleBg = this.add
      .rectangle(toggleX, toggleY, 80, 20, isHuman ? 0x225522 : 0x442255, 0.8)
      .setInteractive({ useHandCursor: true });
    const toggleText = this.add
      .text(toggleX, toggleY, isHuman ? t("teamSelect.human") : t("teamSelect.ai"), {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    toggleBg.on("pointerdown", () => {
      if (state.validated) {
        return;
      }
      state.controller =
        state.controller === PlayerController.Human ? PlayerController.Ai : PlayerController.Human;
      this.rebuildColumns();
    });
    this.dynamicContainer?.add([toggleBg, toggleText]);

    const slotsGridWidth = slotCols * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
    const slotsStartX = columnX + (COLUMN_WIDTH - slotsGridWidth) / 2;

    for (let i = 0; i < this.maxTeamSize; i++) {
      const col = i % slotCols;
      const row = Math.floor(i / slotCols);
      const slotX = slotsStartX + col * (SLOT_SIZE + SLOT_GAP);
      const slotY = slotsTopY + row * (SLOT_SIZE + SLOT_GAP);
      const cx = slotX + SLOT_SIZE / 2;
      const cy = slotY + SLOT_SIZE / 2;

      const slotBg = this.add.rectangle(cx, cy, SLOT_SIZE, SLOT_SIZE, teamColor, 0.15);
      slotBg.setStrokeStyle(1, teamColor, 0.3);
      this.dynamicContainer?.add(slotBg);

      if (i < state.selectedIds.length) {
        const defId = state.selectedIds[i];
        if (!defId) {
          continue;
        }
        const portrait = this.add.image(cx, cy, `${defId}-portrait`);
        portrait.setDisplaySize(SLOT_SIZE - 4, SLOT_SIZE - 4);
        if (!state.validated) {
          portrait.setInteractive({ useHandCursor: true });
          portrait.on("pointerdown", () => {
            state.selectedIds.splice(i, 1);
            this.rebuildColumns();
            this.refreshGrid();
            this.refreshLaunchButton();
          });
        }
        this.dynamicContainer?.add(portrait);
      }
    }

    const buttonCount = 3;
    const buttonWidth = (COLUMN_WIDTH - BUTTON_GAP * (buttonCount - 1)) / buttonCount;
    const buttonCenterY = buttonsY + BUTTON_HEIGHT / 2;

    const valBtnX = columnX + buttonWidth / 2;
    const validateBg = this.add
      .rectangle(
        valBtnX,
        buttonCenterY,
        buttonWidth,
        BUTTON_HEIGHT,
        state.validated ? 0x553322 : 0x335533,
        0.9,
      )
      .setInteractive({ useHandCursor: true });
    validateBg.setStrokeStyle(1, state.validated ? 0x775544 : 0x558855);
    const validateText = this.add
      .text(
        valBtnX,
        buttonCenterY,
        state.validated ? t("teamSelect.modify") : t("teamSelect.validate"),
        { fontSize: "11px", fontFamily: "monospace", color: "#ffffff" },
      )
      .setOrigin(0.5);
    validateBg.on("pointerdown", () => this.onValidateClick(teamIndex));
    this.dynamicContainer?.add([validateBg, validateText]);

    const autoBtnX = columnX + (buttonWidth + BUTTON_GAP) + buttonWidth / 2;
    const autoBg = this.add
      .rectangle(autoBtnX, buttonCenterY, buttonWidth, BUTTON_HEIGHT, 0x333355, 0.9)
      .setInteractive({ useHandCursor: true });
    autoBg.setStrokeStyle(1, 0x555577);
    const autoText = this.add
      .text(autoBtnX, buttonCenterY, t("teamSelect.autoFill"), {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#aaaacc",
      })
      .setOrigin(0.5);
    autoBg.on("pointerdown", () => {
      if (state.validated) {
        return;
      }
      this.autoFillTeam(teamIndex);
      this.rebuildColumns();
      this.refreshGrid();
      this.refreshLaunchButton();
    });
    this.dynamicContainer?.add([autoBg, autoText]);

    const clearBtnX = columnX + 2 * (buttonWidth + BUTTON_GAP) + buttonWidth / 2;
    const clearBg = this.add
      .rectangle(clearBtnX, buttonCenterY, buttonWidth, BUTTON_HEIGHT, 0x443333, 0.9)
      .setInteractive({ useHandCursor: true });
    clearBg.setStrokeStyle(1, 0x775555);
    const clearText = this.add
      .text(clearBtnX, buttonCenterY, t("teamSelect.clear"), {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#ccaaaa",
      })
      .setOrigin(0.5);
    clearBg.on("pointerdown", () => {
      if (state.validated) {
        return;
      }
      state.selectedIds = [];
      this.rebuildColumns();
      this.refreshGrid();
      this.refreshLaunchButton();
    });
    this.dynamicContainer?.add([clearBg, clearText]);
  }

  private onValidateClick(teamIndex: number): void {
    const state = this.playerStates[teamIndex];
    if (!state) {
      return;
    }
    if (state.validated) {
      state.validated = false;
    } else {
      const playerId = PLAYER_IDS[teamIndex];
      if (!playerId) {
        return;
      }
      const result = validateTeamSelection(
        { playerId, pokemonDefinitionIds: state.selectedIds, controller: state.controller },
        this.allDefinitionIds,
        this.maxTeamSize,
      );
      if (result.valid) {
        state.validated = true;
      } else {
        return;
      }
    }
    this.rebuildColumns();
    this.refreshGrid();
    this.refreshLaunchButton();
  }

  private autoFillTeam(teamIndex: number): void {
    const state = this.playerStates[teamIndex];
    if (!state) {
      return;
    }
    state.selectedIds = [];
    const shuffled = [...this.allDefinitionIds].sort(() => Math.random() - 0.5);
    state.selectedIds = shuffled.slice(0, this.maxTeamSize);
  }

  private buildGrid(): void {
    const gridWidth = GRID_COLS * (GRID_CELL_SIZE + GRID_CELL_GAP) - GRID_CELL_GAP;
    const gridStartX = (CANVAS_WIDTH - gridWidth) / 2;

    this.gridContainer = this.add.container(0, 0);

    for (let i = 0; i < this.pokemonDefinitions.length; i++) {
      const definition = this.pokemonDefinitions[i];
      if (!definition) {
        continue;
      }
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const cellX = gridStartX + col * (GRID_CELL_SIZE + GRID_CELL_GAP);
      const cellY = GRID_TOP_Y + row * (GRID_CELL_SIZE + GRID_CELL_GAP);
      const centerX = cellX + GRID_CELL_SIZE / 2;
      const centerY = cellY + GRID_CELL_SIZE / 2 - 6;

      const bg = this.add.rectangle(
        centerX,
        cellY + GRID_CELL_SIZE / 2,
        GRID_CELL_SIZE,
        GRID_CELL_SIZE,
        0x2a2a3e,
        0.8,
      );
      bg.setStrokeStyle(1, 0x444466);
      bg.setInteractive({ useHandCursor: true });

      const portrait = this.add.image(centerX, centerY, `${definition.id}-portrait`);
      portrait.setDisplaySize(GRID_PORTRAIT_SIZE, GRID_PORTRAIT_SIZE);

      this.add
        .text(centerX, cellY + GRID_CELL_SIZE - 2, this.getPokemonName(definition.id), {
          fontSize: "9px",
          fontFamily: "monospace",
          color: "#cccccc",
        })
        .setOrigin(0.5, 1);

      bg.on("pointerdown", () => this.onPokemonClicked(definition.id));
      bg.on("pointerover", () => bg.setFillStyle(0x3a3a5e, 1));
      bg.on("pointerout", () => this.refreshGridCell(i));

      this.gridContainer.add([bg, portrait]);
    }
  }

  private onPokemonClicked(definitionId: string): void {
    const state = this.playerStates[this.activeColumnIndex];
    if (!state || state.validated) {
      return;
    }

    const existingIndex = state.selectedIds.indexOf(definitionId);
    if (existingIndex >= 0) {
      state.selectedIds.splice(existingIndex, 1);
    } else {
      if (state.selectedIds.length >= this.maxTeamSize) {
        return;
      }
      state.selectedIds.push(definitionId);
    }

    this.rebuildColumns();
    this.refreshGrid();
    this.refreshLaunchButton();
  }

  private autoFillAndValidateAi(): void {
    for (let i = 0; i < this.playerStates.length; i++) {
      const state = this.playerStates[i];
      if (!state) {
        continue;
      }
      if (state.controller !== PlayerController.Ai) {
        continue;
      }
      if (state.validated) {
        continue;
      }
      if (state.selectedIds.length < this.maxTeamSize) {
        this.autoFillTeam(i);
      }
      const playerId = PLAYER_IDS[i];
      if (!playerId) {
        continue;
      }
      const result = validateTeamSelection(
        { playerId, pokemonDefinitionIds: state.selectedIds, controller: state.controller },
        this.allDefinitionIds,
        this.maxTeamSize,
      );
      if (result.valid) {
        state.validated = true;
      }
    }
    this.rebuildColumns();
    this.refreshGrid();
    this.refreshLaunchButton();
  }

  private buildBottomBar(): void {
    const launchX = CANVAS_WIDTH - 30 - LAUNCH_BUTTON_WIDTH / 2;
    const btnY = LAUNCH_BUTTON_Y;
    let curX = 30;
    const btnWidth = 130;
    const btnSpacing = 8;

    const teamCountBg = this.add
      .rectangle(curX + btnWidth / 2, btnY, btnWidth, 28, 0x333344, 0.8)
      .setInteractive({ useHandCursor: true });
    teamCountBg.setStrokeStyle(1, 0x555566);
    this.teamCountText = this.add
      .text(curX + btnWidth / 2, btnY, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#cccccc",
      })
      .setOrigin(0.5);
    teamCountBg.on("pointerdown", () => this.cycleTeamCount());
    this.refreshTeamCountText();
    curX += btnWidth + btnSpacing;

    this.placementToggleBg = this.add
      .rectangle(curX + btnWidth / 2, btnY, btnWidth, 28, 0x333344, 0.8)
      .setInteractive({ useHandCursor: true });
    this.placementToggleBg.setStrokeStyle(1, 0x555566);
    this.placementToggleText = this.add
      .text(curX + btnWidth / 2, btnY, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#cccccc",
      })
      .setOrigin(0.5);
    this.placementToggleBg.on("pointerdown", () => {
      this.autoPlacement = !this.autoPlacement;
      this.refreshPlacementToggle();
    });
    curX += btnWidth + btnSpacing;

    const fillAiBg = this.add
      .rectangle(curX + btnWidth / 2, btnY, btnWidth, 28, 0x333355, 0.8)
      .setInteractive({ useHandCursor: true });
    fillAiBg.setStrokeStyle(1, 0x555577);
    this.add
      .text(curX + btnWidth / 2, btnY, t("teamSelect.fillAi"), {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#aaaacc",
      })
      .setOrigin(0.5);
    fillAiBg.on("pointerdown", () => this.autoFillAndValidateAi());

    this.launchBg = this.add.rectangle(
      launchX,
      btnY,
      LAUNCH_BUTTON_WIDTH,
      LAUNCH_BUTTON_HEIGHT,
      0x225522,
      0.9,
    );
    this.launchBg.setStrokeStyle(2, 0x44aa44);
    this.launchBg.setInteractive({ useHandCursor: true });

    this.launchText = this.add
      .text(launchX, btnY, t("teamSelect.launch"), {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.launchBg.on("pointerdown", () => this.onLaunch());

    this.refreshPlacementToggle();
  }

  private cycleTeamCount(): void {
    const currentIndex = ALLOWED_TEAM_COUNTS.indexOf(
      this.teamCount as (typeof ALLOWED_TEAM_COUNTS)[number],
    );
    const nextIndex = (currentIndex + 1) % ALLOWED_TEAM_COUNTS.length;
    this.teamCount = ALLOWED_TEAM_COUNTS[nextIndex] ?? 2;

    for (const state of this.playerStates) {
      state.validated = false;
      if (state.selectedIds.length > this.maxTeamSize) {
        state.selectedIds = state.selectedIds.slice(0, this.maxTeamSize);
      }
    }

    while (this.playerStates.length < this.teamCount) {
      this.playerStates.push({
        controller: PlayerController.Ai,
        selectedIds: [],
        validated: false,
      });
    }
    while (this.playerStates.length > this.teamCount) {
      this.playerStates.pop();
    }

    if (this.activeColumnIndex >= this.teamCount) {
      this.activeColumnIndex = 0;
    }

    this.refreshTeamCountText();
    this.rebuildColumns();
    this.refreshGrid();
    this.refreshLaunchButton();
  }

  private refreshTeamCountText(): void {
    if (!this.teamCountText) {
      return;
    }
    this.teamCountText.setText(`${this.teamCount} ${t("teamSelect.teams")}`);
  }

  private refreshPlacementToggle(): void {
    if (!this.placementToggleBg || !this.placementToggleText) {
      return;
    }
    const label = this.autoPlacement
      ? t("teamSelect.autoPlacement")
      : t("teamSelect.manualPlacement");
    this.placementToggleText.setText(label);
    this.placementToggleBg.setFillStyle(this.autoPlacement ? 0x442255 : 0x333344, 0.8);
  }

  private onLaunch(): void {
    const allValidated = this.playerStates.every((s) => s.validated);
    if (!allValidated) {
      return;
    }

    const teams: TeamSelection[] = this.playerStates
      .map((state, index) => {
        const playerId = PLAYER_IDS[index];
        if (!playerId) {
          return undefined;
        }
        return {
          playerId,
          pokemonDefinitionIds: [...state.selectedIds],
          controller: state.controller,
        };
      })
      .filter((team): team is TeamSelection => team !== undefined);

    const result: TeamSelectResult = {
      teams,
      autoPlacement: this.autoPlacement,
    };

    this.scene.start("BattleScene", { teamSelectResult: result });
  }

  private refreshAll(): void {
    this.refreshGrid();
    this.refreshLaunchButton();
  }

  private refreshGrid(): void {
    if (!this.gridContainer) {
      return;
    }
    for (let i = 0; i < this.pokemonDefinitions.length; i++) {
      this.refreshGridCell(i);
    }
  }

  private refreshGridCell(index: number): void {
    if (!this.gridContainer) {
      return;
    }
    const definition = this.pokemonDefinitions[index];
    if (!definition) {
      return;
    }
    const bgIndex = index * 2;
    const bg = this.gridContainer.list[bgIndex] as Phaser.GameObjects.Rectangle;
    if (!bg) {
      return;
    }

    const inActiveTeam = this.playerStates[this.activeColumnIndex]?.selectedIds.includes(
      definition.id,
    );

    if (inActiveTeam) {
      const teamColor = this.getTeamColor(this.activeColumnIndex);
      bg.setFillStyle(teamColor, 0.4);
      bg.setStrokeStyle(2, teamColor, 0.8);
      return;
    }

    for (let i = 0; i < this.playerStates.length; i++) {
      if (i === this.activeColumnIndex) {
        continue;
      }
      if (this.playerStates[i]?.selectedIds.includes(definition.id)) {
        const teamColor = this.getTeamColor(i);
        bg.setFillStyle(teamColor, 0.2);
        bg.setStrokeStyle(1, teamColor, 0.4);
        return;
      }
    }

    bg.setFillStyle(0x2a2a3e, 0.8);
    bg.setStrokeStyle(1, 0x444466);
  }

  private refreshLaunchButton(): void {
    if (!this.launchBg || !this.launchText) {
      return;
    }
    const canLaunch = this.playerStates.every((s) => s.validated);

    if (canLaunch) {
      this.launchBg.setFillStyle(0x225522, 0.9);
      this.launchBg.setStrokeStyle(2, 0x44aa44);
      this.launchText.setAlpha(1);
    } else {
      this.launchBg.setFillStyle(0x222222, 0.5);
      this.launchBg.setStrokeStyle(1, 0x444444);
      this.launchText.setAlpha(0.3);
    }
  }
}
