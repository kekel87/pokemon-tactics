import { type BattleSetupResult, createBattle } from "../game/BattleSetup";
import { GameController } from "../game/GameController";
import { IsometricGrid } from "../grid/IsometricGrid";
import { PokemonSprite } from "../sprites/PokemonSprite";
import { createPokemonAnimations, preloadPokemonAssets } from "../sprites/SpriteLoader";
import { DirectionPicker } from "../ui/DirectionPicker";
import type { BattleUIScene } from "./BattleUIScene";

export class BattleScene extends Phaser.Scene {
  private lastHoverGrid: { x: number; y: number } | null = null;
  private battleSetup!: BattleSetupResult;

  constructor() {
    super("BattleScene");
  }

  preload(): void {
    this.battleSetup = createBattle();
    const pokemonInstances = [...this.battleSetup.state.pokemon.values()];
    preloadPokemonAssets(this, pokemonInstances);
    this.load.spritesheet("arrows", "assets/ui/arrows.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create(): void {
    const uniqueIds = new Set(
      [...this.battleSetup.state.pokemon.values()].map((p) => p.definitionId),
    );
    for (const definitionId of uniqueIds) {
      createPokemonAnimations(this, definitionId);
    }

    this.events.once("uiReady", () => {
      const uiScene = this.scene.get("BattleUIScene") as BattleUIScene;
      this.setupBattle(uiScene);
    });

    this.scene.launch("BattleUIScene");
  }

  private setupBattle(uiScene: BattleUIScene): void {
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
      this.battleSetup,
    );

    for (const pokemon of controller.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        continue;
      }

      const definition = controller.pokemonDefinitions.get(pokemon.definitionId);
      const types = definition?.types ?? ["normal"];

      const sprite = new PokemonSprite(this, isometricGrid, pokemon, types);
      sprites.set(pokemon.id, sprite);
    }

    controller.refreshUI();

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
          } else {
            const active = controller.getActivePokemon();
            const activePlayerId = controller.getActivePlayerId();
            if (active && activePlayerId) {
              uiScene.infoPanel.update(active, activePlayerId);
            }
          }
        }
      } else {
        if (this.lastHoverGrid) {
          this.lastHoverGrid = null;
          isometricGrid.hideCursor();
        }
        const active = controller.getActivePokemon();
        const activePlayerId = controller.getActivePlayerId();
        if (active && activePlayerId) {
          uiScene.infoPanel.update(active, activePlayerId);
        }
      }
    });
  }
}
