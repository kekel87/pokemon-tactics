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
export * from "./chrome-insets.js";
export * from "./combat-menu-button.js";
export * from "./config.js";
export * from "./constants.js";
/*
 * Export nommé, pas `export *` : la légende de contrôles reste interne (montée par `battle-chrome`),
 * seule sa fabrique de capuchon sort — c'est elle qui garantit qu'un indice sous un bouton dessine la
 * même touche que la légende (plan 189).
 */
export { createKeyHint, type KeyHintSpec } from "./control-legend.js";
export * from "./form-controls.js";
export * from "./fullscreen-button.js";
export * from "./game-stage.js";
export * from "./info-panel.js";
export * from "./input-prompt-glyph.js";
export * from "./Modal.js";
export * from "./move-tooltip.js";
export * from "./pattern-preview.js";
export * from "./placement-roster.js";
export * from "./Stepper.js";
export * from "./tile-info-panel.js";
export * from "./turn-timeline.js";
export * from "./type-chip.js";
export * from "./weather-hud.js";
