import { getSettings } from "../settings/index.js";
import { getBindings } from "./bindings-store.js";
import { LogicalAction } from "./logical-action.js";

/**
 * Gamepad support (plan 184, étape D).
 *
 * Four things about the Gamepad API shape this module, and none of them are optional:
 *
 * 1. **There are no button events** — only `gamepadconnected`/`disconnected`. State has to be polled
 *    and edges (pressed now, not pressed before) computed by hand, or one press would fire an action
 *    per frame.
 * 2. 🔴 **Chrome mutates the `Gamepad` / `GamepadButton` objects in place** on every frame. Keeping a
 *    reference to last frame's object and comparing `pressed` compares it with itself: edge detection
 *    silently never fires. Only primitive values may be kept — which is what `GamepadPollState.pressed`
 *    holds: a set of button INDICES, never a browser object.
 * 3. **`navigator.getGamepads()` stays empty until the first gamepad gesture** on a focused page (a
 *    W3C anti-fingerprinting requirement), so "a gamepad is connected" cannot be shown before the
 *    player presses something. That suits *last-input-wins* exactly: the source becomes `gamepad` on
 *    the first press, never before.
 * 4. **`mapping === "standard"`** annonce que les indices de boutons veulent bien dire ce qu'on croit.
 *    ⚠️ Firefox renvoie une chaîne VIDE pour toute manette absente de sa table interne, **y compris
 *    une manette physiquement standard** (Bugzilla #952773, #1542893). Le plan 184 refusait alors de
 *    router le pad — ce qui le rendait totalement muet sous Firefox (constaté sur Switch Pro,
 *    2026-08-25 : aucun focus dans les menus, jamais). On route donc TOUJOURS avec les indices
 *    standard : c'est la disposition de fait de toutes les manettes modernes, le trou est dans la
 *    table du navigateur, pas dans le matériel — et depuis le plan 186 une supposition fausse se
 *    corrige dans l'écran de contrôles au lieu d'être fatale.
 */

/** Standard-mapping button indices (W3C). */
const Button = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LeftBumper: 4,
  RightBumper: 5,
  LeftTrigger: 6,
  RightTrigger: 7,
  LeftStick: 10,
  RightStick: 11,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
} as const;

/**
 * Manette de constructeur Nintendo ? (retour humain 2026-08-21, manette Switch Pro)
 *
 * Le *standard mapping* du W3C indexe les boutons par POSITION : index 0 = bouton du bas, index 1 =
 * bouton de droite. Sur une manette Nintendo, le bas porte **B** et la droite **A** — l'inverse de la
 * disposition Xbox sur laquelle la convention « 0 = confirmer » a été bâtie. Le joueur appuie donc sur
 * A et obtient Annuler.
 *
 * On échange les deux paires (0↔1 et 2↔3) quand l'identifiant annonce Nintendo : identifiant plutôt
 * que réglage, parce que ce n'est pas une préférence mais un fait matériel. `057e` est l'identifiant
 * de fabricant Nintendo, présent dans l'`id` exposé par Chrome comme par Firefox.
 */
export function isNintendoLayout(id: string | undefined): boolean {
  if (id === undefined) {
    return false;
  }
  return /057e|nintendo|switch pro|joy-?con|pro controller/i.test(id);
}

/** Paires de boutons échangées sur une disposition Nintendo (bas↔droite, gauche↔haut). */
const NINTENDO_SWAPPED_BUTTONS: Readonly<Record<number, number>> = {
  0: 1,
  1: 0,
  2: 3,
  3: 2,
};

/**
 * Quels boutons déclenchent quoi : plus une constante depuis le plan 186, mais une table dérivée du
 * magasin de bindings, que l'écran de contrôles réécrit. Les défauts sont inchangés (A confirme, B
 * annule, X cycle, gâchettes et bumpers pour la caméra) — ils ont juste déménagé.
 *
 * Le d-pad, le stick droit et le maintien de Y ne sont PAS là-dedans : ce sont des axes et un
 * modificateur, pas des boutons, donc structurels et non remappables (plan 186, décision 9).
 */

/** D-pad → curseur, sauf si le modificateur de défilement est maintenu (`SCROLL_BY_CURSOR_ACTION`). */
const DPAD_ACTIONS: Readonly<Record<number, LogicalAction>> = {
  [Button.DpadUp]: LogicalAction.CursorUp,
  [Button.DpadDown]: LogicalAction.CursorDown,
  [Button.DpadLeft]: LogicalAction.CursorLeft,
  [Button.DpadRight]: LogicalAction.CursorRight,
};

const DPAD_INDEXES = [Button.DpadUp, Button.DpadDown, Button.DpadLeft, Button.DpadRight] as const;

/**
 * MODIFICATEUR MAINTENU + direction = défilement des panneaux (décision humaine 2026-08-20) : haut/bas
 * fait défiler le journal de combat, gauche/droite la barre d'ordre de jeu. Un maintien plutôt qu'une
 * bascule — aucun mode dans lequel rester coincé.
 *
 * Le modificateur était **Y** ; il passe sur **R3** (clic du stick droit) au plan 186, pour deux
 * raisons : Y devient « Cible précédente » (décision humaine 2026-08-25), et surtout ce geste n'était
 * **annoncé nulle part** — l'écran de contrôles l'affiche désormais. R3 se presse du pouce DROIT
 * pendant que le pouce gauche pousse la croix ou le stick gauche : le geste reste à deux mains, ce
 * qu'un modificateur du côté gauche aurait cassé.
 */
/** Bouton dont le MAINTIEN transforme une direction en défilement (voir plus haut). */
export const SCROLL_MODIFIER_BUTTON = Button.RightStick;

const SCROLL_BY_CURSOR_ACTION: Readonly<Record<string, LogicalAction>> = {
  [LogicalAction.CursorUp]: LogicalAction.ScrollLogUp,
  [LogicalAction.CursorDown]: LogicalAction.ScrollLogDown,
  [LogicalAction.CursorLeft]: LogicalAction.ScrollTimelineUp,
  [LogicalAction.CursorRight]: LogicalAction.ScrollTimelineDown,
};

/**
 * Circular deadzone — `hypot`, not per-axis. Per-axis clamping lets a diagonal push cross two
 * thresholds and walk the cursor in a staircase.
 */
const STICK_DEADZONE = 0.5;
/** A pressed analog trigger; the same threshold reads the d-pad when it reports as an axis. */
const BUTTON_PRESS_THRESHOLD = 0.5;

/** Analog-stick direction, as one of the four cursor actions, or null inside the deadzone. */
export function stickAction(axisX: number, axisY: number): LogicalAction | null {
  if (Math.hypot(axisX, axisY) < STICK_DEADZONE) {
    return null;
  }
  // The dominant axis wins: a stick is never perfectly cardinal, and the cursor moves one tile at a
  // time — there is no diagonal step to give it.
  if (Math.abs(axisX) > Math.abs(axisY)) {
    return axisX > 0 ? LogicalAction.CursorRight : LogicalAction.CursorLeft;
  }
  return axisY > 0 ? LogicalAction.CursorDown : LogicalAction.CursorUp;
}

/** Minimal shape this module reads off a `Gamepad` — the whole API surface it depends on. */
export interface GamepadSnapshot {
  readonly mapping: string;
  /** Identification string (`Gamepad.id`) — porte le constructeur, cf. `isNintendoLayout`. */
  readonly id?: string;
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
  readonly axes: readonly number[];
}

export interface GamepadPollState {
  /**
   * Buttons held on the previous frame, as PRIMITIVES (see gotcha 2). A `Set` of indices, never a
   * reference to the browser's own objects.
   */
  pressed: Set<number>;
  /** Frames until the held direction repeats again (initial delay, then a faster cadence). */
  repeatFramesLeft: number;
  /** Direction currently held, so releasing it resets the repeat. */
  repeatAction: LogicalAction | null;
}

export function createGamepadPollState(): GamepadPollState {
  return { pressed: new Set(), repeatFramesLeft: 0, repeatAction: null };
}

/**
 * Frames a held direction waits before it starts repeating, then between repeats. At 60fps: ~380ms
 * then ~90ms — long enough that a single tap never doubles, short enough to cross a board.
 */
const REPEAT_DELAY_FRAMES = 23;
/** Frames sans aucune manette avant d'éteindre la boucle (~3s à 60fps) — voir `poll`. */
const IDLE_GRACE_FRAMES = 180;
const REPEAT_INTERVAL_FRAMES = 6;

function isPressed(button: { pressed: boolean; value: number } | undefined): boolean {
  if (!button) {
    return false;
  }
  return button.pressed || button.value >= BUTTON_PRESS_THRESHOLD;
}

/**
 * Actions produced by one poll of one gamepad, mutating `state` in place.
 *
 * Pure apart from that mutation, so the whole edge/repeat/deadzone behaviour is unit-testable
 * without a browser — which matters here, because Playwright cannot drive `navigator.getGamepads()`
 * at all: this function IS the test surface for the gamepad.
 */
export interface PollOptions {
  /** Table dérivée du magasin de bindings ; le défaut est celle de l'app. */
  readonly buttonActions?: ReadonlyMap<number, LogicalAction>;
  /** Inverser le panoramique du stick droit ; défaut = la préférence du joueur (plan 186). */
  readonly invertPan?: boolean;
}

export function pollGamepad(
  pad: GamepadSnapshot,
  state: GamepadPollState,
  options: PollOptions = {},
): LogicalAction[] {
  const buttonActions = options.buttonActions ?? getBindings().gamepadLookup();

  const actions: LogicalAction[] = [];
  const nintendo = isNintendoLayout(pad.id);
  /** Index logique d'un bouton physique : identité, sauf disposition Nintendo (voir plus haut). */
  const logicalIndex = (index: number): number =>
    nintendo ? (NINTENDO_SWAPPED_BUTTONS[index] ?? index) : index;
  const heldModifier = isPressed(pad.buttons[logicalIndex(SCROLL_MODIFIER_BUTTON)]);
  const held = new Set<number>();

  // Plain buttons: one action per PRESS, from the edge against last frame's primitives.
  for (let index = 0; index < pad.buttons.length; index++) {
    if (!isPressed(pad.buttons[index])) {
      continue;
    }
    held.add(index);
    const action = buttonActions.get(logicalIndex(index));
    if (action !== undefined && !state.pressed.has(index)) {
      actions.push(action);
    }
  }
  state.pressed = held;

  // Stick DROIT : pan continu. Émis à chaque frame tant qu'il est poussé, sans front ni répétition —
  // un pan est analogique, l'accumulation frame par frame EST le geste.
  const invert = options.invertPan ?? getSettings().invertRightStick;
  const panX = (pad.axes[2] ?? 0) * (invert ? -1 : 1);
  const panY = (pad.axes[3] ?? 0) * (invert ? -1 : 1);
  if (Math.hypot(panX, panY) >= STICK_DEADZONE) {
    if (Math.abs(panX) >= STICK_DEADZONE) {
      actions.push(panX > 0 ? LogicalAction.PanCameraRight : LogicalAction.PanCameraLeft);
    }
    if (Math.abs(panY) >= STICK_DEADZONE) {
      actions.push(panY > 0 ? LogicalAction.PanCameraDown : LogicalAction.PanCameraUp);
    }
  }

  // Directions repeat while held (d-pad and stick alike), so crossing a board doesn't take one
  // press per tile. The d-pad wins over the stick when both are pushed.
  const dpadIndex = DPAD_INDEXES.find((index) => isPressed(pad.buttons[index]));
  const direction =
    dpadIndex === undefined
      ? stickAction(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      : (DPAD_ACTIONS[dpadIndex] ?? null);
  const resolved =
    direction !== null && heldModifier
      ? (SCROLL_BY_CURSOR_ACTION[direction] ?? direction)
      : direction;

  if (resolved === null) {
    state.repeatAction = null;
    state.repeatFramesLeft = 0;
    return actions;
  }
  if (state.repeatAction !== resolved) {
    // First frame of a new direction: act now, then wait out the initial delay.
    actions.push(resolved);
    state.repeatAction = resolved;
    state.repeatFramesLeft = REPEAT_DELAY_FRAMES;
  } else if (state.repeatFramesLeft <= 0) {
    actions.push(resolved);
    state.repeatFramesLeft = REPEAT_INTERVAL_FRAMES;
  } else {
    state.repeatFramesLeft -= 1;
  }
  return actions;
}

/**
 * Boutons nouvellement pressés à cette frame, en index LOGIQUES — la lecture brute d'une capture
 * (plan 186, étape C).
 *
 * Ni bindings ni `mapping` ici : c'est justement le mode où un pad que Firefox n'a pas reconnu doit
 * pouvoir être configuré (gotcha 4). L'échange Nintendo, lui, s'applique — le magasin range ses
 * bindings en index logiques, donc le bouton du bas d'une manette Nintendo doit s'y enregistrer
 * comme le bouton du bas d'une manette standard, pas comme son voisin.
 */
export function pollGamepadButtons(pad: GamepadSnapshot, state: GamepadPollState): number[] {
  const nintendo = isNintendoLayout(pad.id);
  const pressed: number[] = [];
  const held = new Set<number>();
  for (let index = 0; index < pad.buttons.length; index++) {
    if (!isPressed(pad.buttons[index])) {
      continue;
    }
    held.add(index);
    if (!state.pressed.has(index)) {
      pressed.push(nintendo ? (NINTENDO_SWAPPED_BUTTONS[index] ?? index) : index);
    }
  }
  state.pressed = held;
  // Une direction maintenue pendant la capture ne doit pas se remettre à répéter en sortant.
  state.repeatAction = null;
  state.repeatFramesLeft = 0;
  return pressed;
}

export interface GamepadPoller {
  dispose(): void;
}

/**
 * Poll every connected gamepad on each animation frame and emit the resulting actions.
 *
 * The loop only runs while at least one pad is connected: no permanent `requestAnimationFrame` on
 * top of Babylon's own render loop when nobody is playing on a pad.
 */
export function startGamepadPolling(
  emit: (action: LogicalAction) => void,
  /** Renvoie le récepteur de capture quand une capture est en cours, sinon `null` (plan 186). */
  captureSink: () => ((index: number) => void) | null = () => null,
): GamepadPoller {
  const states = new Map<number, GamepadPollState>();
  let frame: number | null = null;
  let idleFrames = 0;

  const poll = (): void => {
    const pads = navigator.getGamepads?.() ?? [];
    let connected = 0;
    for (const pad of pads) {
      if (!pad) {
        continue;
      }
      connected += 1;
      let state = states.get(pad.index);
      if (!state) {
        state = createGamepadPollState();
        states.set(pad.index, state);
      }
      const capture = captureSink();
      if (capture) {
        // Capture en cours : on lit les boutons bruts et on ne route RIEN, sinon configurer une
        // touche jouerait le coup qu'elle déclenche aujourd'hui.
        for (const index of pollGamepadButtons(pad, state)) {
          capture(index);
        }
        continue;
      }
      for (const action of pollGamepad(pad, state)) {
        emit(action);
      }
    }
    if (connected === 0) {
      // 🔴 Ne PAS s'arrêter à la première frame vide (retour humain 2026-08-25 : « j'ai du mal à
      // faire reconnaître la manette dans les menus sans rafraîchir »).
      //
      // `gamepadconnected` peut arriver avant que `getGamepads()` ne publie le pad. La boucle voyait
      // alors zéro manette, se coupait — et comme l'événement de connexion ne repasse jamais pour ce
      // pad, plus rien ne la relançait : la manette restait morte jusqu'au rechargement. D'où un
      // délai de grâce : on garde l'œil ouvert quelques secondes avant de rendre la main.
      idleFrames += 1;
      if (idleFrames > IDLE_GRACE_FRAMES) {
        frame = null;
        idleFrames = 0;
        states.clear();
        return;
      }
    } else {
      idleFrames = 0;
    }
    frame = requestAnimationFrame(poll);
  };

  const start = (): void => {
    idleFrames = 0;
    if (frame === null) {
      frame = requestAnimationFrame(poll);
    }
  };

  /**
   * Rattrapage : un pad DÉJÀ publié par le navigateur alors qu'on n'a pas vu son événement de
   * connexion. C'est le cas au rechargement (le navigateur se souvient du geste pour cette origine
   * et republie le pad aussitôt) et celui d'un `gamepadconnected` émis pendant que l'onglet n'avait
   * pas le focus.
   */
  const startIfPadPresent = (): void => {
    const pads = navigator.getGamepads?.() ?? [];
    if ([...pads].some((pad) => pad !== null)) {
      start();
    }
  };

  // `getGamepads()` is empty until the first gesture (gotcha 3), so the connect event is what tells
  // us to start looking at all — quand il nous parvient.
  window.addEventListener("gamepadconnected", start);
  window.addEventListener("focus", startIfPadPresent);
  startIfPadPresent();

  return {
    dispose: () => {
      window.removeEventListener("gamepadconnected", start);
      window.removeEventListener("focus", startIfPadPresent);
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      states.clear();
    },
  };
}
