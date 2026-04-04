import {
  PlayerController,
  PlayerId,
  type PokemonDefinition,
  type TeamSelection,
  TeamValidationError,
  validateTeamSelection,
} from "@pokemon-tactic/core";
import { loadData } from "@pokemon-tactic/data";
import {
  BACKGROUND_COLOR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TEAM_COLOR_PLAYER_1,
  TEAM_COLOR_PLAYER_2,
} from "../constants";
import { sandboxBootConfig } from "../sandbox-boot";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import { preloadPortraitsOnly } from "../sprites/SpriteLoader";

const MAX_TEAM_SIZE = 6;

const TITLE_Y = 30;
const GRID_TOP_Y = 70;
const GRID_COLS = 5;
const GRID_CELL_SIZE = 82;
const GRID_CELL_GAP = 6;
const GRID_PORTRAIT_SIZE = 56;

const COLUMN_WIDTH = 180;
const COLUMN_LEFT_X = 30;
const COLUMN_RIGHT_X = CANVAS_WIDTH - COLUMN_WIDTH - 30;
const COLUMN_TOP_Y = 80;
const SLOT_SIZE = 40;
const SLOT_GAP = 6;
const SLOT_COLS = 3;

const BUTTON_COUNT = 3;
const BUTTON_GAP = 6;
const BUTTON_HEIGHT = 24;
const BUTTON_WIDTH = (COLUMN_WIDTH - BUTTON_GAP * (BUTTON_COUNT - 1)) / BUTTON_COUNT;

const HEADER_Y = COLUMN_TOP_Y;
const SLOTS_TOP_Y = COLUMN_TOP_Y + 30;
const BUTTONS_Y = SLOTS_TOP_Y + Math.ceil(MAX_TEAM_SIZE / SLOT_COLS) * (SLOT_SIZE + SLOT_GAP) + 10;
const ERROR_TEXT_Y = BUTTONS_Y + BUTTON_HEIGHT + 6;

const COLUMN_PADDING = 8;
const COLUMN_HIGHLIGHT_TOP = HEADER_Y - COLUMN_PADDING;
const COLUMN_HIGHLIGHT_HEIGHT = BUTTONS_Y + BUTTON_HEIGHT - COLUMN_HIGHLIGHT_TOP + COLUMN_PADDING;

const LAUNCH_BUTTON_Y = CANVAS_HEIGHT - 50;
const LAUNCH_BUTTON_WIDTH = 200;
const LAUNCH_BUTTON_HEIGHT = 36;

const ERROR_I18N_MAP: Record<TeamValidationError, TranslationKey> = {
  [TeamValidationError.EmptyTeam]: "teamSelect.errorEmpty",
  [TeamValidationError.ExceedsMaxSize]: "teamSelect.errorTooMany",
  [TeamValidationError.DuplicatePokemon]: "teamSelect.errorDuplicate",
  [TeamValidationError.UnknownPokemon]: "teamSelect.errorUnknown",
};

interface PlayerColumnState {
  controller: PlayerController;
  selectedIds: string[];
  validated: boolean;
}

export interface TeamSelectResult {
  teams: [TeamSelection, TeamSelection];
  autoPlacement: boolean;
}

export class TeamSelectScene extends Phaser.Scene {
  private pokemonDefinitions: PokemonDefinition[] = [];
  private allDefinitionIds: string[] = [];

  private playerStates: [PlayerColumnState, PlayerColumnState] = [
    { controller: PlayerController.Human, selectedIds: [], validated: false },
    { controller: PlayerController.Ai, selectedIds: [], validated: false },
  ];
  private activeColumnIndex = 0;

  private toggleBgs: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle] | null = null;
  private toggleTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text] | null = null;
  private validateBgs: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle] | null = null;
  private validateTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text] | null = null;
  private slotContainers: [
    Phaser.GameObjects.Container | null,
    Phaser.GameObjects.Container | null,
  ] = [null, null];
  private columnHighlights: [
    Phaser.GameObjects.Rectangle | null,
    Phaser.GameObjects.Rectangle | null,
  ] = [null, null];
  private errorTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text] | null = null;
  private gridContainer: Phaser.GameObjects.Container | null = null;
  private launchBg: Phaser.GameObjects.Rectangle | null = null;
  private launchText: Phaser.GameObjects.Text | null = null;
  private autoPlacement = false;
  private placementToggleBg: Phaser.GameObjects.Rectangle | null = null;
  private placementToggleText: Phaser.GameObjects.Text | null = null;

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

    this.buildColumns();
    this.buildGrid();
    this.buildLaunchButton();

    this.refreshAll();
  }

  private getColumnX(colIndex: number): number {
    return colIndex === 0 ? COLUMN_LEFT_X : COLUMN_RIGHT_X;
  }

  private getTeamColor(colIndex: number): number {
    return colIndex === 0 ? TEAM_COLOR_PLAYER_1 : TEAM_COLOR_PLAYER_2;
  }

  private getSlotsGridWidth(): number {
    return SLOT_COLS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
  }

  private getSlotsStartX(colIndex: number): number {
    const x = this.getColumnX(colIndex);
    return x + (COLUMN_WIDTH - this.getSlotsGridWidth()) / 2;
  }

  private buildColumns(): void {
    const toggleBgs: Phaser.GameObjects.Rectangle[] = [];
    const toggleTexts: Phaser.GameObjects.Text[] = [];
    const validateBgs: Phaser.GameObjects.Rectangle[] = [];
    const validateTexts: Phaser.GameObjects.Text[] = [];

    this.errorTexts = [
      this.add.text(COLUMN_LEFT_X, ERROR_TEXT_Y, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#ff4444",
        wordWrap: { width: COLUMN_WIDTH },
      }),
      this.add.text(COLUMN_RIGHT_X, ERROR_TEXT_Y, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#ff4444",
        wordWrap: { width: COLUMN_WIDTH },
      }),
    ];

    for (let colIndex = 0; colIndex < 2; colIndex++) {
      const x = this.getColumnX(colIndex);
      const teamColor = this.getTeamColor(colIndex);

      const label = colIndex === 0 ? t("teamSelect.player1") : t("teamSelect.player2");
      this.add.text(x, HEADER_Y, label, {
        fontSize: "13px",
        fontFamily: "monospace",
        color: `#${teamColor.toString(16).padStart(6, "0")}`,
        fontStyle: "bold",
      });

      const { toggleBg, toggleText } = this.buildControllerToggle(colIndex);
      toggleBgs.push(toggleBg);
      toggleTexts.push(toggleText);

      this.buildSlotBackgrounds(colIndex);

      const { validateBg, validateText } = this.buildValidateButton(colIndex);
      validateBgs.push(validateBg);
      validateTexts.push(validateText);

      this.buildAutoButton(colIndex);
      this.buildClearButton(colIndex);
    }

    this.toggleBgs = toggleBgs as [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle];
    this.toggleTexts = toggleTexts as [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
    this.validateBgs = validateBgs as [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle];
    this.validateTexts = validateTexts as [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  }

  private buildControllerToggle(colIndex: number): {
    toggleBg: Phaser.GameObjects.Rectangle;
    toggleText: Phaser.GameObjects.Text;
  } {
    const x = this.getColumnX(colIndex);
    const toggleX = x + COLUMN_WIDTH - 40;
    const toggleY = HEADER_Y + 7;

    const toggleBg = this.add
      .rectangle(toggleX, toggleY, 80, 20, 0x225522, 0.8)
      .setInteractive({ useHandCursor: true });
    const toggleText = this.add
      .text(toggleX, toggleY, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    toggleBg.on("pointerdown", () => {
      const state = this.playerStates[colIndex]!;
      if (state.validated) return;
      state.controller =
        state.controller === PlayerController.Human ? PlayerController.Ai : PlayerController.Human;
      this.refreshAll();
    });

    return { toggleBg, toggleText };
  }

  private buildSlotBackgrounds(colIndex: number): void {
    const startX = this.getSlotsStartX(colIndex);
    const teamColor = this.getTeamColor(colIndex);
    for (let i = 0; i < MAX_TEAM_SIZE; i++) {
      const col = i % SLOT_COLS;
      const row = Math.floor(i / SLOT_COLS);
      const slotX = startX + col * (SLOT_SIZE + SLOT_GAP);
      const slotY = SLOTS_TOP_Y + row * (SLOT_SIZE + SLOT_GAP);

      const bg = this.add.rectangle(
        slotX + SLOT_SIZE / 2,
        slotY + SLOT_SIZE / 2,
        SLOT_SIZE,
        SLOT_SIZE,
        teamColor,
        0.15,
      );
      bg.setStrokeStyle(1, teamColor, 0.3);
    }
  }

  private getButtonX(colIndex: number, buttonIndex: number): number {
    return this.getColumnX(colIndex) + buttonIndex * (BUTTON_WIDTH + BUTTON_GAP) + BUTTON_WIDTH / 2;
  }

  private buildValidateButton(colIndex: number): {
    validateBg: Phaser.GameObjects.Rectangle;
    validateText: Phaser.GameObjects.Text;
  } {
    const buttonX = this.getButtonX(colIndex, 0);
    const buttonY = BUTTONS_Y + BUTTON_HEIGHT / 2;

    const validateBg = this.add
      .rectangle(buttonX, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT, 0x335533, 0.9)
      .setInteractive({ useHandCursor: true });
    validateBg.setStrokeStyle(1, 0x558855);
    const validateText = this.add
      .text(buttonX, buttonY, "", { fontSize: "11px", fontFamily: "monospace", color: "#ffffff" })
      .setOrigin(0.5);

    validateBg.on("pointerdown", () => {
      const state = this.playerStates[colIndex]!;
      if (state.validated) {
        state.validated = false;
      } else {
        const playerId = colIndex === 0 ? PlayerId.Player1 : PlayerId.Player2;
        const result = validateTeamSelection(
          { playerId, pokemonDefinitionIds: state.selectedIds, controller: state.controller },
          this.allDefinitionIds,
          MAX_TEAM_SIZE,
        );
        if (result.valid) {
          state.validated = true;
          this.errorTexts![colIndex]!.setText("");
        } else {
          const errorMessages = result.errors.map((error) => t(ERROR_I18N_MAP[error]));
          this.errorTexts![colIndex]!.setText(errorMessages.join("\n"));
          return;
        }
      }
      this.refreshAll();
    });

    return { validateBg, validateText };
  }

  private buildAutoButton(colIndex: number): void {
    const buttonX = this.getButtonX(colIndex, 1);
    const buttonY = BUTTONS_Y + BUTTON_HEIGHT / 2;

    const bg = this.add
      .rectangle(buttonX, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT, 0x333355, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(1, 0x555577);
    this.add
      .text(buttonX, buttonY, t("teamSelect.autoFill"), {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#aaaacc",
      })
      .setOrigin(0.5);

    bg.on("pointerdown", () => {
      const state = this.playerStates[colIndex]!;
      if (state.validated) return;
      this.autoFillTeam(colIndex);
      this.refreshAll();
    });
  }

  private buildClearButton(colIndex: number): void {
    const buttonX = this.getButtonX(colIndex, 2);
    const buttonY = BUTTONS_Y + BUTTON_HEIGHT / 2;

    const bg = this.add
      .rectangle(buttonX, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT, 0x443333, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(1, 0x775555);
    this.add
      .text(buttonX, buttonY, t("teamSelect.clear"), {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#ccaaaa",
      })
      .setOrigin(0.5);

    bg.on("pointerdown", () => {
      const state = this.playerStates[colIndex]!;
      if (state.validated) return;
      state.selectedIds = [];
      this.errorTexts![colIndex]!.setText("");
      this.refreshAll();
    });
  }

  private autoFillTeam(colIndex: number): void {
    const state = this.playerStates[colIndex]!;
    state.selectedIds = [];
    const shuffled = [...this.allDefinitionIds].sort(() => Math.random() - 0.5);
    state.selectedIds = shuffled.slice(0, MAX_TEAM_SIZE);
  }

  private getPokemonName(definitionId: string): string {
    const key = `pokemon.${definitionId}` as TranslationKey;
    const translated = t(key);
    // Fallback to key if no translation (t returns the key itself)
    if (translated === key) {
      const definition = this.pokemonDefinitions.find((p) => p.id === definitionId);
      return definition?.name ?? definitionId;
    }
    return translated;
  }

  private buildGrid(): void {
    const gridWidth = GRID_COLS * (GRID_CELL_SIZE + GRID_CELL_GAP) - GRID_CELL_GAP;
    const gridStartX = (CANVAS_WIDTH - gridWidth) / 2;

    this.gridContainer = this.add.container(0, 0);

    for (let i = 0; i < this.pokemonDefinitions.length; i++) {
      const definition = this.pokemonDefinitions[i]!;
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
    const state = this.playerStates[this.activeColumnIndex]!;
    if (state.validated) return;

    const existingIndex = state.selectedIds.indexOf(definitionId);
    if (existingIndex >= 0) {
      state.selectedIds.splice(existingIndex, 1);
    } else {
      if (state.selectedIds.length >= MAX_TEAM_SIZE) return;
      state.selectedIds.push(definitionId);
    }

    this.errorTexts![this.activeColumnIndex]!.setText("");
    this.refreshAll();
  }

  private buildLaunchButton(): void {
    const centerX = CANVAS_WIDTH / 2;

    const toggleX = centerX - LAUNCH_BUTTON_WIDTH / 2 - 90;
    this.placementToggleBg = this.add
      .rectangle(toggleX, LAUNCH_BUTTON_Y, 150, 28, 0x333344, 0.8)
      .setInteractive({ useHandCursor: true });
    this.placementToggleBg.setStrokeStyle(1, 0x555566);
    this.placementToggleText = this.add
      .text(toggleX, LAUNCH_BUTTON_Y, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.placementToggleBg.on("pointerdown", () => {
      this.autoPlacement = !this.autoPlacement;
      this.refreshPlacementToggle();
    });

    this.launchBg = this.add.rectangle(
      centerX,
      LAUNCH_BUTTON_Y,
      LAUNCH_BUTTON_WIDTH,
      LAUNCH_BUTTON_HEIGHT,
      0x225522,
      0.9,
    );
    this.launchBg.setStrokeStyle(2, 0x44aa44);
    this.launchBg.setInteractive({ useHandCursor: true });

    this.launchText = this.add
      .text(centerX, LAUNCH_BUTTON_Y, t("teamSelect.launch"), {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.launchBg.on("pointerdown", () => this.onLaunch());

    this.refreshPlacementToggle();
  }

  private refreshPlacementToggle(): void {
    if (!this.placementToggleBg || !this.placementToggleText) return;
    const label = this.autoPlacement
      ? t("teamSelect.autoPlacement")
      : t("teamSelect.manualPlacement");
    this.placementToggleText.setText(label);
    this.placementToggleBg.setFillStyle(this.autoPlacement ? 0x442255 : 0x333344, 0.8);
  }

  private onLaunch(): void {
    const [state1, state2] = this.playerStates;
    if (!state1.validated || !state2.validated) return;

    const result: TeamSelectResult = {
      teams: [
        {
          playerId: PlayerId.Player1,
          pokemonDefinitionIds: [...state1.selectedIds],
          controller: state1.controller,
        },
        {
          playerId: PlayerId.Player2,
          pokemonDefinitionIds: [...state2.selectedIds],
          controller: state2.controller,
        },
      ],
      autoPlacement: this.autoPlacement,
    };

    this.scene.start("BattleScene", { teamSelectResult: result });
  }

  private refreshAll(): void {
    this.refreshColumns();
    this.refreshGrid();
    this.refreshLaunchButton();
  }

  private refreshColumns(): void {
    if (!this.toggleBgs || !this.toggleTexts || !this.validateBgs || !this.validateTexts) return;

    for (let colIndex = 0; colIndex < 2; colIndex++) {
      const state = this.playerStates[colIndex]!;

      const isHuman = state.controller === PlayerController.Human;
      this.toggleBgs[colIndex]!.setFillStyle(isHuman ? 0x225522 : 0x442255, 0.8);
      this.toggleTexts[colIndex]!.setText(isHuman ? t("teamSelect.human") : t("teamSelect.ai"));

      if (state.validated) {
        this.validateBgs[colIndex]!.setFillStyle(0x553322, 0.9);
        this.validateTexts[colIndex]!.setText(t("teamSelect.modify"));
      } else {
        this.validateBgs[colIndex]!.setFillStyle(0x335533, 0.9);
        this.validateTexts[colIndex]!.setText(t("teamSelect.validate"));
      }

      this.refreshSlotPortraits(colIndex);
    }

    this.refreshColumnHighlights();
  }

  private refreshSlotPortraits(colIndex: number): void {
    const state = this.playerStates[colIndex]!;
    const startX = this.getSlotsStartX(colIndex);

    const existing = this.slotContainers[colIndex];
    if (existing) {
      existing.destroy(true);
    }

    const slotContainer = this.add.container(0, 0);

    for (let i = 0; i < MAX_TEAM_SIZE; i++) {
      const col = i % SLOT_COLS;
      const row = Math.floor(i / SLOT_COLS);
      const slotX = startX + col * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
      const slotY = SLOTS_TOP_Y + row * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;

      if (i < state.selectedIds.length) {
        const defId = state.selectedIds[i]!;
        const portrait = this.add.image(slotX, slotY, `${defId}-portrait`);
        portrait.setDisplaySize(SLOT_SIZE - 4, SLOT_SIZE - 4);

        if (!state.validated) {
          portrait.setInteractive({ useHandCursor: true });
          portrait.on("pointerdown", () => {
            state.selectedIds.splice(i, 1);
            this.errorTexts![colIndex]!.setText("");
            this.refreshAll();
          });
        }

        slotContainer.add(portrait);
      }
    }

    this.slotContainers[colIndex] = slotContainer;
  }

  private refreshColumnHighlights(): void {
    for (let colIndex = 0; colIndex < 2; colIndex++) {
      const x = this.getColumnX(colIndex);
      const teamColor = this.getTeamColor(colIndex);
      const isActive = colIndex === this.activeColumnIndex;

      const existing = this.columnHighlights[colIndex];
      if (existing) existing.destroy();

      const highlightY = COLUMN_HIGHLIGHT_TOP + COLUMN_HIGHLIGHT_HEIGHT / 2;
      const alpha = isActive ? 0.12 : 0.04;
      const strokeAlpha = isActive ? 0.5 : 0.15;

      const highlight = this.add.rectangle(
        x + COLUMN_WIDTH / 2,
        highlightY,
        COLUMN_WIDTH + 10,
        COLUMN_HIGHLIGHT_HEIGHT,
        teamColor,
        alpha,
      );
      highlight.setStrokeStyle(isActive ? 2 : 1, teamColor, strokeAlpha);
      highlight.setDepth(-1);

      highlight.setInteractive({ useHandCursor: true });
      highlight.on("pointerdown", () => {
        if (this.activeColumnIndex !== colIndex) {
          this.activeColumnIndex = colIndex;
          this.refreshAll();
        }
      });

      this.columnHighlights[colIndex] = highlight;
    }
  }

  private refreshGrid(): void {
    if (!this.gridContainer) return;

    for (let i = 0; i < this.pokemonDefinitions.length; i++) {
      this.refreshGridCell(i);
    }
  }

  private refreshGridCell(index: number): void {
    if (!this.gridContainer) return;
    const definition = this.pokemonDefinitions[index]!;
    const bgIndex = index * 2;
    const bg = this.gridContainer.list[bgIndex] as Phaser.GameObjects.Rectangle;
    if (!bg) return;

    const inActiveTeam = this.playerStates[this.activeColumnIndex]!.selectedIds.includes(
      definition.id,
    );
    const inTeam1 = this.playerStates[0].selectedIds.includes(definition.id);
    const inTeam2 = this.playerStates[1].selectedIds.includes(definition.id);

    if (inActiveTeam) {
      const teamColor = this.getTeamColor(this.activeColumnIndex);
      bg.setFillStyle(teamColor, 0.4);
      bg.setStrokeStyle(2, teamColor, 0.8);
    } else if (inTeam1) {
      bg.setFillStyle(TEAM_COLOR_PLAYER_1, 0.2);
      bg.setStrokeStyle(1, TEAM_COLOR_PLAYER_1, 0.4);
    } else if (inTeam2) {
      bg.setFillStyle(TEAM_COLOR_PLAYER_2, 0.2);
      bg.setStrokeStyle(1, TEAM_COLOR_PLAYER_2, 0.4);
    } else {
      bg.setFillStyle(0x2a2a3e, 0.8);
      bg.setStrokeStyle(1, 0x444466);
    }
  }

  private refreshLaunchButton(): void {
    if (!this.launchBg || !this.launchText) return;
    const [state1, state2] = this.playerStates;
    const canLaunch = state1.validated && state2.validated;

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
