/**
 * Text-plane canvas helpers (plan 126 hoist): measure a line of pixel-font text and
 * rasterise it, the byte-identical logic both renderers' `createTextPlane` carried.
 * The renderer measures first, sizes its engine texture, then draws the glyphs into
 * that texture's 2D context.
 */

/** Shared offscreen canvas for measuring text width before sizing the texture. */
let measureContext: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureContext) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("render-canvas2d/text-plane: 2D canvas context unavailable");
    }
    measureContext = context;
  }
  return measureContext;
}

/** `bold {px}px {family}` — the font string both glyph measurement and drawing use. */
export function textPlaneFontString(fontPx: number, fontFamily: string): string {
  return `bold ${fontPx}px ${fontFamily}`;
}

export interface TextPlaneMetrics {
  readonly textureWidth: number;
  readonly textureHeight: number;
}

/** Measure the fitted texture size for a single line of text (+ padding, + stroke margin). */
export function measureTextPlane(
  text: string,
  fontPx: number,
  fontFamily: string,
  paddingPx: number,
  strokePx: number,
): TextPlaneMetrics {
  const padding = paddingPx + strokePx;
  const measure = getMeasureContext();
  measure.font = textPlaneFontString(fontPx, fontFamily);
  const measured = measure.measureText(text).width;
  return {
    textureWidth: Math.max(1, Math.ceil(measured) + padding * 2),
    textureHeight: fontPx + padding * 2,
  };
}

export interface TextGlyphDrawParams {
  readonly text: string;
  readonly color: string;
  readonly fontPx: number;
  readonly fontFamily: string;
  readonly textureWidth: number;
  readonly textureHeight: number;
  readonly strokeColor?: string;
  readonly strokePx?: number;
}

/** Rasterise a single centred line of pixel-font text onto `context`. */
export function drawTextGlyphs(
  context: CanvasRenderingContext2D,
  params: TextGlyphDrawParams,
): void {
  const { textureWidth, textureHeight } = params;
  const strokePx = params.strokePx ?? 0;
  context.clearRect(0, 0, textureWidth, textureHeight);
  context.font = textPlaneFontString(params.fontPx, params.fontFamily);
  context.textAlign = "center";
  context.textBaseline = "middle";
  const centerX = textureWidth / 2;
  const centerY = textureHeight / 2;
  if (strokePx > 0) {
    context.lineJoin = "round";
    context.strokeStyle = params.strokeColor ?? "#000000";
    context.lineWidth = strokePx;
    context.strokeText(params.text, centerX, centerY);
  }
  context.fillStyle = params.color;
  context.fillText(params.text, centerX, centerY);
}
