import type { ChromeInsetProbe } from "./chrome-insets.js";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

/**
 * Camera control legend, pinned around the compass (plan 185).
 *
 * Nothing on screen announced a single camera shortcut: rotation (`A`/`E`) and zoom (`R`/`F`) had
 * existed since plan 184 and a player who reads no manual would never find them. The compass'
 * ring-arrow mesh said "this is tappable" and nothing more — it is replaced by this legend, which
 * says what the *keys* do too, and lives in the DOM where stacking lines is trivial.
 *
 * Layout (retours humains 2026-08-24):
 *   - the "it clicks" drawing sits to the RIGHT of the compass, vertically centred on it;
 *   - two lines sit UNDER the compass, one per control, each entry reading `[drawing][key]` — one
 *     entry per DIRECTION rather than one shared drawing, and the same order on both lines.
 *
 * Placed from the SAME measurement as the compass: `chrome-insets.ts` reports the timeline's first
 * portrait (right edge, top, side) and the renderer pins the compass to it — so the legend reads
 * those numbers too and lands exactly beside and under the needle, at any stage size.
 *
 * Two earlier attempts are worth not repeating:
 *   - hanging the legend off the active slot in the DOM (`position: absolute` inside it): the slot
 *     EMPTIES during a move-CT preview (no entry is `isActive` then), its box collapsed to 0×0 and
 *     the legend piled onto the compass;
 *   - reserving that box in CSS with `min-inline-size`: the compass measures the very same box, so
 *     the reserve moved the compass by the ~1px the reconstruction was off.
 *
 * Hence the probe is passed IN, never created here: the measurement has one owner (the host, which
 * also disposes it) and both consumers read it rather than recomputing it.
 *
 * Positions are written only when the measurement changes (`subscribe`), never per frame.
 *
 * Which device the lines describe is a pure CSS decision (`data-input-source`, with
 * `@media (pointer: coarse)` as the "nothing observed yet" default) — same precedence as the
 * instruction-line glyph.
 */

/**
 * Which sheet a drawing comes from. Two are in play and their geometries differ, so the tile-offset
 * maths has to know: `input-prompts` is 34×24 tiles, `cursors` is 20×11.
 */
const Sheet = {
  /** Kenney `input-prompts-pixel-1-bit`: the mouse and every key cap. */
  Prompts: "cl-sheet-prompts",
  /** Kenney `cursor-pixel-pack`: magnifiers, pinch/spread, the rotation pair, the pointing hand. */
  Cursors: "cl-sheet-cursors",
} as const;
type Sheet = (typeof Sheet)[keyof typeof Sheet];

/**
 * Character → tile, on the input-prompts sheet. That sheet lays its key caps out in PHYSICAL QWERTY
 * order, so this table maps the DRAWN character, never the `code`: on AZERTY the `KeyQ` binding must
 * be drawn with the `A` cap. `key-legend.ts` (app side) turns a position into a character.
 */
const CHARACTER_TILE: Readonly<Record<string, readonly [number, number]>> = {
  ...tileRun("1234567890", 17, 1),
  ...tileRun("QWERTYUIOP", 17, 2),
  ...tileRun("ASDFGHJKL", 18, 3),
  ...tileRun("ZXCVBNM", 19, 4),
};

/** Space bar "small" cap: the stand-in for "press a key" when we cannot name the character. */
const GENERIC_KEY_TILE = [17, 4] as const;

/**
 * Capuchons NOMMÉS — ceux dont la feuille dessine le mot plutôt qu'un caractère (plan 189).
 *
 * ⚠️ **Ceci lève la décision #791**, qui déclarait les touches de plus d'une tuile « inutilisables par
 * un masque d'une tuile » : c'était vrai du masque, pas de la feuille. Un capuchon de 2 tuiles se
 * dessine en élargissant la FENÊTRE (`--cl-cap-span`, lu par le CSS) — `mask-size` et `mask-position`
 * ne changent pas, seule la boîte s'ouvre sur la tuile voisine. Le tenant-lieu générique reste la
 * barre d'espace pour tout ce qui n'a toujours pas de capuchon.
 *
 * Relevé le 2026-08-26 sur `tilemap-1bit.png`, crops vérifiés à l'œil (34 × 24 tuiles de 16 px).
 */
const NAMED_CAP: Readonly<
  Record<string, { readonly tile: readonly [number, number]; readonly span: 1 | 2 }>
> = {
  Escape: { tile: [17, 0], span: 1 },
  ShiftLeft: { tile: [17, 7], span: 2 },
  PageUp: { tile: [23, 6], span: 2 },
  PageDown: { tile: [25, 6], span: 2 },
};

/** One contiguous run of caps: `characters[i]` sits at column `firstColumn + i` of `line`. */
function tileRun(
  characters: string,
  firstColumn: number,
  line: number,
): Record<string, readonly [number, number]> {
  const tiles: Record<string, readonly [number, number]> = {};
  for (const [index, character] of [...characters].entries()) {
    tiles[character] = [firstColumn + index, line];
  }
  return tiles;
}

/**
 * What an entry stands for. Published as `data-cl-role` so the CSS can name the cap it overrides for
 * the gamepad: positional selectors could not — every child of a line is a `<span>`, so
 * `:nth-of-type` counts the drawing too and shifted every gamepad cap by one (caught at self-check,
 * 2026-08-24).
 *
 * The names are the keys of `CameraKeyLabels`: the host resolves each control's key from ITS binding
 * table, so no `KeyboardEvent.code` is ever written here — the remapping screen will have a single
 * table to rewrite, and this legend cannot drift from it in silence.
 */
const Role = {
  RotateLeft: "rotateLeft",
  RotateRight: "rotateRight",
  ZoomIn: "zoomIn",
  ZoomOut: "zoomOut",
} as const;
type Role = (typeof Role)[keyof typeof Role];

/**
 * Role → the kebab-case form the DOM uses (`data-cl-role`, `data-testid`). The role itself is
 * camelCase because it doubles as a `CameraKeyLabels` key; the DOM convention is kebab-case, so one
 * conversion beats a second hand-written table that could disagree with the first.
 */
const dashed = (role: Role): string =>
  role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * The drawing each control gets: an entry cannot be paired with the wrong one.
 *
 */
const ROLE_DRAWING: Readonly<Record<Role, string>> = {
  [Role.RotateLeft]: "cl-glyph-rotate-left",
  [Role.RotateRight]: "cl-glyph-rotate-right",
  [Role.ZoomIn]: "cl-glyph-zoom-in",
  [Role.ZoomOut]: "cl-glyph-zoom-out",
};

/** The touch gesture that takes the key cap's place, on the two zoom entries. */
const ROLE_GESTURE: Readonly<Record<"zoomIn" | "zoomOut", string>> = {
  [Role.ZoomIn]: "cl-glyph-spread",
  [Role.ZoomOut]: "cl-glyph-pinch",
};

/**
 * A drawing: a masked square whose tile the CSS resolves from its class.
 *
 * Every drawing carries a `data-testid`, decorative though it is: the legend has no role and no text
 * for a test to grab, and the e2e rules forbid reaching for a CSS class. The tile itself is readable
 * from the computed custom properties, so a test asserts a VALUE rather than a screenshot.
 */
function glyph(sheet: Sheet, modifier: string, testId: string): HTMLElement {
  return el("span", `cl-glyph ${sheet} ${modifier}`, testId);
}

/**
 * A key cap. The tile is published as `--cl-cap-col/row`, which the CSS forwards into the mask
 * offset — and which the CSS *overrides* for the gamepad, whose caps (LB/RB/LT/RT) are fixed. The
 * indirection matters: an inline `--cl-col` would beat every stylesheet rule, so the layout-derived
 * value gets its own property name and the CSS decides which one wins.
 */
function keyCap(character: string, role: Role): HTMLElement {
  return applyCapTile(glyph(Sheet.Prompts, "cl-cap", `legend-cap-${dashed(role)}`), character);
}

/**
 * Pose la tuile d'un capuchon sur un élément déjà créé — partagé par la légende et par les indices
 * sous les boutons du chrome (plan 189), pour que les deux dessinent le même capuchon pour la même
 * touche. Deux tables et deux replis auraient dérivé l'un de l'autre au premier ajout.
 */
function applyCapTile(cap: HTMLElement, character: string): HTMLElement {
  /*
   * Un capuchon NOMMÉ d'abord (`PageUp`, `Escape`…), un caractère ensuite, le tenant-lieu en dernier.
   * L'ordre compte : `CHARACTER_TILE` n'a que `A-Z0-9`, donc une position nommée y échouerait et
   * retomberait sur un capuchon VIERGE — lisible comme « presse une touche », ce qui n'apprend rien.
   */
  const named = NAMED_CAP[character];
  const [column, line] = named?.tile ?? CHARACTER_TILE[character] ?? GENERIC_KEY_TILE;
  cap.style.setProperty("--cl-cap-col", String(column));
  cap.style.setProperty("--cl-cap-row", String(line));
  // Publié seulement quand il vaut 2 : le CSS retombe sur 1 par défaut, et une propriété inline en
  // moins par capuchon sur une légende redessinée à chaque mesure.
  if (named && named.span !== 1) {
    cap.style.setProperty("--cl-cap-span", String(named.span));
  }
  return cap;
}

/**
 * Boutons de manette dessinés, par index de *mapping standard* W3C (plan 189).
 *
 * Variantes **contour**, comme les LB/RB/LT/RT de la légende et le bouton A : mélanger contour et
 * plein ferait deux vocabulaires dans le même chrome. Relevé le 2026-08-26 (ligne 20 = contour, 21 =
 * plein).
 *
 * `Start` est cerclé d'un `+` : c'est le dessin Nintendo, et c'est le bon défaut ici — la manette de
 * référence du projet est une Switch Pro, où ce bouton porte littéralement un `+`.
 */
const PAD_BUTTON_TILE: Readonly<Record<number, readonly [number, number]>> = {
  8: [4, 20],
  9: [5, 20],
  // `R3` — le stick DROIT avec la flèche de pression, c'est-à-dire le clic et non une inclinaison.
  // La feuille offre aussi le stick par direction (vertical, horizontal, les quatre) : ce sont des
  // dessins différents, et celui-ci est le seul qui dise « appuie dessus » (relevé 2026-08-26).
  11: [16, 14],
};

/**
 * Croix directionnelle, un segment allumé par direction (plan 189). Relevé le 2026-08-26, colonnes 1
 * à 4 de la ligne 2, dans le sens horaire à partir du haut.
 */
const PAD_DIRECTION_TILE: Readonly<Record<string, readonly [number, number]>> = {
  up: [1, 2],
  right: [2, 2],
  down: [3, 2],
  left: [4, 2],
};

/** Ce qu'un indice de touche doit annoncer, par appareil. */
export interface KeyHintSpec {
  /** `KeyboardEvent.code` (`PageUp`, `KeyJ`…) ou caractère déjà résolu. Vide = rien à dire. */
  readonly key: string;
  /**
   * Le binding porte-t-il `Maj` ? Dessiné en DEUX capuchons (`SHIFT` puis la touche), la feuille n'en
   * ayant aucun pour « Maj+X ». Sans ça, un binding à Maj — le défilement du journal, par exemple —
   * ne pouvait s'annoncer nulle part et disparaissait purement et simplement (retour humain
   * 2026-08-26).
   */
  readonly shift?: boolean;
  /** Index de bouton en mapping standard, quand la manette a un équivalent. */
  readonly pad?: number;
  /**
   * Geste manette : un bouton **maintenu** + une direction (plan 189).
   *
   * Le défilement des panneaux n'est pas un bouton à la manette — c'est `R3` tenu plus le curseur
   * (`SCROLL_BY_CURSOR_ACTION`). Il n'avait donc rien à annoncer et l'indice disparaissait pad en
   * main, ce qui se lisait comme « pas de raccourci » alors qu'il en existe un (retour humain
   * 2026-08-26).
   *
   * Le modificateur est un index de bouton comme un autre (`R3` = 11) : il se dessine avec le glyphe
   * de clic du stick droit, et la direction avec la croix — c'est bien elle (ou le stick gauche) qu'on
   * pousse, `SCROLL_BY_CURSOR_ACTION` passant par les actions de curseur.
   */
  readonly padGesture?: {
    readonly modifier: number;
    readonly direction: "up" | "down" | "left" | "right";
  };
}

/**
 * Un capuchon **autonome**, à coller sous un bouton du chrome (plan 189).
 *
 * La règle que ça sert : *un bouton du chrome porte le glyphe de sa touche sous lui* (décision 10).
 * Elle vaut pour le journal, pour le menu de combat, pour l'ordre de jeu, et pour tout bouton ajouté
 * ensuite — d'où une fabrique plutôt que trois copies.
 *
 * **Les deux appareils sont dessinés, le CSS choisit** — comme partout ailleurs dans ce chrome
 * (`data-input-source`, avec `pointer: coarse` comme défaut « rien d'observé »). Sans ça l'indice
 * annonçait `ESC` à un joueur manette en main, qui cherchait `Start` (retour humain 2026-08-26).
 *
 * Rend `null` quand il n'y a rien à annoncer : pas de capuchon vierge, qui se lirait « presse une
 * touche » sans dire laquelle.
 *
 * Prend l'URL de la feuille et non un `UiDomConfig` : c'est tout ce dont un capuchon a besoin, et les
 * appelants ne sont pas tous dans une fonction qui a déjà construit la config complète.
 */
export function createKeyHint(
  promptSheetUrl: string,
  spec: KeyHintSpec,
  testId: string,
): HTMLElement | null {
  const padTile = spec.pad === undefined ? undefined : PAD_BUTTON_TILE[spec.pad];
  const gesture = spec.padGesture;
  if (spec.key === "" && padTile === undefined && gesture === undefined) {
    return null;
  }
  const hint = el("span", "cl-hint", testId);
  // Décoratif : le bouton qu'il annote porte déjà son nom accessible.
  hint.setAttribute("aria-hidden", "true");
  hint.style.setProperty("--cl-prompt-sheet", `url("${promptSheetUrl}")`);
  if (spec.key !== "") {
    if (spec.shift === true) {
      hint.append(
        applyCapTile(glyph(Sheet.Prompts, "cl-cap cl-hint-key", `${testId}-shift`), "ShiftLeft"),
      );
      /*
       * Un `+` en TEXTE entre les deux capuchons (retour humain 2026-08-26) : sans lui, `SHIFT`
       * `PAGE↑` se lit comme deux touches au choix plutôt qu'une combinaison.
       *
       * Texte et non capuchon, délibérément — c'est la même règle que la ligne de zoom de la légende
       * (plan 185) : un capuchon `+` se lirait « presse la touche + », qui n'est pas ce qu'on dit.
       */
      const plus = el("span", "cl-hint-plus");
      plus.textContent = "+";
      hint.append(plus);
    }
    const character = NAMED_CAP[spec.key] ? spec.key : (keyCharacterOf(spec.key) ?? spec.key);
    hint.append(
      applyCapTile(glyph(Sheet.Prompts, "cl-cap cl-hint-key", `${testId}-cap`), character),
    );
  }
  if (padTile !== undefined) {
    const cap = glyph(Sheet.Prompts, "cl-cap cl-hint-pad", `${testId}-pad`);
    cap.style.setProperty("--cl-cap-col", String(padTile[0]));
    cap.style.setProperty("--cl-cap-row", String(padTile[1]));
    hint.append(cap);
  }
  if (gesture !== undefined) {
    const group = el("span", "cl-hint-gesture", `${testId}-gesture`);
    // Pas de repli en dur : recopier des coordonnées ici les ferait diverger de la table le jour où
    // elle bouge. Un modificateur inconnu ne dessine rien, ce qui se remarque — contrairement à un
    // bouton dessiné pour un autre.
    const modifierTile = PAD_BUTTON_TILE[gesture.modifier];
    const modifier = glyph(Sheet.Prompts, "cl-cap", `${testId}-modifier`);
    if (modifierTile !== undefined) {
      modifier.style.setProperty("--cl-cap-col", String(modifierTile[0]));
      modifier.style.setProperty("--cl-cap-row", String(modifierTile[1]));
    }
    const plus = el("span", "cl-hint-plus");
    plus.textContent = "+";
    const direction = glyph(Sheet.Prompts, "cl-cap", `${testId}-direction`);
    const tile = PAD_DIRECTION_TILE[gesture.direction];
    if (tile !== undefined) {
      direction.style.setProperty("--cl-cap-col", String(tile[0]));
      direction.style.setProperty("--cl-cap-row", String(tile[1]));
    }
    group.append(modifier, plus, direction);
    hint.append(group);
  }
  return hint;
}

/**
 * `KeyJ` → `J`, pour les positions que la feuille dessine par caractère. Volontairement naïf : la
 * résolution de disposition (AZERTY/QWERTY) vit côté app dans `key-legend.ts`, qui livre déjà un
 * caractère à la légende. Ici on ne rattrape que le cas d'un `code` passé tel quel.
 */
function keyCharacterOf(code: string): string | undefined {
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter !== undefined) {
    return letter;
  }
  return /^Digit([0-9])$/.exec(code)?.[1];
}

/** `[drawing][key]`, in that order on every line (retour humain 2026-08-24: one reading order). */
function entry(role: Role, character: string): HTMLElement {
  const group = el("span", "cl-entry", `legend-${dashed(role)}`);
  group.dataset.clRole = dashed(role);
  group.append(
    glyph(Sheet.Cursors, ROLE_DRAWING[role], `legend-glyph-${dashed(role)}`),
    keyCap(character, role),
  );
  return group;
}

/**
 * A touch entry, same shape as a key entry: `[what it does][how]`. The gesture drawing takes the key
 * cap's place — so the magnifier still says WHICH way the zoom goes, and the hand says the gesture
 * that gets there (retour humain 2026-08-24). `pointer: coarse` only.
 */
function gestureEntry(role: "zoomIn" | "zoomOut"): HTMLElement {
  const group = el("span", "cl-entry cl-entry-gesture", `legend-${dashed(role)}-gesture`);
  group.append(
    glyph(Sheet.Cursors, ROLE_DRAWING[role], `legend-gesture-glyph-${dashed(role)}`),
    glyph(Sheet.Cursors, ROLE_GESTURE[role], `legend-gesture-hand-${dashed(role)}`),
  );
  return group;
}

/**
 * Ce que la légende rend depuis le plan 189 : deux morceaux montés à deux endroits.
 *
 * `element` reste **ancré à la boussole** (le dessin « ça se clique », posé depuis la mesure du
 * renderer). `rows` part dans la colonne latérale de l'ordre de jeu, où l'humain veut lire les
 * contrôles caméra — sous le capuchon `Page↑` et au-dessus de `Page↓`. Les deux ne peuvent pas
 * partager un positionnement : l'un suit une mesure 3D, l'autre le flux d'une colonne DOM.
 */
export interface ControlLegend {
  /** Ancré à la boussole, en absolu sur la couche d'écran. */
  readonly element: HTMLElement;
  /** Les lignes de contrôles caméra, à monter dans le flux d'un hôte. */
  readonly rows: HTMLElement;
}

export function createControlLegend(config: UiDomConfig, insets: ChromeInsetProbe): ControlLegend {
  const element = el("div", "cl-root", "control-legend");
  // Decorative: the board is a canvas and screen-reader support is out of scope (décision #752).
  element.setAttribute("aria-hidden", "true");
  element.style.setProperty("--cl-prompt-sheet", `url("${config.getInputPromptSheetUrl()}")`);
  element.style.setProperty("--cl-cursor-sheet", `url("${config.getCursorSheetUrl()}")`);

  /*
   * The compass' own box, in stage pixels. `rightPx` already includes the clearance the renderer
   * leaves beside the timeline, so it IS the compass' left edge; the needle is square, side =
   * `sizePx`. Hidden until the first measurement lands (the scene mounts before the chrome), so the
   * legend never flashes in a corner.
   */
  element.hidden = true;
  insets.subscribe((cell) => {
    element.hidden = false;
    element.style.setProperty("--cl-compass-left", `${cell.rightPx}px`);
    element.style.setProperty("--cl-compass-top", `${cell.topPx}px`);
    element.style.setProperty("--cl-compass-side", `${cell.sizePx}px`);
  });

  // Invisible stand-in for the compass square: everything positions against it rather than against
  // the stage, so "to its right" and "under it" are each one offset away.
  const compassBox = el("div", "cl-compass-box");

  // "The compass is clickable / tappable" — to its right, vertically centred (retour humain). Both
  // drawings exist; the CSS shows the one matching the active source, and neither on a gamepad.
  const tapHint = el("div", "cl-tap", "control-legend-tap");
  tapHint.append(
    glyph(Sheet.Prompts, "cl-glyph-mouse", "legend-glyph-mouse"),
    glyph(Sheet.Cursors, "cl-glyph-hand", "legend-glyph-hand"),
  );
  compassBox.append(tapHint);

  const rows = el("div", "cl-rows");

  // Rotation: one entry per direction. Hidden on touch — the compass itself turns the view there,
  // and there is no key to press.
  const keys = config.getCameraKeyLabels();
  const rotateRow = el("div", "cl-row cl-row-rotate", "control-legend-rotate");
  rotateRow.append(
    entry(Role.RotateLeft, keys.rotateLeft),
    entry(Role.RotateRight, keys.rotateRight),
  );

  // Zoom: magnifiers, which carry their own sign — the input-prompts sheet has no magnifier at all,
  // and a `+` KEY CAP would have read as "press the + key", which is not a binding (plan 184). The
  // touch entries keep the SAME magnifiers and swap the key cap for the hand gesture, so the two
  // devices read as one legend rather than two vocabularies.
  const zoomRow = el("div", "cl-row cl-row-zoom", "control-legend-zoom");
  zoomRow.append(
    entry(Role.ZoomIn, keys.zoomIn),
    entry(Role.ZoomOut, keys.zoomOut),
    gestureEntry(Role.ZoomIn),
    gestureEntry(Role.ZoomOut),
  );

  /*
   * Pas de ligne de défilement ici (plan 189, retour humain 2026-08-26). Elle y a existé une version :
   * regroupée sous la boussole, elle disait quelle touche presser sans dire de quoi elle parlait. Les
   * deux capuchons vivent maintenant aux **extrémités verticales de la liste d'ordre de jeu**
   * (`turn-timeline.ts`), où la direction du capuchon désigne le bord vers lequel il emmène.
   */
  /*
   * Panoramique caméra (plan 189, retour humain 2026-08-27).
   *
   * Une ligne d'une forme à part : **un** dessin, puis les **quatre** touches. Les autres contrôles
   * ont une entrée par direction parce que leur dessin change avec elle (une rotation à gauche n'est
   * pas celle de droite) ; ici la croix de déplacement dit déjà « les quatre sens », et la répéter
   * quatre fois n'ajouterait rien. Les capuchons suivent la disposition du pavé : haut, gauche,
   * droite, bas.
   *
   * À la manette, la même ligne bascule vers le stick droit (CSS `data-input-source`) : c'est le
   * geste, et il n'y a aucune touche à presser.
   */
  const panRow = el("div", "cl-row cl-row-pan", "control-legend-pan");
  panRow.append(glyph(Sheet.Cursors, "cl-glyph-pan", "legend-glyph-pan"));
  for (const [character, name] of [
    [keys.panUp, "up"],
    [keys.panLeft, "left"],
    [keys.panRight, "right"],
    [keys.panDown, "down"],
  ] as const) {
    panRow.append(
      applyCapTile(glyph(Sheet.Prompts, "cl-cap cl-pan-key", `legend-cap-pan-${name}`), character),
    );
  }
  panRow.append(glyph(Sheet.Prompts, "cl-glyph-pan-stick", "legend-glyph-pan-stick"));

  rows.append(rotateRow, zoomRow, panRow);
  /*
   * Les lignes portent leurs PROPRES feuilles et leur taille : montées hors de `.cl-root` (dans la
   * colonne de l'ordre de jeu), elles n'héritent plus des variables que la racine posait.
   */
  rows.classList.add("cl-rows-inline");
  rows.setAttribute("aria-hidden", "true");
  rows.style.setProperty("--cl-prompt-sheet", `url("${config.getInputPromptSheetUrl()}")`);
  rows.style.setProperty("--cl-cursor-sheet", `url("${config.getCursorSheetUrl()}")`);
  element.append(compassBox);
  return { element, rows };
}
