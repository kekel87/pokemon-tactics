import type { InputRouter } from "../input/input-router";
import { LogicalAction } from "../input/logical-action";
import { playInterfaceSound } from "./audio-player";

/**
 * The sounds of the interface (plan 240): the cursor moving, a choice confirmed, a step back, a
 * window opening, an action refused. The source has three sounds; the confirmation and the step
 * back are the cursor's own, played higher and lower.
 *
 * Nothing here takes part in the navigation: the sounds are heard from three observers — the input
 * router every keyboard and gamepad action goes through, the clicks on buttons and links, and the
 * dialogs opening and closing — so no screen has to ask for them. Two things no observer can tell
 * are asked for where they happen: a refusal, and a selection that moves without the focus moving
 * (a letter of the room code, the Pokémon being placed).
 *
 * One press, one sound. What a press did is only known once its task is over — a confirmation may
 * open a window, a step back may close one — so each observer proposes a sound and the one that
 * says the most is played when the task ends.
 */

const CURSOR_SOUND = "ui:move";
const OPEN_SOUND = "ui:open";
const REFUSAL_SOUND = "ui:error";
/** Every sound of the interface: a few kB in all, loaded behind the splash bar. */
export const INTERFACE_SOUNDS: readonly string[] = [CURSOR_SOUND, OPEN_SOUND, REFUSAL_SOUND];
/** The cursor is the most frequent sound: the quietest. */
const CURSOR_VOLUME = 0.6;

/** What a press may sound like, from what says the least to what says the most. */
const PressSound = {
  Back: 1,
  Confirmation: 2,
  Opening: 3,
  Refusal: 4,
} as const;
type PressSound = (typeof PressSound)[keyof typeof PressSound];

const PRESS_SOUNDS: Readonly<
  Record<PressSound, { soundId: string; rate?: number; volume?: number }>
> = {
  // A step back is the cursor played lower; a confirmation, about three semitones higher — told
  // from a move on a phone speaker too.
  [PressSound.Back]: { soundId: CURSOR_SOUND, rate: 0.84, volume: 0.8 },
  [PressSound.Confirmation]: { soundId: CURSOR_SOUND, rate: 1.19 },
  [PressSound.Opening]: { soundId: OPEN_SOUND },
  [PressSound.Refusal]: { soundId: REFUSAL_SOUND },
};

/** The sound of the press being handled, played when its task ends. */
let pressSound: PressSound | null = null;

function propose(sound: PressSound): void {
  if (pressSound === null) {
    setTimeout(() => {
      const played = pressSound;
      pressSound = null;
      if (played !== null) {
        const { soundId, ...options } = PRESS_SOUNDS[played];
        playInterfaceSound(soundId, options);
      }
    }, 0);
  }
  if (pressSound === null || sound > pressSound) {
    pressSound = sound;
  }
}

/** The cursor went to another control, or a selection to another entry. */
export function playCursorSound(): void {
  playInterfaceSound(CURSOR_SOUND, { volume: CURSOR_VOLUME });
}

/** An action the game refuses: said where the refusal is pronounced. */
export function playRefusalSound(): void {
  propose(PressSound.Refusal);
}

const DIRECTIONS: ReadonlySet<LogicalAction> = new Set([
  LogicalAction.CursorUp,
  LogicalAction.CursorDown,
  LogicalAction.CursorLeft,
  LogicalAction.CursorRight,
]);

/**
 * Hear the keyboard and the gamepad through the router every action goes through: a direction that
 * really moved the focus, a confirmation, a step back. A direction against an edge, or on the
 * board, moves no focus and stays silent.
 */
export function withInterfaceSounds(router: InputRouter): InputRouter {
  return {
    handle: (action) => {
      if (DIRECTIONS.has(action)) {
        const focusedBefore = document.activeElement;
        const consumed = router.handle(action);
        if (consumed && document.activeElement !== focusedBefore) {
          playCursorSound();
        }
        return consumed;
      }
      const consumed = router.handle(action);
      if (consumed && action === LogicalAction.Confirm) {
        propose(PressSound.Confirmation);
      } else if (consumed && action === LogicalAction.Cancel) {
        propose(PressSound.Back);
      }
      return consumed;
    },
  };
}

/** Hear the clicks on controls and the dialogs. Once, at boot. */
export function installInterfaceSounds(): void {
  // Mouse, finger, a native Enter and the gamepad's synthetic click all end here. Capture phase,
  // and nothing but listening: the click goes on to its control untouched.
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("button:not(:disabled), a[href]") !== null) {
        propose(PressSound.Confirmation);
      }
    },
    true,
  );
  // Every dialog of the game — the modals, the combat menu, the victory screen — in one place:
  // `showModal()` sets the `open` attribute, `close()` removes it. A dialog closed by a choice
  // keeps the confirmation its click proposed; closed with nothing chosen, it is a step back.
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.target instanceof HTMLDialogElement) {
        propose(record.target.open ? PressSound.Opening : PressSound.Back);
      }
    }
  }).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });
}
