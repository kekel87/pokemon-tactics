import type { PokemonInstance } from "@pokemon-tactic/core";
import {
  DAMAGE_FLASH_DURATION_MS,
  DAMAGE_FLASH_REPEAT,
  FADEOUT_DURATION_MS,
  HP_BAR_HEIGHT,
  HP_BAR_WIDTH,
  HP_COLOR_HIGH,
  HP_COLOR_LOW,
  MOVE_TWEEN_DURATION_MS,
  POKEMON_SPRITE_RADIUS,
  TYPE_COLORS,
} from "../constants";
import type { IsometricGrid } from "../grid/IsometricGrid";

export class PokemonSprite {
  readonly pokemonId: string;
  private readonly scene: Phaser.Scene;
  private readonly isometricGrid: IsometricGrid;
  private readonly container: Phaser.GameObjects.Container;
  private readonly circle: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpBarBackground: Phaser.GameObjects.Graphics;
  private readonly hpBarFill: Phaser.GameObjects.Graphics;
  private readonly color: number;
  private currentHpRatio: number;

  constructor(
    scene: Phaser.Scene,
    isometricGrid: IsometricGrid,
    pokemon: PokemonInstance,
    pokemonTypes: string[],
  ) {
    this.pokemonId = pokemon.id;
    this.scene = scene;
    this.isometricGrid = isometricGrid;
    this.currentHpRatio = pokemon.currentHp / pokemon.maxHp;

    const primaryType = pokemonTypes[0] ?? "normal";
    this.color = TYPE_COLORS[primaryType] ?? TYPE_COLORS.normal ?? 0xa0a0a0;

    this.circle = scene.add.graphics();
    this.drawCircle();

    this.nameText = scene.add.text(0, -POKEMON_SPRITE_RADIUS - 14, pokemon.definitionId, {
      fontSize: "11px",
      color: "#ffffff",
      fontFamily: "monospace",
      align: "center",
    });
    this.nameText.setOrigin(0.5, 0.5);

    this.hpBarBackground = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();
    this.drawHpBar();

    this.container = scene.add.container(0, 0, [
      this.circle,
      this.nameText,
      this.hpBarBackground,
      this.hpBarFill,
    ]);

    this.updatePosition(pokemon.position.x, pokemon.position.y);
  }

  updatePosition(gridX: number, gridY: number): void {
    const screen = this.isometricGrid.gridToScreen(gridX, gridY);
    this.container.setPosition(screen.x, screen.y);
    this.container.setDepth(gridX + gridY);
  }

  updateHp(currentHp: number, maxHp: number): void {
    this.currentHpRatio = currentHp / maxHp;
    this.drawHpBar();
  }

  setActive(active: boolean): void {
    if (active) {
      this.container.setScale(1.15);
    } else {
      this.container.setScale(1);
    }
  }

  fadeOut(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: FADEOUT_DURATION_MS,
        onComplete: () => resolve(),
      });
    });
  }

  animateMoveTo(gridX: number, gridY: number): Promise<void> {
    const screen = this.isometricGrid.gridToScreen(gridX, gridY);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        x: screen.x,
        y: screen.y,
        duration: MOVE_TWEEN_DURATION_MS,
        onComplete: () => {
          this.container.setDepth(gridX + gridY);
          resolve();
        },
      });
    });
  }

  flashDamage(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0.3,
        duration: DAMAGE_FLASH_DURATION_MS,
        yoyo: true,
        repeat: DAMAGE_FLASH_REPEAT,
        onComplete: () => {
          this.container.setAlpha(1);
          resolve();
        },
      });
    });
  }

  destroy(): void {
    this.container.destroy();
  }

  private drawCircle(): void {
    this.circle.clear();
    this.circle.fillStyle(this.color, 1);
    this.circle.fillCircle(0, 0, POKEMON_SPRITE_RADIUS);
    this.circle.lineStyle(2, 0xffffff, 0.6);
    this.circle.strokeCircle(0, 0, POKEMON_SPRITE_RADIUS);
  }

  private drawHpBar(): void {
    const barY = POKEMON_SPRITE_RADIUS + 4;
    const barX = -HP_BAR_WIDTH / 2;

    this.hpBarBackground.clear();
    this.hpBarBackground.fillStyle(0x333333, 0.8);
    this.hpBarBackground.fillRect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    this.hpBarFill.clear();
    const hpColor = this.currentHpRatio > 0.5 ? HP_COLOR_HIGH : HP_COLOR_LOW;
    this.hpBarFill.fillStyle(hpColor, 1);
    this.hpBarFill.fillRect(barX, barY, HP_BAR_WIDTH * this.currentHpRatio, HP_BAR_HEIGHT);
  }
}
