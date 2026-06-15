/**
 * Champ-zone counter badge canvas painter (plan 126 hoist): the round badge both
 * renderers drew — team-colour fill, Champ-colour ring, white turn count centred on
 * its own ink box. The renderer owns the engine texture; this draws the pixels.
 */

/** Texture resolution of the round counter badge (NEAREST, kept crisp). */
export const CHAMP_PILL_TEXTURE_SIZE = 64;

export interface ChampPillDrawParams {
  /** Turns left, shown centred in the badge. */
  readonly label: string;
  /** Owning team colour as CSS (badge fill). */
  readonly teamColorCss: string;
  /** Champ identity colour as CSS (badge border). */
  readonly borderColorCss: string;
  /** Number glyph colour as CSS. */
  readonly textColorCss: string;
  /** Font family for the count glyph. */
  readonly fontFamily: string;
}

/** Draw the round Champ badge onto `context` (a `size`×`size` canvas). */
export function drawChampPillBadge(
  context: CanvasRenderingContext2D,
  size: number,
  params: ChampPillDrawParams,
): void {
  const center = size / 2;
  const ringWidth = 6;
  const radius = center - ringWidth / 2 - 1;
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = params.teamColorCss;
  context.fill();
  context.lineWidth = ringWidth;
  context.strokeStyle = params.borderColorCss;
  context.stroke();
  context.font = `bold ${Math.round(size * 0.62)}px ${params.fontFamily}`;
  context.textAlign = "center";
  // Exact vertical centring: align on the glyph's own ink box (pixel fonts have
  // odd metrics, so "middle" baseline alone leaves the number off-centre).
  context.textBaseline = "alphabetic";
  context.fillStyle = params.textColorCss;
  const metrics = context.measureText(params.label);
  const baselineY =
    center + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  context.fillText(params.label, center, baselineY);
}
