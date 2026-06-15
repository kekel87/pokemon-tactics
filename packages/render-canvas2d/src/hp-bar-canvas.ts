/**
 * HP-bar canvas painter (plan 126 hoist). Byte-for-byte the drawing that both
 * renderers' sprite HUDs used to carry: rounded border ring, dark inset track,
 * team-colour fill by HP ratio, and the predicted-damage darkening bands. The
 * renderer owns the engine texture + its 2D context; this draws the pixels.
 */

/** HP-bar canvas resolution (kept crisp via NEAREST sampling). */
export const HP_BAR_TEXTURE_HEIGHT = 40;
/** Border thickness drawn on the bar canvas (px). */
export const HP_BAR_BORDER_PX = 6;
/** Corner radius as a fraction of the canvas height. */
const HP_BAR_RADIUS_FACTOR = 0.42;
/** Corner radius drawn on the bar canvas (px). */
export const HP_BAR_RADIUS_PX = HP_BAR_TEXTURE_HEIGHT * HP_BAR_RADIUS_FACTOR;

/** Canvas width that preserves the bar's world aspect ratio at the fixed height. */
export function hpBarTextureWidth(worldWidth: number, worldHeight: number): number {
  return Math.round(HP_BAR_TEXTURE_HEIGHT * (worldWidth / worldHeight));
}

/** A predicted-damage overlay range on the bar (confirm phase). */
export interface HpBarDamageEstimate {
  /** Minimum predicted damage (the guaranteed loss). */
  readonly min: number;
  /** Maximum predicted damage (the possible loss). */
  readonly max: number;
  /** No-effect (immunity): no band drawn. */
  readonly immune: boolean;
}

export interface HpBarDrawParams {
  readonly width: number;
  readonly height: number;
  readonly borderPx: number;
  readonly radiusPx: number;
  readonly backgroundCss: string;
  readonly borderCss: string;
  readonly teamColorCss: string;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly estimate: HpBarDamageEstimate | null;
  /** Alpha of the possible-damage band (min→max). */
  readonly alphaPossible: number;
  /** Alpha of the guaranteed-damage band (≥min). */
  readonly alphaGuaranteed: number;
}

/** Path a rounded rectangle (native `roundRect`) for fill/clip. */
export function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const clamped = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.roundRect(x, y, width, height, clamped);
}

/** Draw the full HP bar (border ring + track + team fill + damage bands) onto `context`. */
export function drawHpBar(context: CanvasRenderingContext2D, params: HpBarDrawParams): void {
  const { width, height, borderPx, radiusPx } = params;
  context.clearRect(0, 0, width, height);

  // Border ring: full rounded rect in the border colour, then the dark track inset.
  roundRectPath(context, 0, 0, width, height, radiusPx);
  context.fillStyle = params.borderCss;
  context.fill();

  const inset = borderPx;
  const innerLeft = inset;
  const innerTop = inset;
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  const innerRadius = Math.max(0, radiusPx - inset);
  roundRectPath(context, innerLeft, innerTop, innerWidth, innerHeight, innerRadius);
  context.fillStyle = params.backgroundCss;
  context.fill();

  const ratio = params.maxHp > 0 ? Math.max(0, Math.min(1, params.currentHp / params.maxHp)) : 0;
  const fillWidth = innerWidth * ratio;
  if (fillWidth > 0) {
    roundRectPath(context, innerLeft, innerTop, fillWidth, innerHeight, innerRadius);
    context.fillStyle = params.teamColorCss;
    context.fill();
  }

  // Predicted-damage bands: darken the slice of the team-colour fill that would be
  // lost (over the fill, clipped to the track) so it reads against the bright fill,
  // not the dark empty track. Guaranteed (≥min) heavier than possible (min→max).
  const estimate = params.estimate;
  if (estimate && params.maxHp > 0 && !estimate.immune) {
    const max = params.maxHp;
    const currentRatio = Math.max(0, Math.min(1, params.currentHp / max));
    const afterMaxRatio = Math.max(0, (params.currentHp - estimate.max) / max);
    const afterMinRatio = Math.max(0, (params.currentHp - estimate.min) / max);
    context.save();
    roundRectPath(context, innerLeft, innerTop, innerWidth, innerHeight, innerRadius);
    context.clip();
    const possibleWidth = (afterMinRatio - afterMaxRatio) * innerWidth;
    if (possibleWidth > 0) {
      context.fillStyle = `rgba(0,0,0,${params.alphaPossible})`;
      context.fillRect(
        innerLeft + afterMaxRatio * innerWidth,
        innerTop,
        possibleWidth,
        innerHeight,
      );
    }
    const guaranteedWidth = (currentRatio - afterMinRatio) * innerWidth;
    if (guaranteedWidth > 0) {
      context.fillStyle = `rgba(0,0,0,${params.alphaGuaranteed})`;
      context.fillRect(
        innerLeft + afterMinRatio * innerWidth,
        innerTop,
        guaranteedWidth,
        innerHeight,
      );
    }
    context.restore();
  }
}
