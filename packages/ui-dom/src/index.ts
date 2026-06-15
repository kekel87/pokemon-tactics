/**
 * `@pokemon-tactic/ui-dom` — reusable HTML UI (plan 125, Phase 4). Combat-chrome
 * (battle chrome, log, timeline, weather HUD, move tooltip, info panel, placement
 * roster, pattern preview) + generic primitives (Modal, Stepper, form-controls).
 * Engine-agnostic DOM; receives i18n / asset-path deps via `UiDomConfig` at mount
 * time (or per-call params), so any renderer can reuse the same UI.
 */

export * from "./BattleLogFormatter.js";
export * from "./battle-chrome.js";
export * from "./battle-log.js";
export * from "./config.js";
export * from "./constants.js";
export * from "./form-controls.js";
export * from "./game-stage.js";
export * from "./info-panel.js";
export * from "./Modal.js";
export * from "./move-tooltip.js";
export * from "./pattern-preview.js";
export * from "./placement-roster.js";
export * from "./Stepper.js";
export * from "./turn-timeline.js";
export * from "./weather-hud.js";
