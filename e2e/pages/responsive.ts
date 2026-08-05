import type { Locator, Page } from "@playwright/test";

/** Rendered box + text size of one element, in CSS px — the unit of every layout assertion here. */
export interface ElementMetrics {
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

/**
 * Page Object for the responsive contract (plan 179) — cahier §4.16 / §6.9 / §7.5.
 *
 * Signals, none of them pixel-based:
 *  - `--ui-scale`, the number the whole chrome is sized from (which design reference won);
 *  - the box + `font-size` of an element (does it follow that scale, or is it frozen?);
 *  - a layout audit: which boxes leave the viewport ("nothing is cut off");
 *  - the `data-state` transitions of a node (loading → idle), recorded rather than sampled.
 *
 * ⚠️ Several helpers take a **CSS selector** instead of a `Locator`. Deliberate: they measure
 * *layout* on elements that carry no role, text or testid (`.pl-roster-portrait`, `.bl-list`),
 * and adding testids to source is not this file's business. User-facing locators stay on
 * role/text/testid, as everywhere else in the suite.
 */
export class Responsive {
  /** Portrait « tourne ton écran » blocker (`aria-hidden` → testid is the only stable handle). */
  readonly orientationPrompt: Locator;

  constructor(private readonly page: Page) {
    this.orientationPrompt = page.getByTestId("orientation-prompt");
  }

  /** `--ui-scale` published on `#game-stage` = stage size ÷ the design reference in force. */
  uiScale(): Promise<number> {
    return this.page.evaluate(() => {
      const stage = document.getElementById("game-stage");
      return stage === null
        ? Number.NaN
        : Number.parseFloat(getComputedStyle(stage).getPropertyValue("--ui-scale"));
    });
  }

  /**
   * Content box of `#game-stage` — the box the `ResizeObserver` feeds to `applyScale`, so the ONLY
   * correct input for an expected `--ui-scale`. It is NOT the viewport: the sandbox studio wraps the
   * stage between its header and its editor columns, so the stage is much shorter there than the
   * window. Deriving expectations from the viewport made two tests assert a scale 2.5× too high.
   */
  stageBox(): Promise<{ width: number; height: number } | null> {
    return this.page.evaluate(() => {
      const stage = document.getElementById("game-stage");
      if (stage === null) {
        return null;
      }
      // Fractionnaire, pas `clientWidth`/`clientHeight` (entiers arrondis) : le `ResizeObserver`
      // alimente `applyScale` avec un `contentBoxSize` fractionnaire, et un demi-pixel d'écart
      // suffit à faire échouer une comparaison d'échelle à 4 décimales. Le stage n'a ni bordure ni
      // padding, donc la border-box vaut la content-box.
      const box = stage.getBoundingClientRect();
      return box.height === 0 ? null : { width: box.width, height: box.height };
    });
  }

  /** Computed `font-size` of a located element, in CSS px. */
  fontSizePx(target: Locator): Promise<number> {
    return target.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  }

  /**
   * Box + `font-size` of the FIRST element matching `selector`, or `null` when nothing matches or
   * it is not laid out yet. Returning `null` (rather than throwing) keeps it usable inside
   * `expect.poll`, which is how a test waits for a screen to settle.
   */
  metrics(selector: string): Promise<ElementMetrics | null> {
    return this.page.evaluate((target) => {
      const node = document.querySelector(target);
      if (node === null) {
        return null;
      }
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        return null;
      }
      return {
        width: box.width,
        height: box.height,
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
      };
    }, selector);
  }

  /**
   * Descriptors (`TAG.class|left,top,right,bottom`) of every element under `rootSelector` whose box
   * leaves the viewport — empty array = nothing cut off. `scrollerSelector` is a selector LIST of
   * the containers that scroll **by design** (`.tt-list` clips the timeline strip, `.ms-list` the
   * map list): their subtrees are skipped, since a child scrolled out of a scroller is not a
   * layout bug.
   */
  elementsOutsideViewport(rootSelector: string, scrollerSelector: string): Promise<string[]> {
    return this.page.evaluate(
      ([root, scroller]) => {
        const host = document.querySelector(root);
        if (host === null) {
          return [`missing root: ${root}`];
        }
        const offenders: string[] = [];
        for (const node of host.querySelectorAll<HTMLElement>("*")) {
          if (node.closest(scroller) !== null) {
            continue;
          }
          const box = node.getBoundingClientRect();
          if (box.width === 0 && box.height === 0) {
            continue; // Not laid out (collapsed/empty) — nothing to overflow.
          }
          // 1px of tolerance: sub-pixel layout at fractional scales.
          if (
            box.left < -1 ||
            box.top < -1 ||
            box.right > window.innerWidth + 1 ||
            box.bottom > window.innerHeight + 1
          ) {
            const rounded = [box.left, box.top, box.right, box.bottom].map(Math.round).join(",");
            offenders.push(`${node.tagName}.${node.className}|${rounded}`);
          }
        }
        return offenders;
      },
      [rootSelector, scrollerSelector] as const,
    );
  }

  /**
   * Start recording the `data-state` values `selector` goes through, including the one it already
   * carries. Installed BEFORE the action that triggers the transition, so a short-lived state
   * (`loading` on a preview that builds fast) is captured instead of raced against — the
   * alternative, sampling the attribute after the click, is a coin toss.
   */
  watchDataState(selector: string): Promise<void> {
    return this.page.evaluate((target) => {
      const node = document.querySelector<HTMLElement>(target);
      const store: string[] = [];
      (globalThis as { __ptDataStates__?: string[] }).__ptDataStates__ = store;
      if (node === null) {
        return;
      }
      const push = (): void => {
        const state = node.dataset.state ?? "";
        if (store.at(-1) !== state) {
          store.push(state);
        }
      };
      push();
      new MutationObserver(push).observe(node, {
        attributes: true,
        attributeFilter: ["data-state"],
      });
    }, selector);
  }

  /** The `data-state` values recorded since {@link watchDataState}, in order, without repeats. */
  recordedDataStates(): Promise<string[]> {
    return this.page.evaluate(
      () => (globalThis as { __ptDataStates__?: string[] }).__ptDataStates__ ?? [],
    );
  }
}

/** `#game-overlay .ui-screen` — the combat chrome layer (edge-anchored panels). */
export const COMBAT_CHROME_ROOT = "#game-overlay .ui-screen";
/** Intentional scrollers of the chrome: the timeline strip and the battle-log list. */
export const COMBAT_CHROME_SCROLLERS = ".tt-list, .bl-list";
/** `.ms-screen` — map-select screen root (two columns, a button pinned at the bottom of each). */
export const MAP_SELECT_ROOT = ".ms-screen";
/** Map list: the scroller since plan 179 (it takes the squeeze so the buttons stay pinned). */
export const MAP_SELECT_SCROLLERS = ".ms-list";
/** `.ts-root` — team-select screen root (slots on the left, saved teams on the right). */
export const TEAM_SELECT_ROOT = ".ts-root";
/** Saved-teams list: scrolls by design, its cards are clipped. */
export const TEAM_SELECT_SCROLLERS = ".ts-team-list";
/** `.tb-root` — Team Builder overlay root (topbar, slot row, edit panels). */
export const TEAM_BUILDER_ROOT = ".tb-root";
/** Team Builder scrollers: the screen body, and the picker lists/grid inside its dialogs. */
export const TEAM_BUILDER_SCROLLERS = ".tb-content, .tb-list, .tb-pokemon-grid";
