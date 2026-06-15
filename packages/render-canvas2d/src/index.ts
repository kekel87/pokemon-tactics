/**
 * `@pokemon-tactic/render-canvas2d` — browser-side Canvas2D drawing shared by every
 * renderer (plan 126). Distinct from `presentation` (which is headless: no DOM, runs
 * in a WebWorker): these painters draw HUD textures onto a `CanvasRenderingContext2D`,
 * so they need the DOM lib. Each renderer creates its own engine texture/canvas, then
 * calls these pure painters to draw the pixels — keeping the actual drawing in one
 * place so a renderer swap re-implements only the texture plumbing, not the artwork.
 */

export * from "./champ-pill-canvas.js";
export * from "./hp-bar-canvas.js";
export * from "./text-plane-canvas.js";
