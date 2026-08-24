import type { BattleInstruction } from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

/**
 * Input-prompt glyph (chantier « aide visuelle des gestes attendus », ouvert en fin du Lot 1 du
 * plan-cadre 173). The instruction line says *what* to do (« Choisis la direction ») but never
 * *how*: on a touch screen nothing hints that a direction has to be tapped a second time to fire.
 * This adds a 16×16 1-bit glyph next to the text — Kenney's `input-prompts-pixel-1-bit` pack
 * (CC0), one shared tilemap.
 *
 * Which drawing is shown is a pure CSS decision (`@media (pointer: coarse)` picks the finger,
 * otherwise the mouse), so plugging a mouse into a phone re-styles the prompt without a re-render
 * and without a JS input-source tracker — the Lot 2 tracker can take over later. This module only
 * says which *kind* of gesture the current phase expects.
 */
export const InputPromptKind = {
  /** One tap / one click acts immediately (the general case since plan 183). */
  Act: "act",
  /**
   * Touch only: re-tapping the *same* direction validates it, tapping another one re-aims
   * (plan 183 §C). A mouse keeps its direct path, so the « ×2 » hint is coarse-pointer only.
   */
  ActTwice: "act-twice",
} as const;
export type InputPromptKind = (typeof InputPromptKind)[keyof typeof InputPromptKind];

export interface InputPromptGlyph {
  element: HTMLElement;
  /** Swap the expected gesture; the CSS reads `data-glyph`. */
  update(kind: InputPromptKind): void;
}

/**
 * Decorative span whose mask is the shared tilesheet. The sheet URL comes from the host
 * (`UiDomConfig`) like every other asset path, so the CSS stays free of `url()` and the deploy
 * base path keeps working; the CSS owns the tile coordinates and the pointer-type choice.
 */
export function createInputPromptGlyph(config: UiDomConfig): InputPromptGlyph {
  const element = el("span", "bc-input-glyph", "combat-input-glyph");
  element.setAttribute("aria-hidden", "true");
  // Two sheets, because the tap drawing comes from the cursor pack (plan 185, choix humain
  // 2026-08-24: one tap glyph everywhere) while the key and pad prompts stay on input-prompts. The
  // CSS picks one — hence two distinct names rather than one inline URL, which would beat every
  // stylesheet rule.
  element.style.setProperty("--bc-prompt-sheet", `url("${config.getInputPromptSheetUrl()}")`);
  element.style.setProperty("--bc-cursor-sheet", `url("${config.getCursorSheetUrl()}")`);
  element.dataset.glyph = InputPromptKind.Act;
  // The drawing lives in a child: a `mask` clips its own element's pseudo-elements too, so the
  // "×2" suffix of the two-tap prompt has to sit outside the masked box.
  element.append(el("span", "bc-input-glyph-icon"));

  return {
    element,
    update: (kind: InputPromptKind) => {
      element.dataset.glyph = kind;
    },
  };
}

/**
 * Gesture expected by each instruction phase. Only the two *directional* phases need the second
 * tap: `aimDirection` (cône/ligne/fauche/charge) and `selectDirection` (orientation de fin de tour)
 * open with a direction already shown, and re-tapping it fires (plan 183 §C). Everywhere else a
 * single tap acts.
 */
export const INSTRUCTION_GLYPH: Readonly<Record<BattleInstruction, InputPromptKind>> = {
  selectTarget: InputPromptKind.Act,
  aimDirection: InputPromptKind.ActTwice,
  confirm: InputPromptKind.Act,
  selectRetreat: InputPromptKind.Act,
  selectMoveDestination: InputPromptKind.Act,
  selectDirection: InputPromptKind.ActTwice,
};
