import { IsometricGrid } from "../grid/IsometricGrid";
import { PokemonSprite } from "../sprites/PokemonSprite";
import { GameController } from "../game/GameController";
import { BattleUI } from "../ui/BattleUI";

export class BattleScene extends Phaser.Scene {
  private isometricGrid: IsometricGrid | undefined;
  private controller: GameController | undefined;
  private lastHoverGrid: { x: number; y: number } | null = null;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    const isometricGrid = new IsometricGrid(this);
    isometricGrid.drawGrid();
    this.isometricGrid = isometricGrid;

    const battleUI = new BattleUI(
      this,
      (moveId: string) => this.controller?.handleMoveSelect(moveId),
      () => this.controller?.handleEndTurn(),
    );

    const sprites = new Map<string, PokemonSprite>();

    const controller = new GameController(this, isometricGrid, sprites, battleUI);
    this.controller = controller;

    for (const pokemon of controller.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) continue;

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
      if (controller.isAnimating) return;

      const grid = isometricGrid.screenToGrid(pointer.worldX, pointer.worldY);

      if (grid) {
        if (!this.lastHoverGrid || this.lastHoverGrid.x !== grid.x || this.lastHoverGrid.y !== grid.y) {
          this.lastHoverGrid = grid;
          isometricGrid.highlightHover(grid.x, grid.y);
        }
      } else {
        if (this.lastHoverGrid) {
          this.lastHoverGrid = null;
        }
      }
    });
  }
}
