import {
  type PlacementEntry,
  PlacementMode,
  PlacementPhase,
  type PlacementTeam,
  PlayerController,
  PlayerId,
  type PokemonDefinition,
} from "@pokemon-tactic/core";
import { loadData, pocArena } from "@pokemon-tactic/data";
import { type BattleSetupConfig, createBattleFromPlacements } from "../game/BattleSetup";
import { GameController, type PlacementConfig } from "../game/GameController";
import { IsometricGrid } from "../grid/IsometricGrid";
import { PokemonSprite } from "../sprites/PokemonSprite";
import { createPokemonAnimations, preloadPokemonAssets } from "../sprites/SpriteLoader";
import { DirectionPicker } from "../ui/DirectionPicker";
import type { BattleUIScene } from "./BattleUIScene";

export class BattleScene extends Phaser.Scene {
  private lastHoverGrid: { x: number; y: number } | null = null;
  private pokemonDefinitions!: Map<string, PokemonDefinition>;

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
  }

  create(): void {
    for (const definitionId of this.pokemonDefinitions.keys()) {
      createPokemonAnimations(this, definitionId);
    }

    this.scene.stop("BattleUIScene");

    this.events.once("uiReady", () => {
      const uiScene = this.scene.get("BattleUIScene") as BattleUIScene;
      this.startPlacementPhase(uiScene);
    });

    this.scene.launch("BattleUIScene");
  }

  private startPlacementPhase(uiScene: BattleUIScene): void {
    const map = pocArena;
    const format = map.formats[0];
    if (!format) {
      throw new Error("POC arena has no formats defined");
    }

    const teams: PlacementTeam[] = [
      {
        playerId: PlayerId.Player1,
        pokemonIds: ["p1-bulbasaur", "p1-squirtle"],
        controller: PlayerController.Human,
      },
      {
        playerId: PlayerId.Player2,
        pokemonIds: ["p2-charmander", "p2-pidgey"],
        controller: PlayerController.Human,
      },
    ];

    const placementPhase = new PlacementPhase(map, teams, format, PlacementMode.Alternating);

    const isometricGrid = new IsometricGrid(this);
    isometricGrid.drawGrid();

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
    );
    this.setupInput(controller, isometricGrid, uiScene);

    const placementConfig: PlacementConfig = {
      placementPhase,
      teams,
      map,
      formatIndex: 0,
      pokemonDefinitions: this.pokemonDefinitions,
      onPlacementComplete: (placements: PlacementEntry[]) => {
        this.transitionToBattle(controller, isometricGrid, sprites, { map, teams, placements });
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

    for (const pokemon of battleSetup.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) continue;

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
      if (controller.isAnimating) return;

      const grid = isometricGrid.screenToGrid(pointer.worldX, pointer.worldY);

      if (grid) {
        if (
          !this.lastHoverGrid ||
          this.lastHoverGrid.x !== grid.x ||
          this.lastHoverGrid.y !== grid.y
        ) {
          this.lastHoverGrid = grid;
          isometricGrid.showCursor(grid.x, grid.y);

          const hoveredPokemon = controller.getPokemonAtPosition(grid.x, grid.y);
          if (hoveredPokemon) {
            uiScene.infoPanel.update(hoveredPokemon, hoveredPokemon.playerId);
          }
        }
      } else if (this.lastHoverGrid) {
        this.lastHoverGrid = null;
        isometricGrid.hideCursor();
      }
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      controller.handleEscapeKey();
    });
  }
}
