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
   * Descriptors (`TAG.class[testid] "texte" LxH`) of every tappable control in the document whose
   * hit-area falls below `minimumPx` in EITHER direction — empty array = the touch floor holds.
   * Only meaningful under `hasTouch: true`, which is what puts `pointer: coarse` in force and
   * raises `--target-min` to 30px (plan 206).
   *
   * Three rules, each one a false verdict avoided:
   *  - **le `<label>` enveloppant remplace son champ** — a label wrapping a checkbox is tappable in
   *    full, and a native checkbox is 13px, so measuring the input would fail every screen that has
   *    one (`.claude/rules/multi-input.md` §3);
   *  - **width counts as much as height** — a one-glyph button (the EV-row reset « D ») was 25×30,
   *    under the floor by its width alone;
   *  - **no box, no verdict** — `getClientRects()` empty or a zero side means not laid out (a closed
   *    `<dialog>`, a collapsed row): nothing to tap, nothing to fail.
   *
   * The descriptor is the whole point of returning strings rather than a count: an assertion that
   * says "3 controls too small" and not WHICH ones is undebuggable.
   *
   * Trois limites CONNUES, aucune atteinte aujourd'hui — écrites pour qu'un futur rouge ne se lise
   * pas comme un oubli :
   *  - **les contrôles désactivés sont jugés comme les autres** — pas de `:not(:disabled)`, à la
   *    différence de `FOCUSABLE_SELECTOR`. C'est un choix : un bouton grisé redevient cliquable, et
   *    il occupe la même boîte dans les deux états, donc le plancher doit tenir tout de suite.
   *  - **seul le `<label>` ENVELOPPANT est reconnu** (`closest("label")`). Un `<label for="…">`
   *    posé à côté de sa case laisserait mesurer la case native de 13 px, donc un rouge injustifié.
   *    Il n'y en a aucun dans le jeu ; en introduire un demande d'étendre la règle ici.
   *  - **un écran booté en sandbox ramène le chrome du studio** — `.sb-member-trash` fige 28 px et
   *    `.sb-form-row` n'a pas de plancher (`sandbox-studio.css`). Outil de développement, jamais
   *    touché au doigt, délibérément hors du réglage unique : ne pas sonder une page de sandbox
   *    sans le savoir.
   */
  undersizedTouchTargets(minimumPx: number): Promise<string[]> {
    return this.page.evaluate((minimum) => {
      const host = document.documentElement;
      const tappable =
        'button, input:not([type=hidden]), select, textarea, a[href], [tabindex="0"], [role="button"]';
      // Set, not array: one label wrapping several fields must be measured once, and a control
      // that matches two clauses of the selector must not be reported twice.
      const measured = new Set<HTMLElement>();
      for (const node of host.querySelectorAll<HTMLElement>(tappable)) {
        const isField = ["INPUT", "SELECT", "TEXTAREA"].includes(node.tagName);
        const wrapper = isField ? node.closest("label") : null;
        measured.add(wrapper ?? node);
      }

      const offenders: string[] = [];
      for (const node of measured) {
        const box = node.getBoundingClientRect();
        if (node.getClientRects().length === 0 || box.width === 0 || box.height === 0) {
          continue;
        }
        if (box.width >= minimum && box.height >= minimum) {
          continue;
        }
        // `getAttribute`, pas `className` : sur un `SVGElement` ce dernier rend un
        // `SVGAnimatedString`, et le `.split` planterait DANS `evaluate` — donc un crash au lieu
        // d'un échec lisible. Le jeu n'a aucun `<svg>` aujourd'hui ; l'assurance est gratuite.
        const classAttribute = node.getAttribute("class") ?? "";
        const classes =
          classAttribute === "" ? "" : `.${classAttribute.trim().split(/\s+/).join(".")}`;
        const testId = node.dataset.testid === undefined ? "" : `[${node.dataset.testid}]`;
        const label = (node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
        const size = [box.width, box.height].map((side) => Math.round(side * 10) / 10).join("×");
        offenders.push(`${node.tagName}${classes}${testId} "${label}" ${size}`);
      }
      return offenders.sort();
    }, minimumPx);
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
/** `.ts-root` — team-select screen root (une colonne de camps depuis le plan 188 #832 : la liste
 *  d'équipes qui occupait le centre est passée en modale). */
export const TEAM_SELECT_ROOT = ".ts-root";
/** Colonne des camps : c'est elle qui défile depuis le plan 188 (la liste d'équipes a quitté
 *  l'écran), et elle doit prendre la contrainte pour que header et footer restent ancrés. */
export const TEAM_SELECT_SCROLLERS = ".ts-players-column";
/** `.tb-root` — Team Builder overlay root (topbar, slot row, edit panels). */
export const TEAM_BUILDER_ROOT = ".tb-root";
/** Team Builder scrollers: the screen body, and the picker lists/grid inside its dialogs. */
export const TEAM_BUILDER_SCROLLERS = ".tb-content, .tb-list, .tb-pokemon-grid";
