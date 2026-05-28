import {
  type DamageEstimate,
  Direction,
  type PokemonInstance,
  SemiInvulnerableState,
} from "@pokemon-tactic/core";
import {
  ATTACK_DEPTH_ENVELOPE_RADIUS,
  CHARGING_INDICATOR_ID,
  CHARGING_INDICATOR_SYMBOL,
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
  LEFT_INDICATOR_FIRST_GAP,
  LEFT_INDICATOR_ICON_FONT_SIZE,
  LEFT_INDICATOR_ICON_Y_OFFSET,
  LEFT_INDICATOR_SLOT_OFFSET,
  LEFT_INDICATOR_TEXT_RESOLUTION,
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
  SUBSTITUTE_SPRITE_ID,
  TILE_ELEVATION_STEP,
  TILE_HEIGHT,
  TILE_WIDTH,
  TYPE_COLORS,
} from "../constants";
import type { IsometricGrid } from "../grid/IsometricGrid";
import { t } from "../i18n";
import { getAnimationKey, getSpriteOffsets, type SpriteOffsets } from "./SpriteLoader";

export interface LeftIndicatorSpec {
  id: string;
  symbol: string;
  counter?: number;
  alpha?: number;
  postedRound?: number;
}

interface IndicatorEntry {
  spec: LeftIndicatorSpec;
  seq: number;
  container: Phaser.GameObjects.Container | null;
}

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
  private readonly indicatorStack = new Map<string, IndicatorEntry>();
  private nextIndicatorSeq = 0;
  private readonly damageEstimateGraphics: Phaser.GameObjects.Graphics;
  private damageEstimateText: Phaser.GameObjects.Text | null = null;
  private maxHp = 0;
  private readonly spriteOffsets: SpriteOffsets;
  private readonly uiOffsetY: number;
  private shadowGraphics: Phaser.GameObjects.Graphics | null = null;
  private confusionTween: Phaser.Tweens.Tween | null = null;
  private _gridPosition: { x: number; y: number } = { x: 0, y: 0 };
  private readonly teamColor: number;
  private isKnockedOut = false;
  private restingAnim = "Idle";
  private semiInvulnerableActive: SemiInvulnerableState | null = null;
  private semiInvulnerableYOffset = 0;
  private substituteOverlay = false;

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
      const animKey = getAnimationKey(this.getEffectiveSpriteId(), "Idle", this.currentDirection);
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

    this.damageEstimateGraphics = scene.add.graphics();
    children.push(this.damageEstimateGraphics);

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
    this.container.setPosition(
      screen.x,
      screen.y + POKEMON_SPRITE_GROUND_OFFSET_Y + this.semiInvulnerableYOffset,
    );
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

  private getLeftIndicatorSlotX(slotIndex: number): number {
    return -HP_BAR_WIDTH / 2 - LEFT_INDICATOR_FIRST_GAP - slotIndex * LEFT_INDICATOR_SLOT_OFFSET;
  }

  private getLeftIndicatorSlotY(): number {
    const offsetY = this.usesAtlas ? this.uiOffsetY : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 2;
    return offsetY + HP_BAR_HEIGHT / 2;
  }

  setChargingIndicator(active: boolean): void {
    if (active) {
      if (this.indicatorStack.has(CHARGING_INDICATOR_ID)) {
        return;
      }
      this.indicatorStack.set(CHARGING_INDICATOR_ID, {
        spec: { id: CHARGING_INDICATOR_ID, symbol: CHARGING_INDICATOR_SYMBOL, alpha: 1.0 },
        seq: this.nextIndicatorSeq++,
        container: null,
      });
    } else {
      const entry = this.indicatorStack.get(CHARGING_INDICATOR_ID);
      if (!entry) {
        return;
      }
      if (entry.container) {
        entry.container.destroy();
        entry.container = null;
      }
      this.indicatorStack.delete(CHARGING_INDICATOR_ID);
    }
    this.relayoutIndicators();
  }

  setLeftIndicators(specs: LeftIndicatorSpec[]): void {
    const incomingIds = new Set(specs.map((spec) => spec.id));
    for (const id of [...this.indicatorStack.keys()]) {
      if (id === CHARGING_INDICATOR_ID) {
        continue;
      }
      if (!incomingIds.has(id)) {
        const entry = this.indicatorStack.get(id);
        if (entry?.container) {
          entry.container.destroy();
          entry.container = null;
        }
        this.indicatorStack.delete(id);
      }
    }
    for (const spec of specs) {
      const existing = this.indicatorStack.get(spec.id);
      if (existing) {
        existing.spec = spec;
      } else {
        this.indicatorStack.set(spec.id, {
          spec,
          seq: this.nextIndicatorSeq++,
          container: null,
        });
      }
    }
    this.relayoutIndicators();
  }

  private relayoutIndicators(): void {
    for (const entry of this.indicatorStack.values()) {
      if (entry.container) {
        entry.container.destroy();
        entry.container = null;
      }
    }
    const sorted = [...this.indicatorStack.values()].sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      if (!entry) {
        continue;
      }
      entry.container = this.buildIndicatorContainer(entry.spec, i);
      this.container.add(entry.container);
    }
  }

  private buildIndicatorContainer(
    spec: LeftIndicatorSpec,
    slotIndex: number,
  ): Phaser.GameObjects.Container {
    const slot = this.scene.add.container(
      this.getLeftIndicatorSlotX(slotIndex),
      this.getLeftIndicatorSlotY() + LEFT_INDICATOR_ICON_Y_OFFSET,
    );
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: `${LEFT_INDICATOR_ICON_FONT_SIZE}px`,
      fontFamily: FONT_FAMILY,
      resolution: LEFT_INDICATOR_TEXT_RESOLUTION,
    };
    const icon = this.scene.add.text(0, 0, spec.symbol, textStyle);
    icon.setOrigin(0.5, 0.5);
    slot.add(icon);
    if (spec.alpha !== undefined) {
      slot.setAlpha(spec.alpha);
    }
    return slot;
  }

  clearAllIndicators(): void {
    for (const entry of this.indicatorStack.values()) {
      if (entry.container) {
        entry.container.destroy();
      }
    }
    this.indicatorStack.clear();
  }

  setStatusAnimation(isAsleep: boolean): void {
    if (this.isKnockedOut) {
      return;
    }
    if (isAsleep) {
      const key = getAnimationKey(this.getEffectiveSpriteId(), "Sleep", this.currentDirection);
      if (this.scene.anims.exists(key)) {
        this.playAnimation("Sleep");
      }
    } else if (this.currentAnimation === "Sleep") {
      this.playAnimation(this.restingAnim);
    }
  }

  setConfusionWobble(active: boolean): void {
    if (active && this.isKnockedOut) {
      return;
    }
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
    if (this.isKnockedOut) {
      return;
    }
    const pmdDirection = CORE_TO_PMD_DIRECTION[direction] ?? "South";
    if (pmdDirection === this.currentDirection) {
      return;
    }
    this.currentDirection = pmdDirection;
    this.playAnimation(this.currentAnimation);
  }

  playAnimation(animation: string): void {
    if (this.isKnockedOut) {
      return;
    }
    if (!this.sprite || !this.usesAtlas) {
      return;
    }
    this.currentAnimation = animation;
    const key = getAnimationKey(this.getEffectiveSpriteId(), animation, this.currentDirection);
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

  setSemiInvulnerable(state: SemiInvulnerableState | null): void {
    const target = this.sprite ?? this.circle;
    if (!target) {
      return;
    }
    this.semiInvulnerableActive = state;
    if (state === null) {
      target.setAlpha(1);
      target.setVisible(true);
      this.semiInvulnerableYOffset = 0;
      if (this.shadowGraphics) {
        this.shadowGraphics.y = 0;
      }
      this.applyContainerPosition();
      return;
    }
    if (state === SemiInvulnerableState.Flying) {
      target.setAlpha(1);
      target.setVisible(true);
      this.semiInvulnerableYOffset = -TILE_ELEVATION_STEP * 2;
      if (this.shadowGraphics) {
        this.shadowGraphics.y = TILE_ELEVATION_STEP * 2;
      }
      this.applyContainerPosition();
      return;
    }
    target.setVisible(false);
    target.setAlpha(0);
    this.semiInvulnerableYOffset = 0;
    if (this.shadowGraphics) {
      this.shadowGraphics.y = 0;
    }
  }

  isSemiInvulnerable(): boolean {
    return this.semiInvulnerableActive !== null;
  }

  private applyContainerPosition(): void {
    const tileHeight = this.isometricGrid.getTileHeight(this._gridPosition.x, this._gridPosition.y);
    const screen = this.isometricGrid.gridToScreen(
      this._gridPosition.x,
      this._gridPosition.y,
      tileHeight,
    );
    this.container.setPosition(
      screen.x,
      screen.y + POKEMON_SPRITE_GROUND_OFFSET_Y + this.semiInvulnerableYOffset,
    );
  }

  playFirstAvailableAnimation(candidates: readonly string[]): string | null {
    if (!this.sprite || !this.usesAtlas) {
      return null;
    }
    for (const candidate of candidates) {
      const key = getAnimationKey(this.getEffectiveSpriteId(), candidate, this.currentDirection);
      if (this.scene.anims.exists(key)) {
        this.playAnimation(candidate);
        return candidate;
      }
    }
    return null;
  }

  setSubstituteOverlay(active: boolean): void {
    if (this.substituteOverlay === active) {
      return;
    }
    this.substituteOverlay = active;
    if (!this.sprite || !this.usesAtlas) {
      return;
    }
    this.playAnimation(this.currentAnimation);
  }

  isSubstituteOverlayActive(): boolean {
    return this.substituteOverlay;
  }

  private getEffectiveSpriteId(): string {
    return this.substituteOverlay ? SUBSTITUTE_SPRITE_ID : this.definitionId;
  }

  setRestingAnimation(candidates: readonly string[]): void {
    const played = this.playFirstAvailableAnimation(candidates);
    this.restingAnim = played ?? "Idle";
    if (!played) {
      this.playAnimation("Idle");
    }
  }

  playRestingAnimation(): void {
    this.playAnimation(this.restingAnim);
  }

  async playAttackAnimation(animation: string, fallback?: string): Promise<void> {
    if (this.isKnockedOut) {
      return;
    }
    const originalDepth = this.container.depth;
    const envelopeDepth = this.maxTileDepthInRadius(
      this._gridPosition.x,
      this._gridPosition.y,
      ATTACK_DEPTH_ENVELOPE_RADIUS,
    );
    this.container.setDepth(Math.max(originalDepth, envelopeDepth));
    try {
      await this.playAnimationOnce(animation, fallback);
    } finally {
      this.container.setDepth(originalDepth);
    }
  }

  private tileDepthAt(gridX: number, gridY: number): number {
    const height = this.isometricGrid.getTileHeight(gridX, gridY);
    return DEPTH_POKEMON_BASE + (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height + 0.5;
  }

  private maxTileDepthInRadius(centerX: number, centerY: number, radius: number): number {
    let max = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const depth = this.tileDepthAt(centerX + dx, centerY + dy);
        if (depth > max) {
          max = depth;
        }
      }
    }
    return max;
  }

  playAnimationOnce(animation: string, fallback?: string): Promise<void> {
    if (this.isKnockedOut) {
      return Promise.resolve();
    }
    if (!this.sprite || !this.usesAtlas) {
      return Promise.resolve();
    }
    let key = getAnimationKey(this.getEffectiveSpriteId(), animation, this.currentDirection);
    if (!this.scene.anims.exists(key)) {
      if (fallback) {
        key = getAnimationKey(this.getEffectiveSpriteId(), fallback, this.currentDirection);
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
        this.playAnimation(this.restingAnim);
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
    this.setConfusionWobble(false);
    this.isKnockedOut = true;
    this.setActive(false);
    if (this.statusIcon) {
      this.statusIcon.destroy();
      this.statusIcon = null;
      this.currentStatusKey = "";
    }
    this.clearAllIndicators();
    const sprite = this.sprite;
    const key = sprite
      ? getAnimationKey(this.getEffectiveSpriteId(), "Faint", this.currentDirection)
      : null;
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

    // No Faint animation available — interrupt any in-flight anim (e.g. Hurt
    // from flashDamage just before KO) and freeze on the first Idle frame to
    // avoid leaving the sprite stuck on a Hurt pose. The isKnockedOut guard
    // blocks the Hurt callback's fallback to Idle, so we reset manually here.
    if (sprite) {
      sprite.stop();
      const idleKey = getAnimationKey(this.getEffectiveSpriteId(), "Idle", this.currentDirection);
      if (this.scene.anims.exists(idleKey)) {
        sprite.play(idleKey);
        sprite.stop();
      }
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
    if (this.isKnockedOut) {
      return Promise.resolve();
    }
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
    this.damageEstimateGraphics.clear();

    if (!estimate || (estimate.min === 0 && estimate.max === 0)) {
      return;
    }

    const offsetY = this.usesAtlas ? this.uiOffsetY : -POKEMON_SPRITE_RADIUS - HP_BAR_HEIGHT - 2;
    const barX = -HP_BAR_WIDTH / 2;

    const hpAfterMax = Math.max(0, (this.currentHpRatio * this.maxHp - estimate.max) / this.maxHp);
    const hpAfterMin = Math.max(0, (this.currentHpRatio * this.maxHp - estimate.min) / this.maxHp);

    // Aligned with drawHpBar() which fills edge-to-edge (no 1px inset). The
    // previous implementation inset by 1px on all sides, which reduced the
    // overlay height to 0 on a 2px-tall HP bar and made it invisible.
    const barAfterMaxDamage = HP_BAR_WIDTH * hpAfterMax;
    const barAfterMinDamage = HP_BAR_WIDTH * hpAfterMin;
    const barCurrentHp = HP_BAR_WIDTH * this.currentHpRatio;

    const possibleWidth = barAfterMinDamage - barAfterMaxDamage;
    const guaranteedWidth = barCurrentHp - barAfterMinDamage;

    if (possibleWidth > 0) {
      this.damageEstimateGraphics.fillStyle(DAMAGE_ESTIMATE_COLOR, DAMAGE_ESTIMATE_ALPHA_POSSIBLE);
      this.damageEstimateGraphics.fillRect(
        barX + barAfterMaxDamage,
        offsetY,
        possibleWidth,
        HP_BAR_HEIGHT,
      );
    }

    if (guaranteedWidth > 0) {
      this.damageEstimateGraphics.fillStyle(
        DAMAGE_ESTIMATE_COLOR,
        DAMAGE_ESTIMATE_ALPHA_GUARANTEED,
      );
      this.damageEstimateGraphics.fillRect(
        barX + barAfterMinDamage,
        offsetY,
        guaranteedWidth,
        HP_BAR_HEIGHT,
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

    const damageRange =
      estimate.min === estimate.max ? `${estimate.min}` : `${estimate.min}-${estimate.max}`;
    const facingSuffix =
      estimate.facingModifier > 1.0
        ? ` (+${Math.round((estimate.facingModifier - 1) * 100)}%)`
        : estimate.facingModifier < 1.0
          ? ` (-${Math.round((1 - estimate.facingModifier) * 100)}%)`
          : "";
    const text = `${damageRange}${facingSuffix}`;
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
