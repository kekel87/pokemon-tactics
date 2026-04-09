import { type DamageEstimate, Direction, type PokemonInstance } from "@pokemon-tactic/core";
import {
  CONFUSION_WOBBLE_ANGLE,
  CONFUSION_WOBBLE_DURATION_MS,
  DAMAGE_ESTIMATE_ALPHA_GUARANTEED,
  DAMAGE_ESTIMATE_ALPHA_POSSIBLE,
  DAMAGE_ESTIMATE_COLOR,
  DAMAGE_ESTIMATE_IMMUNE_COLOR,
  DAMAGE_ESTIMATE_TEXT_COLOR,
  DAMAGE_ESTIMATE_TEXT_SIZE,
  DAMAGE_ESTIMATE_TEXT_STROKE_COLOR,
  DAMAGE_ESTIMATE_TEXT_STROKE_WIDTH,
  DAMAGE_FLASH_ALPHA,
  DAMAGE_FLASH_DURATION_MS,
  DAMAGE_FLASH_REPEAT,
  DEPTH_POKEMON_BASE,
  DEPTH_TILE_MAX_ELEVATION,
  FONT_FAMILY,
  getTeamColorByPlayerId,
  HP_BAR_BG_ALPHA,
  HP_BAR_BG_COLOR,
  HP_BAR_BORDER_COLOR,
  HP_BAR_HEIGHT,
  HP_BAR_WIDTH,
  KO_TINT_COLOR,
  MOVE_TWEEN_DURATION_MS,
  POKEMON_SPRITE_BORDER_ALPHA,
  POKEMON_SPRITE_BORDER_WIDTH,
  POKEMON_SPRITE_GROUND_OFFSET_Y,
  POKEMON_SPRITE_RADIUS,
  POKEMON_SPRITE_SCALE,
  PULSE_DURATION_MS,
  PULSE_MAX_SCALE,
  PULSE_MIN_SCALE,
  STATUS_ASSET_KEY,
  STATUS_SPRITE_ICON_OFFSET_X,
  STATUS_SPRITE_ICON_SCALE,
  TILE_HEIGHT,
  TILE_WIDTH,
  TYPE_COLORS,
} from "../constants";
import type { IsometricGrid } from "../grid/IsometricGrid";
import { t } from "../i18n";
import { getAnimationKey, getSpriteOffsets, type SpriteOffsets } from "./SpriteLoader";

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
  private readonly spriteOffsets: SpriteOffsets;
  private readonly uiOffsetY: number;
  private shadowGraphics: Phaser.GameObjects.Graphics | null = null;
  private confusionTween: Phaser.Tweens.Tween | null = null;
  private _gridPosition: { x: number; y: number } = { x: 0, y: 0 };
  private readonly teamColor: number;

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
    this.teamColor = getTeamColorByPlayerId(pokemon.playerId);
    this.currentDirection = CORE_TO_PMD_DIRECTION[pokemon.orientation] ?? "South";
    this.currentAnimation = "Idle";
    this.spriteOffsets = getSpriteOffsets(scene, this.definitionId);
    this.uiOffsetY = this.spriteOffsets.headOffsetY * POKEMON_SPRITE_SCALE - 16;

    const children: Phaser.GameObjects.GameObject[] = [];

    this.shadowGraphics = scene.add.graphics();
    this.drawShadow();
    children.push(this.shadowGraphics);

    const texture = scene.textures.get(this.definitionId);
    this.usesAtlas = texture.key !== "__MISSING";

    if (this.usesAtlas) {
      texture.setFilter(Phaser.Textures.NEAREST);
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

    if (pokemon.statusEffects.length > 0) {
      this.updateStatus(pokemon.statusEffects);
      const isAsleep = pokemon.statusEffects[0]?.type === "asleep";
      this.setStatusAnimation(isAsleep);
    }
  }

  get gridPosition(): { x: number; y: number } {
    return this._gridPosition;
  }

  updatePosition(gridX: number, gridY: number, height?: number): void {
    this._gridPosition = { x: gridX, y: gridY };
    const tileHeight = height ?? this.isometricGrid.getTileHeight(gridX, gridY);
    const screen = this.isometricGrid.gridToScreen(gridX, gridY, tileHeight);
    this.container.setPosition(screen.x, screen.y + POKEMON_SPRITE_GROUND_OFFSET_Y);
    this.container.setDepth(
      DEPTH_POKEMON_BASE + (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + tileHeight + 0.5,
    );
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getTextPosition(): { x: number; y: number } {
    return {
      x: this.container.x,
      y: this.container.y + this.uiOffsetY - 5,
    };
  }

  getFlashTarget():
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Graphics
    | Phaser.GameObjects.Container {
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

    const offsetY = this.usesAtlas ? this.uiOffsetY : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 2;
    this.statusIcon = this.scene.add.image(
      HP_BAR_WIDTH / 2 + STATUS_SPRITE_ICON_OFFSET_X,
      offsetY + HP_BAR_HEIGHT / 2,
      newKey,
    );
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

  setConfusionWobble(active: boolean): void {
    if (!active) {
      if (this.confusionTween) {
        this.confusionTween.destroy();
        this.confusionTween = null;
        if (this.sprite) {
          this.sprite.setAngle(0);
        }
      }
      return;
    }

    if (this.confusionTween) {
      return;
    }

    if (!this.sprite) {
      return;
    }

    this.confusionTween = this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: -CONFUSION_WOBBLE_ANGLE, to: CONFUSION_WOBBLE_ANGLE },
      duration: CONFUSION_WOBBLE_DURATION_MS * 2,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
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
    if (!this.scene.anims.exists(key)) {
      return;
    }
    // Never interrupt a looping animation of the same key — that would
    // reset Walk to frame 0 on every tile step. One-shot animations (Hop,
    // Attack, Hurt, …) must always restart so each step on a staircase
    // gets its own full playthrough instead of inheriting the tail end of
    // the previous one.
    const currentAnim = this.sprite.anims.currentAnim;
    const isSameLoopingAnim =
      currentAnim?.key === key && this.sprite.anims.isPlaying && currentAnim.repeat === -1;
    if (isSameLoopingAnim) {
      return;
    }
    this.sprite.play(key);
  }

  /**
   * Plays the first animation in `candidates` that is registered for this
   * sprite + current direction. Returns the animation name that was played,
   * or `null` if no candidate is available. Useful for feature-detecting
   * optional animations like "FlapAround" on flying Pokemon.
   */
  playFirstAvailableAnimation(candidates: readonly string[]): string | null {
    if (!this.sprite || !this.usesAtlas) {
      return null;
    }
    for (const candidate of candidates) {
      const key = getAnimationKey(this.definitionId, candidate, this.currentDirection);
      if (this.scene.anims.exists(key)) {
        this.playAnimation(candidate);
        return candidate;
      }
    }
    return null;
  }

  playAnimationOnce(animation: string, fallback?: string): Promise<void> {
    if (!this.sprite || !this.usesAtlas) {
      return Promise.resolve();
    }
    let key = getAnimationKey(this.definitionId, animation, this.currentDirection);
    if (!this.scene.anims.exists(key)) {
      if (fallback) {
        key = getAnimationKey(this.definitionId, fallback, this.currentDirection);
        if (!this.scene.anims.exists(key)) {
          return Promise.resolve();
        }
      } else {
        return Promise.resolve();
      }
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
    this.setConfusionWobble(false);
    if (this.statusIcon) {
      this.statusIcon.destroy();
      this.statusIcon = null;
      this.currentStatusKey = "";
    }
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

  private drawShadow(): void {
    if (!this.shadowGraphics) {
      return;
    }
    this.shadowGraphics.clear();
    const shadowWidth = TILE_WIDTH * 0.4;
    const shadowHeight = TILE_HEIGHT * 0.3;
    const shadowY = this.spriteOffsets.footOffsetY * POKEMON_SPRITE_SCALE;
    this.shadowGraphics.fillStyle(0x000000, 0.35);
    this.shadowGraphics.fillEllipse(0, shadowY, shadowWidth, shadowHeight);
  }

  private darkenSprite(): void {
    if (this.sprite) {
      this.sprite.setTint(KO_TINT_COLOR);
    }
    if (this.circle) {
      this.circle.setAlpha(0.4);
    }
    if (this.shadowGraphics) {
      this.shadowGraphics.setVisible(false);
    }
    this.hpBarBackground.setVisible(false);
    this.hpBarFill.setVisible(false);
  }

  async animateMoveTo(
    gridX: number,
    gridY: number,
    height = 0,
    duration = MOVE_TWEEN_DURATION_MS,
    options: { isJump?: boolean } = {},
  ): Promise<void> {
    const sourceGridX = this._gridPosition.x;
    const sourceGridY = this._gridPosition.y;
    const sourceHeight = this.isometricGrid.getTileHeight(sourceGridX, sourceGridY);
    const sourceDepth = this.container.depth;
    const targetDepth =
      DEPTH_POKEMON_BASE + (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height + 0.5;
    // Keep the sprite on top of both the source and the target column during
    // the whole tween so it is never hidden by tile faces it passes over.
    // Snap to the exact target depth once the movement completes.
    this.container.setDepth(Math.max(sourceDepth, targetDepth));

    const heightDelta = height - sourceHeight;
    const isJump = options.isJump === true && Math.abs(heightDelta) > 0.001;

    if (!isJump) {
      // Flat movement or ramp traversal → single linear tween.
      const finalScreen = this.isometricGrid.gridToScreen(gridX, gridY, height);
      await this.tweenContainer(
        { x: finalScreen.x, y: finalScreen.y + POKEMON_SPRITE_GROUND_OFFSET_Y },
        duration,
      );
      this._gridPosition = { x: gridX, y: gridY };
      this.container.setDepth(targetDepth);
      return;
    }

    // Jump: one Hop animation per tile step. Single diagonal tween with
    // per-axis easing so the sprite is always moving forward in X while the
    // Y axis "lands" asymmetrically — fast rise on ascent, late drop on
    // descent. The Hop sprite animation provides the visual lift on top of
    // this; adding an extra vertical hop on the container would stack two
    // rises and make the jump look twice as high.
    const isAscent = heightDelta > 0;
    const endScreen = this.isometricGrid.gridToScreen(gridX, gridY, height);
    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        duration,
        props: {
          x: { value: endScreen.x, ease: "Linear" },
          y: {
            value: endScreen.y + POKEMON_SPRITE_GROUND_OFFSET_Y,
            ease: isAscent ? "Quad.easeOut" : "Quad.easeIn",
          },
        },
        onComplete: () => resolve(),
      });
    });

    this._gridPosition = { x: gridX, y: gridY };
    this.container.setDepth(targetDepth);
  }

  private tweenContainer(
    to: { x: number; y: number },
    duration: number,
    ease?: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        x: to.x,
        y: to.y,
        duration,
        ease,
        onComplete: () => resolve(),
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

    const offsetY = this.usesAtlas ? this.uiOffsetY : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 2;
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
      this.damageEstimateGraphics.fillStyle(DAMAGE_ESTIMATE_COLOR, DAMAGE_ESTIMATE_ALPHA_POSSIBLE);
      this.damageEstimateGraphics.fillRect(
        barX + 1 + barAfterMaxDamage,
        offsetY + 1,
        barAfterMinDamage - barAfterMaxDamage,
        HP_BAR_HEIGHT - 2,
      );
    }

    if (barCurrentHp - barAfterMinDamage > 0) {
      this.damageEstimateGraphics.fillStyle(
        DAMAGE_ESTIMATE_COLOR,
        DAMAGE_ESTIMATE_ALPHA_GUARANTEED,
      );
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
        this.container.y + this.uiOffsetY - 5,
        t("battle.immune"),
        {
          fontFamily: FONT_FAMILY,
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

    const text =
      estimate.min === estimate.max ? `${estimate.min}` : `${estimate.min}-${estimate.max}`;
    this.damageEstimateText = this.scene.add.text(
      this.container.x,
      this.container.y + this.uiOffsetY - 5,
      text,
      {
        fontFamily: FONT_FAMILY,
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

  private drawHpBar(): void {
    const offsetY = this.usesAtlas ? this.uiOffsetY : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 2;
    const barX = -HP_BAR_WIDTH / 2;
    const radius = 1;

    this.hpBarBackground.clear();
    this.hpBarBackground.fillStyle(HP_BAR_BG_COLOR, HP_BAR_BG_ALPHA);
    this.hpBarBackground.fillRoundedRect(barX, offsetY, HP_BAR_WIDTH, HP_BAR_HEIGHT, radius);
    this.hpBarBackground.lineStyle(1, HP_BAR_BORDER_COLOR, 1);
    this.hpBarBackground.strokeRoundedRect(barX, offsetY, HP_BAR_WIDTH, HP_BAR_HEIGHT, radius);

    this.hpBarFill.clear();
    const fillWidth = HP_BAR_WIDTH * this.currentHpRatio;
    if (fillWidth > 0) {
      this.hpBarFill.fillStyle(this.teamColor, 1);
      this.hpBarFill.fillRoundedRect(barX, offsetY, fillWidth, HP_BAR_HEIGHT, radius);
    }
  }
}
