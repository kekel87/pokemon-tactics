import { Direction, type DamageEstimate, type PokemonInstance } from "@pokemon-tactic/core";
import {
  DAMAGE_ESTIMATE_COLOR_GUARANTEED,
  DAMAGE_ESTIMATE_COLOR_POSSIBLE,
  DAMAGE_ESTIMATE_IMMUNE_COLOR,
  DAMAGE_ESTIMATE_TEXT_COLOR,
  DAMAGE_ESTIMATE_TEXT_OFFSET_Y,
  DAMAGE_ESTIMATE_TEXT_SIZE,
  DAMAGE_ESTIMATE_TEXT_STROKE_COLOR,
  DAMAGE_ESTIMATE_TEXT_STROKE_WIDTH,
  DAMAGE_FLASH_ALPHA,
  DAMAGE_FLASH_DURATION_MS,
  DAMAGE_FLASH_REPEAT,
  KO_TINT_COLOR,
  HP_BAR_BG_ALPHA,
  HP_BAR_BG_COLOR,
  HP_BAR_BORDER_COLOR,
  HP_BAR_HEIGHT,
  HP_BAR_WIDTH,
  HP_COLOR_HIGH,
  HP_COLOR_LOW,
  HP_COLOR_MEDIUM,
  HP_THRESHOLD_HIGH,
  HP_THRESHOLD_LOW,
  MOVE_TWEEN_DURATION_MS,
  POKEMON_SPRITE_BORDER_ALPHA,
  POKEMON_SPRITE_BORDER_WIDTH,
  POKEMON_SPRITE_RADIUS,
  DEPTH_POKEMON_BASE,
  POKEMON_SPRITE_SCALE,
  PULSE_DURATION_MS,
  PULSE_MAX_SCALE,
  PULSE_MIN_SCALE,
  STATUS_ASSET_KEY,
  STATUS_SPRITE_ICON_OFFSET_X,
  STATUS_SPRITE_ICON_SCALE,
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
  private statusIcon: Phaser.GameObjects.Image | null = null;
  private currentStatusKey: string = "";
  private damageEstimateGraphics: Phaser.GameObjects.Graphics | null = null;
  private damageEstimateText: Phaser.GameObjects.Text | null = null;
  private maxHp = 0;

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
    this.maxHp = pokemon.maxHp;
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

  getFlashTarget(): Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics | Phaser.GameObjects.Container {
    return this.sprite ?? this.circle ?? this.container;
  }

  updateHp(currentHp: number, maxHp: number): void {
    this.currentHpRatio = currentHp / maxHp;
    this.maxHp = maxHp;
    this.drawHpBar();
  }

  setHpBarVisible(visible: boolean): void {
    this.hpBarBackground.setVisible(visible);
    this.hpBarFill.setVisible(visible);
  }

  updateStatus(statusEffects: { type: string }[]): void {
    const statusType = statusEffects[0]?.type;
    const assetKey = statusType ? STATUS_ASSET_KEY[statusType] : undefined;
    const newKey = assetKey ? `status-icon-${assetKey}` : "";

    if (newKey === this.currentStatusKey) {
      return;
    }
    this.currentStatusKey = newKey;

    if (this.statusIcon) {
      this.statusIcon.destroy();
      this.statusIcon = null;
    }

    if (!newKey) {
      return;
    }

    const texture = this.scene.textures.get(newKey);
    if (texture.key === "__MISSING") {
      return;
    }

    const offsetY = this.usesAtlas ? -32 : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 4;
    this.statusIcon = this.scene.add.image(HP_BAR_WIDTH / 2 + STATUS_SPRITE_ICON_OFFSET_X, offsetY + HP_BAR_HEIGHT / 2, newKey);
    this.statusIcon.setScale(STATUS_SPRITE_ICON_SCALE);
    this.container.add(this.statusIcon);
  }

  setStatusAnimation(isAsleep: boolean): void {
    if (isAsleep) {
      const key = getAnimationKey(this.definitionId, "Sleep", this.currentDirection);
      if (this.scene.anims.exists(key)) {
        this.playAnimation("Sleep");
      }
    } else if (this.currentAnimation === "Sleep") {
      this.playAnimation("Idle");
    }
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
      this.playAnimationOnce("Hurt").catch(() => undefined);
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

  showDamageEstimate(estimate: DamageEstimate | null): void {
    if (this.damageEstimateGraphics) {
      this.damageEstimateGraphics.destroy();
      this.damageEstimateGraphics = null;
    }

    if (!estimate || (estimate.min === 0 && estimate.max === 0)) {
      return;
    }

    const offsetY = this.usesAtlas ? -32 : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 4;
    const barX = -HP_BAR_WIDTH / 2;
    const innerWidth = HP_BAR_WIDTH - 2;

    const hpAfterMax = Math.max(0, (this.currentHpRatio * this.maxHp - estimate.max) / this.maxHp);
    const hpAfterMin = Math.max(0, (this.currentHpRatio * this.maxHp - estimate.min) / this.maxHp);

    this.damageEstimateGraphics = this.scene.add.graphics();
    this.damageEstimateGraphics.setPosition(this.container.x, this.container.y);
    this.damageEstimateGraphics.setDepth(this.container.depth + 1);

    const barAfterMaxDamage = innerWidth * hpAfterMax;
    const barAfterMinDamage = innerWidth * hpAfterMin;
    const barCurrentHp = innerWidth * this.currentHpRatio;

    if (barAfterMinDamage - barAfterMaxDamage > 0) {
      this.damageEstimateGraphics.fillStyle(DAMAGE_ESTIMATE_COLOR_POSSIBLE, 0.7);
      this.damageEstimateGraphics.fillRect(
        barX + 1 + barAfterMaxDamage,
        offsetY + 1,
        barAfterMinDamage - barAfterMaxDamage,
        HP_BAR_HEIGHT - 2,
      );
    }

    if (barCurrentHp - barAfterMinDamage > 0) {
      this.damageEstimateGraphics.fillStyle(DAMAGE_ESTIMATE_COLOR_GUARANTEED, 0.9);
      this.damageEstimateGraphics.fillRect(
        barX + 1 + barAfterMinDamage,
        offsetY + 1,
        barCurrentHp - barAfterMinDamage,
        HP_BAR_HEIGHT - 2,
      );
    }
  }

  showDamageText(estimate: DamageEstimate | null): void {
    if (this.damageEstimateText) {
      this.damageEstimateText.destroy();
      this.damageEstimateText = null;
    }

    if (!estimate) {
      return;
    }

    if (estimate.effectiveness === 0) {
      this.damageEstimateText = this.scene.add.text(
        this.container.x,
        this.container.y + DAMAGE_ESTIMATE_TEXT_OFFSET_Y,
        "Immune",
        {
          fontSize: `${DAMAGE_ESTIMATE_TEXT_SIZE}px`,
          color: DAMAGE_ESTIMATE_IMMUNE_COLOR,
          stroke: DAMAGE_ESTIMATE_TEXT_STROKE_COLOR,
          strokeThickness: DAMAGE_ESTIMATE_TEXT_STROKE_WIDTH,
          fontStyle: "bold",
        },
      );
      this.damageEstimateText.setOrigin(0.5, 0.5);
      this.damageEstimateText.setDepth(this.container.depth + 1);
      return;
    }

    if (estimate.min === 0 && estimate.max === 0) {
      return;
    }

    const text = estimate.min === estimate.max ? `${estimate.min}` : `${estimate.min}-${estimate.max}`;
    this.damageEstimateText = this.scene.add.text(
      this.container.x,
      this.container.y + DAMAGE_ESTIMATE_TEXT_OFFSET_Y,
      text,
      {
        fontSize: `${DAMAGE_ESTIMATE_TEXT_SIZE}px`,
        color: DAMAGE_ESTIMATE_TEXT_COLOR,
        stroke: DAMAGE_ESTIMATE_TEXT_STROKE_COLOR,
        strokeThickness: DAMAGE_ESTIMATE_TEXT_STROKE_WIDTH,
        fontStyle: "bold",
      },
    );
    this.damageEstimateText.setOrigin(0.5, 0.5);
    this.damageEstimateText.setDepth(this.container.depth + 1);
  }

  clearDamagePreview(): void {
    this.showDamageEstimate(null);
    this.showDamageText(null);
  }

  destroy(): void {
    this.stopPulse();
    this.clearDamagePreview();
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

  private getHpColor(ratio: number): number {
    if (ratio > HP_THRESHOLD_HIGH) {
      return HP_COLOR_HIGH;
    }
    if (ratio > HP_THRESHOLD_LOW) {
      return HP_COLOR_MEDIUM;
    }
    return HP_COLOR_LOW;
  }

  private drawHpBar(): void {
    const offsetY = this.usesAtlas ? -32 : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 4;
    const barX = -HP_BAR_WIDTH / 2;
    const radius = 2;

    this.hpBarBackground.clear();
    this.hpBarBackground.fillStyle(HP_BAR_BG_COLOR, HP_BAR_BG_ALPHA);
    this.hpBarBackground.fillRoundedRect(barX, offsetY, HP_BAR_WIDTH, HP_BAR_HEIGHT, radius);
    this.hpBarBackground.lineStyle(1, HP_BAR_BORDER_COLOR, 1);
    this.hpBarBackground.strokeRoundedRect(barX, offsetY, HP_BAR_WIDTH, HP_BAR_HEIGHT, radius);

    this.hpBarFill.clear();
    const hpColor = this.getHpColor(this.currentHpRatio);
    const fillWidth = (HP_BAR_WIDTH - 2) * this.currentHpRatio;
    if (fillWidth > 0) {
      this.hpBarFill.fillStyle(hpColor, 1);
      this.hpBarFill.fillRoundedRect(barX + 1, offsetY + 1, fillWidth, HP_BAR_HEIGHT - 2, radius);
    }
  }
}
