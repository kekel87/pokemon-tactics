import { Direction, type PokemonInstance } from "@pokemon-tactic/core";
import {
  DAMAGE_FLASH_ALPHA,
  DAMAGE_FLASH_DURATION_MS,
  DAMAGE_FLASH_REPEAT,
  KO_TINT_COLOR,
  HP_BAR_BG_ALPHA,
  HP_BAR_BG_COLOR,
  HP_BAR_HEIGHT,
  HP_BAR_WIDTH,
  HP_COLOR_HIGH,
  HP_COLOR_LOW,
  HP_THRESHOLD,
  MOVE_TWEEN_DURATION_MS,
  POKEMON_SPRITE_BORDER_ALPHA,
  POKEMON_SPRITE_BORDER_WIDTH,
  POKEMON_SPRITE_RADIUS,
  DEPTH_POKEMON_BASE,
  POKEMON_SPRITE_SCALE,
  PULSE_DURATION_MS,
  PULSE_MAX_SCALE,
  PULSE_MIN_SCALE,
  TYPE_COLORS,
} from "../constants";
import type { IsometricGrid } from "../grid/IsometricGrid";
import { getAnimationKey } from "./SpriteLoader";

const CORE_TO_PMD_DIRECTION: Record<Direction, string> = {
  [Direction.South]: "SouthWest",
  [Direction.East]: "SouthEast",
  [Direction.North]: "NorthEast",
  [Direction.West]: "NorthWest",
};

export class PokemonSprite {
  readonly pokemonId: string;
  private readonly scene: Phaser.Scene;
  private readonly isometricGrid: IsometricGrid;
  private readonly container: Phaser.GameObjects.Container;
  private readonly hpBarBackground: Phaser.GameObjects.Graphics;
  private readonly hpBarFill: Phaser.GameObjects.Graphics;
  private readonly definitionId: string;
  private readonly usesAtlas: boolean;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private circle: Phaser.GameObjects.Graphics | null = null;
  private currentHpRatio: number;
  private currentDirection: string;
  private currentAnimation: string;
  private pulseTween: Phaser.Tweens.Tween | null = null;

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
    this.definitionId = pokemon.definitionId;
    this.currentDirection = CORE_TO_PMD_DIRECTION[pokemon.orientation] ?? "South";
    this.currentAnimation = "Idle";

    const children: Phaser.GameObjects.GameObject[] = [];

    const texture = scene.textures.get(this.definitionId);
    this.usesAtlas = texture.key !== "__MISSING";

    if (this.usesAtlas) {
      const animKey = getAnimationKey(this.definitionId, "Idle", this.currentDirection);
      this.sprite = scene.add.sprite(0, 0, this.definitionId);
      this.sprite.setScale(POKEMON_SPRITE_SCALE);
      this.sprite.play(animKey);
      children.push(this.sprite);
    } else {
      const primaryType = pokemonTypes[0] ?? "normal";
      const color = TYPE_COLORS[primaryType] ?? TYPE_COLORS.normal ?? 0xa0a0a0;
      this.circle = scene.add.graphics();
      this.drawCircle(color);
      children.push(this.circle);
    }

    this.hpBarBackground = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();
    this.drawHpBar();
    children.push(this.hpBarBackground, this.hpBarFill);

    this.container = scene.add.container(0, 0, children);
    this.updatePosition(pokemon.position.x, pokemon.position.y);
  }

  updatePosition(gridX: number, gridY: number): void {
    const screen = this.isometricGrid.gridToScreen(gridX, gridY);
    this.container.setPosition(screen.x, screen.y);
    this.container.setDepth(DEPTH_POKEMON_BASE + gridX + gridY);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  updateHp(currentHp: number, maxHp: number): void {
    this.currentHpRatio = currentHp / maxHp;
    this.drawHpBar();
  }

  setHpBarVisible(visible: boolean): void {
    this.hpBarBackground.setVisible(visible);
    this.hpBarFill.setVisible(visible);
  }

  setDirection(direction: Direction): void {
    const pmdDirection = CORE_TO_PMD_DIRECTION[direction] ?? "South";
    if (pmdDirection === this.currentDirection) {
      return;
    }
    this.currentDirection = pmdDirection;
    this.playAnimation(this.currentAnimation);
  }

  playAnimation(animation: string): void {
    if (!this.sprite || !this.usesAtlas) {
      return;
    }
    this.currentAnimation = animation;
    const key = getAnimationKey(this.definitionId, animation, this.currentDirection);
    if (this.scene.anims.exists(key)) {
      this.sprite.play(key);
    }
  }

  playAnimationOnce(animation: string): Promise<void> {
    if (!this.sprite || !this.usesAtlas) {
      return Promise.resolve();
    }
    const key = getAnimationKey(this.definitionId, animation, this.currentDirection);
    if (!this.scene.anims.exists(key)) {
      return Promise.resolve();
    }

    const sprite = this.sprite;
    return new Promise((resolve) => {
      sprite.play(key);
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.playAnimation("Idle");
        resolve();
      });
    });
  }

  setActive(active: boolean): void {
    if (active) {
      this.startPulse();
    } else {
      this.stopPulse();
    }
  }

  playFaintAndStay(): Promise<void> {
    this.setActive(false);
    const sprite = this.sprite;
    const key = sprite ? getAnimationKey(this.definitionId, "Faint", this.currentDirection) : null;
    const canPlayFaint = sprite && key && this.scene.anims.exists(key);

    if (canPlayFaint) {
      return new Promise((resolve) => {
        sprite.play(key);
        sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          sprite.stop();
          this.darkenSprite();
          resolve();
        });
      });
    }

    this.darkenSprite();
    return Promise.resolve();
  }

  private darkenSprite(): void {
    if (this.sprite) {
      this.sprite.setTint(KO_TINT_COLOR);
    }
    if (this.circle) {
      this.circle.setAlpha(0.4);
    }
    this.hpBarBackground.setVisible(false);
    this.hpBarFill.setVisible(false);
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
          this.container.setDepth(DEPTH_POKEMON_BASE + gridX + gridY);
          resolve();
        },
      });
    });
  }

  flashDamage(): Promise<void> {
    return new Promise((resolve) => {
      this.playAnimationOnce("Hurt").catch(() => {
        // Hurt animation is best-effort, flash tween handles the visual feedback
      });
      this.scene.tweens.add({
        targets: this.container,
        alpha: DAMAGE_FLASH_ALPHA,
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
    this.stopPulse();
    this.container.destroy();
  }

  private startPulse(): void {
    this.stopPulse();
    this.container.setScale(PULSE_MIN_SCALE);
    this.pulseTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: PULSE_MAX_SCALE,
      scaleY: PULSE_MAX_SCALE,
      duration: PULSE_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private stopPulse(): void {
    if (this.pulseTween) {
      this.pulseTween.destroy();
      this.pulseTween = null;
    }
    this.container.setScale(1);
  }

  private drawCircle(color: number): void {
    if (!this.circle) {
      return;
    }
    this.circle.clear();
    this.circle.fillStyle(color, 1);
    this.circle.fillCircle(0, 0, POKEMON_SPRITE_RADIUS);
    this.circle.lineStyle(POKEMON_SPRITE_BORDER_WIDTH, 0xffffff, POKEMON_SPRITE_BORDER_ALPHA);
    this.circle.strokeCircle(0, 0, POKEMON_SPRITE_RADIUS);
  }

  private drawHpBar(): void {
    const offsetY = this.usesAtlas ? -32 : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 4;
    const barX = -HP_BAR_WIDTH / 2;

    this.hpBarBackground.clear();
    this.hpBarBackground.fillStyle(HP_BAR_BG_COLOR, HP_BAR_BG_ALPHA);
    this.hpBarBackground.fillRect(barX, offsetY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    this.hpBarFill.clear();
    const hpColor = this.currentHpRatio > HP_THRESHOLD ? HP_COLOR_HIGH : HP_COLOR_LOW;
    this.hpBarFill.fillStyle(hpColor, 1);
    this.hpBarFill.fillRect(barX, offsetY, HP_BAR_WIDTH * this.currentHpRatio, HP_BAR_HEIGHT);
  }
}
