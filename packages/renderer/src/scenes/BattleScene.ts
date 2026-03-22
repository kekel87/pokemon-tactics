import { GameController } from "../game/GameController";
import { IsometricGrid } from "../grid/IsometricGrid";
import { PokemonSprite } from "../sprites/PokemonSprite";
import type { BattleUIScene } from "./BattleUIScene";

export class BattleScene extends Phaser.Scene {
  private lastHoverGrid: { x: number; y: number } | null = null;

  constructor() {
    super("BattleScene");
  }

  create(): void {
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

    const controller = new GameController(
      this,
      isometricGrid,
      sprites,
      uiScene.battleUI,
      uiScene.actionMenu,
      uiScene.infoPanel,
      uiScene.turnTimeline,
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
