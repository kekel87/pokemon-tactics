import {
  createPrng,
  EASY_PROFILE,
  type PlacementEntry,
  PlacementMode,
  PlacementPhase,
  PlayerController,
  type PokemonDefinition,
} from "@pokemon-tactic/core";
import { loadData } from "@pokemon-tactic/data";
import {
  ARROW_PAN_SPEED,
  STATUS_ICON_KEYS,
  TILESET_KEY,
  TYPE_NAMES,
  ZOOM_DEFAULT_INDEX,
  ZOOM_LEVELS,
  ZOOM_TWEEN_DURATION_MS,
} from "../constants";
import { AiTeamController } from "../game/AiTeamController";
import { type BattleSetupConfig, createBattleFromPlacements } from "../game/BattleSetup";
import { DummyAiController } from "../game/DummyAiController";
import { GameController, type PlacementConfig } from "../game/GameController";
import { createSandboxBattle } from "../game/SandboxSetup";
import { IsometricGrid } from "../grid/IsometricGrid";
import { loadTiledMap } from "../maps/load-tiled-map";
import { PokemonSprite } from "../sprites/PokemonSprite";
import { createPokemonAnimations, preloadPokemonAssets } from "../sprites/SpriteLoader";
import { DEFAULT_SANDBOX_CONFIG, type SandboxConfig } from "../types/SandboxConfig";
import { DirectionPicker } from "../ui/DirectionPicker";
import { LanguageToggle } from "../ui/LanguageToggle";
import { SandboxPanel } from "../ui/SandboxPanel";
import type { BattleUIScene } from "./BattleUIScene";
import { computeCameraBounds } from "./camera-bounds";
import type { TeamSelectResult } from "./TeamSelectScene";

export class BattleScene extends Phaser.Scene {
  private lastHoverGrid: { x: number; y: number } | null = null;
  private pokemonDefinitions!: Map<string, PokemonDefinition>;
  private zoomIndex = ZOOM_DEFAULT_INDEX;
  private controller: GameController | null = null;
  private arrowKeysDown = new Set<string>();
  private sandboxPanel: SandboxPanel | null = null;
  private sandboxUiScene: BattleUIScene | null = null;
  private languageToggle: LanguageToggle | null = null;

  constructor() {
    super("BattleScene");
  }

  preload(): void {
    const gameData = loadData();
    this.pokemonDefinitions = new Map(gameData.pokemon.map((p) => [p.id, p]));

    const allDefinitionIds = [...this.pokemonDefinitions.keys()];
    preloadPokemonAssets(
      this,
      allDefinitionIds.map((id) => ({ definitionId: id })),
    );

    this.load.spritesheet("arrows", "assets/ui/arrows.png", {
      frameWidth: 32,
      frameHeight: 32,
    });

    for (const typeName of TYPE_NAMES) {
      this.load.image(`type-${typeName}`, `assets/ui/types/${typeName}.png`);
    }

    this.load.image("category-physical", "assets/ui/categories/physical.png");
    this.load.image("category-special", "assets/ui/categories/special.png");
    this.load.image("category-status", "assets/ui/categories/status.png");

    for (const key of STATUS_ICON_KEYS) {
      this.load.image(`status-icon-${key}`, `assets/ui/statuses/icon-${key}.png`);
      this.load.image(`status-label-${key}`, `assets/ui/statuses/label-${key}.png`);
    }

    this.load.spritesheet(TILESET_KEY, "assets/tilesets/terrain/icon-tileset.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create(): void {
    const tilesetTexture = this.textures.get(TILESET_KEY);
    if (tilesetTexture) {
      tilesetTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    for (const definitionId of this.pokemonDefinitions.keys()) {
      createPokemonAnimations(this, definitionId);
    }

    this.cameras.main.setZoom(ZOOM_LEVELS[this.zoomIndex]);

    this.languageToggle?.destroy();
    this.languageToggle = new LanguageToggle(() => {
      this.sandboxPanel?.destroy();
      this.sandboxPanel = null;
      this.languageToggle?.destroy();
      this.languageToggle = null;
      this.scene.restart();
    });

    this.scene.stop("BattleUIScene");

    this.events.once("uiReady", () => {
      const uiScene = this.scene.get("BattleUIScene") as BattleUIScene;
      const sceneData = this.scene.settings.data as
        | {
            teamSelectResult?: TeamSelectResult;
            sandboxMode?: boolean;
            sandboxConfig?: SandboxConfig | null;
          }
        | undefined;
      if (sceneData?.sandboxMode) {
        const config = sceneData.sandboxConfig ?? DEFAULT_SANDBOX_CONFIG;
        void this.startSandboxMode(uiScene, config);
      } else {
        if (!sceneData?.teamSelectResult) {
          throw new Error("BattleScene requires teamSelectResult from TeamSelectScene");
        }
        void this.startPlacementPhase(
          uiScene,
          sceneData.teamSelectResult,
          sceneData.teamSelectResult.autoPlacement,
        );
      }
    });

    this.scene.launch("BattleUIScene");
  }

  private async startSandboxMode(uiScene: BattleUIScene, config: SandboxConfig): Promise<void> {
    this.sandboxUiScene = uiScene;

    this.sandboxPanel = new SandboxPanel(config, (newConfig: SandboxConfig) => {
      void this.resetSandbox(newConfig);
    });

    await this.initSandboxBattle(uiScene, config);
  }

  private async initSandboxBattle(uiScene: BattleUIScene, config: SandboxConfig): Promise<void> {
    const mapUrl = config.mapUrl ?? "assets/maps/sandbox-flat.tmj";
    const loaded = await loadTiledMap(mapUrl);
    const tiledMap = loaded.map;
    const maxHeight = loaded.heightData.length > 0 ? Math.max(...loaded.heightData) : 0;
    this.setupCameraBounds(loaded.map.width, loaded.map.height, maxHeight);
    const isometricGrid = new IsometricGrid(this, loaded.map.width, loaded.map.height);
    isometricGrid.drawGridFromTileData(
      loaded.elevationLayers,
      loaded.firstgid,
      loaded.heightData,
      loaded.slopeData,
    );

    const sprites = new Map<string, PokemonSprite>();
    const directionPicker = new DirectionPicker(this);

    const controller = new GameController(
      this,
      isometricGrid,
      sprites,
      uiScene.battleUI,
      uiScene.actionMenu,
      directionPicker,
      uiScene.infoPanel,
      uiScene.turnTimeline,
      uiScene.placementRosterPanel,
      uiScene.battleLogPanel,
    );
    this.controller = controller;
    this.setupInput(controller, isometricGrid, uiScene);

    const battleSetup = createSandboxBattle(config, tiledMap);
    controller.setSetup(battleSetup);
    controller.setupBattleLogClickHandler();

    const dummyPokemonId = `p2-${config.dummyPokemon}`;
    const dummyAi = new DummyAiController(
      battleSetup.engine,
      dummyPokemonId,
      config.dummyMove,
      config.dummyDirection,
    );

    controller.onTurnReady = (activePokemonId: string) => {
      if (activePokemonId === dummyPokemonId) {
        return dummyAi.playTurn();
      }
      return false;
    };

    for (const pokemon of battleSetup.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        continue;
      }
      const definition = battleSetup.pokemonDefinitions.get(pokemon.definitionId);
      const types = definition?.types ?? ["normal"];
      const sprite = new PokemonSprite(this, isometricGrid, pokemon, types);
      sprites.set(pokemon.id, sprite);
    }

    controller.refreshUI();
  }

  private async resetSandbox(config: SandboxConfig): Promise<void> {
    if (!this.sandboxUiScene) {
      return;
    }
    this.children.removeAll(true);
    this.controller = null;
    this.lastHoverGrid = null;
    this.arrowKeysDown.clear();
    this.input.removeAllListeners();

    this.sandboxUiScene.battleUI.hideVictory();
    this.sandboxUiScene.actionMenu.hide();

    this.cameras.main.setZoom(ZOOM_LEVELS[this.zoomIndex]);
    await this.initSandboxBattle(this.sandboxUiScene, config);
  }

  private async startPlacementPhase(
    uiScene: BattleUIScene,
    teamSelectResult: TeamSelectResult,
    autoPlacement: boolean,
  ): Promise<void> {
    const loaded = await loadTiledMap("assets/maps/test-arena.tmj");
    const map = loaded.map;
    const teamCount = teamSelectResult.teams.length;
    const format = map.formats.find((f) => f.teamCount === teamCount);
    if (!format) {
      throw new Error(`Map "${map.name}" has no format for ${teamCount} teams`);
    }

    const teams: import("@pokemon-tactic/core").PlacementTeam[] = teamSelectResult.teams.map(
      (selection, index) => ({
        playerId: selection.playerId,
        pokemonIds: selection.pokemonDefinitionIds.map((defId) => `p${index + 1}-${defId}`),
        controller: selection.controller,
      }),
    );

    const battleMaxHeight = loaded.heightData.length > 0 ? Math.max(...loaded.heightData) : 0;
    this.setupCameraBounds(map.width, map.height, battleMaxHeight);

    const isometricGrid = new IsometricGrid(this, map.width, map.height);
    isometricGrid.drawGridFromTileData(
      loaded.elevationLayers,
      loaded.firstgid,
      loaded.heightData,
      loaded.slopeData,
    );

    const sprites = new Map<string, PokemonSprite>();
    const directionPicker = new DirectionPicker(this);

    const controller = new GameController(
      this,
      isometricGrid,
      sprites,
      uiScene.battleUI,
      uiScene.actionMenu,
      directionPicker,
      uiScene.infoPanel,
      uiScene.turnTimeline,
      uiScene.placementRosterPanel,
      uiScene.battleLogPanel,
    );
    this.controller = controller;
    this.setupInput(controller, isometricGrid, uiScene);

    const allAi = teams.every((team) => team.controller === PlayerController.Ai);
    const useRandomPlacement = allAi || autoPlacement;

    if (useRandomPlacement) {
      const gridCenter = {
        x: Math.floor(map.width / 2),
        y: Math.floor(map.height / 2),
      };
      const randomPhase = new PlacementPhase(map, teams, format, PlacementMode.Random);
      const placements = randomPhase.autoPlaceAll(gridCenter);
      this.transitionToBattle(controller, isometricGrid, sprites, {
        map,
        teams,
        placements,
      });
      return;
    }

    const placementPhase = new PlacementPhase(map, teams, format, PlacementMode.Alternating);

    const formatIndex = map.formats.indexOf(format);
    const placementConfig: PlacementConfig = {
      placementPhase,
      teams,
      map,
      formatIndex,
      pokemonDefinitions: this.pokemonDefinitions,
      onPlacementComplete: (placements: PlacementEntry[]) => {
        this.transitionToBattle(controller, isometricGrid, sprites, {
          map,
          teams,
          placements,
        });
      },
    };

    controller.startPlacement(placementConfig);
  }

  private transitionToBattle(
    controller: GameController,
    isometricGrid: IsometricGrid,
    sprites: Map<string, PokemonSprite>,
    config: BattleSetupConfig,
  ): void {
    const battleSetup = createBattleFromPlacements(config);
    controller.setSetup(battleSetup);
    controller.setupBattleLogClickHandler();

    const aiTeams = config.teams.filter((team) => team.controller === PlayerController.Ai);
    if (aiTeams.length > 0) {
      const aiControllers = new Map<string, AiTeamController>();
      for (const aiTeam of aiTeams) {
        aiControllers.set(
          aiTeam.playerId,
          new AiTeamController(
            battleSetup.engine,
            aiTeam.playerId,
            EASY_PROFILE,
            createPrng(Date.now()),
            battleSetup.moveDefinitions,
          ),
        );
      }

      controller.onTurnReady = (activePokemonId: string) => {
        const pokemon = battleSetup.state.pokemon.get(activePokemonId);
        if (!pokemon) {
          return false;
        }
        const aiController = aiControllers.get(pokemon.playerId);
        if (aiController) {
          return aiController.playTurn();
        }
        return false;
      };
    }

    for (const pokemon of battleSetup.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        continue;
      }

      const definition = battleSetup.pokemonDefinitions.get(pokemon.definitionId);
      const types = definition?.types ?? ["normal"];

      const sprite = new PokemonSprite(this, isometricGrid, pokemon, types);
      sprites.set(pokemon.id, sprite);
    }

    controller.refreshUI();
  }

  private setupInput(
    controller: GameController,
    isometricGrid: IsometricGrid,
    uiScene: BattleUIScene,
  ): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const grid = isometricGrid.screenToGrid(pointer.worldX, pointer.worldY);
      if (grid) {
        controller.handleTileClick(grid.x, grid.y);
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (controller.isAnimating) {
        return;
      }

      const grid = isometricGrid.screenToGrid(pointer.worldX, pointer.worldY);
      const worldPosition = { x: pointer.worldX, y: pointer.worldY };

      controller.handleTileHover(grid, worldPosition);

      if (grid) {
        if (
          !this.lastHoverGrid ||
          this.lastHoverGrid.x !== grid.x ||
          this.lastHoverGrid.y !== grid.y
        ) {
          this.lastHoverGrid = grid;
          isometricGrid.showCursor(grid.x, grid.y);

          const hoveredPokemon = controller.getPokemonAtPosition(grid.x, grid.y);
          controller.handleEnemyRangeHover(hoveredPokemon);
          if (hoveredPokemon) {
            uiScene.infoPanel.update(hoveredPokemon, hoveredPokemon.playerId);
          } else {
            const activePokemon = controller.getActivePokemon();
            if (activePokemon) {
              uiScene.infoPanel.update(activePokemon, activePokemon.playerId);
            }
          }
        }
      } else if (this.lastHoverGrid) {
        this.lastHoverGrid = null;
        isometricGrid.hideCursor();
        controller.handleEnemyRangeHover(null);
        const activePokemon = controller.getActivePokemon();
        if (activePokemon) {
          uiScene.infoPanel.update(activePokemon, activePokemon.playerId);
        }
      }
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      controller.handleEscapeKey();
    });

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _deltaX: number,
        deltaY: number,
      ) => {
        this.changeZoom(deltaY > 0 ? -1 : 1);
      },
    );

    this.input.keyboard?.on("keydown-PLUS", () => this.changeZoom(1));
    this.input.keyboard?.on("keydown-EQUAL", () => this.changeZoom(1));
    this.input.keyboard?.on("keydown-MINUS", () => this.changeZoom(-1));
    this.input.keyboard?.on("keydown-NUMPAD_ADD", () => this.changeZoom(1));
    this.input.keyboard?.on("keydown-NUMPAD_SUBTRACT", () => this.changeZoom(-1));

    this.input.keyboard?.on("keydown-SPACE", () => controller.handleSpaceKey());
    this.input.keyboard?.on("keydown-C", () => this.recenterOnActivePokemon(isometricGrid));

    for (const arrow of ["UP", "DOWN", "LEFT", "RIGHT"]) {
      this.input.keyboard?.on(`keydown-${arrow}`, () => this.arrowKeysDown.add(arrow));
      this.input.keyboard?.on(`keyup-${arrow}`, () => this.arrowKeysDown.delete(arrow));
    }
  }

  update(): void {
    if (this.arrowKeysDown.size === 0) {
      return;
    }

    const camera = this.cameras.main;
    const speed = ARROW_PAN_SPEED / camera.zoom;

    if (this.arrowKeysDown.has("LEFT")) {
      camera.scrollX -= speed;
    }
    if (this.arrowKeysDown.has("RIGHT")) {
      camera.scrollX += speed;
    }
    if (this.arrowKeysDown.has("UP")) {
      camera.scrollY -= speed;
    }
    if (this.arrowKeysDown.has("DOWN")) {
      camera.scrollY += speed;
    }
  }

  private recenterOnActivePokemon(isometricGrid: IsometricGrid): void {
    const activePokemon = this.controller?.getActivePokemon();
    if (!activePokemon) {
      return;
    }
    const screenPos = isometricGrid.gridToScreen(
      activePokemon.position.x,
      activePokemon.position.y,
    );
    this.cameras.main.pan(screenPos.x, screenPos.y, 400, "Sine.easeInOut");
  }

  private setupCameraBounds(gridWidth: number, gridHeight: number, maxTileHeight = 0): void {
    const bounds = computeCameraBounds(gridWidth, gridHeight, maxTileHeight);
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  private changeZoom(direction: number): void {
    const newIndex = this.zoomIndex + direction;
    if (newIndex < 0 || newIndex >= ZOOM_LEVELS.length) {
      return;
    }
    this.zoomIndex = newIndex;
    const targetZoom = ZOOM_LEVELS[this.zoomIndex];

    this.tweens.add({
      targets: this.cameras.main,
      zoom: targetZoom,
      duration: ZOOM_TWEEN_DURATION_MS,
      ease: "Sine.easeInOut",
    });
  }
}
