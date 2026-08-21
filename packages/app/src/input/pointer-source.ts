import type { Direction } from "@pokemon-tactic/core";
import type { CombatScene, TilePointerSource } from "@pokemon-tactic/render-ports";
import {
  PICK_DRAG_THRESHOLD_PX,
  PICK_DRAG_THRESHOLD_TOUCH_PX,
  PINCH_ZOOM_STEP_RATIO,
} from "@pokemon-tactic/view-core";
import { InputSource, type InputSourceTracker } from "./input-source.js";

/**
 * Mouse and touch gestures (plan 184, étape E — the debt the touch lot, plan 183, left behind).
 *
 * These rules used to live inside `combat-scene.ts`, which meant the renderer decided *game* things:
 * whether a press was a tap or a drag, whether a tap aimed or fired, whether two fingers meant zoom.
 * They now sit next to the keyboard and the gamepad, and the scene keeps only what needs the scene —
 * picking, projection, the camera, the picker's rendering (see `CombatScene`'s input primitives).
 *
 * Behaviour is deliberately unchanged: this was validated on a real phone the day before, so it is a
 * MOVE, not a rewrite. The two-step directional aim, the per-pointer-type drag threshold and the
 * pinch re-arming are all the same rules, in a new home.
 */

/** Pointer families treated differently, mirroring `PointerEvent.pointerType` (plan 183). */
const PointerKind = {
  Mouse: "mouse",
  Touch: "touch",
  Pen: "pen",
} as const;
type PointerKind = (typeof PointerKind)[keyof typeof PointerKind];

function pointerKindOf(event: PointerEvent): PointerKind {
  return event.pointerType === PointerKind.Touch || event.pointerType === PointerKind.Pen
    ? event.pointerType
    : PointerKind.Mouse;
}

/** A finger has no hover, so its press must stand in for one (plan 183). */
function tilePointerSourceOf(kind: PointerKind): TilePointerSource {
  return kind === PointerKind.Touch ? "touch" : "pointer";
}

export interface PointerSourceOptions {
  canvas: HTMLCanvasElement;
  /** The scene's input primitives: picking, cursor, picker geometry, camera. */
  scene: CombatScene;
  /** Active-source tracker, so prompt glyphs follow the device actually in use. */
  tracker: InputSourceTracker;
}

export interface PointerSource {
  dispose(): void;
}

/**
 * Bind the pointer gestures to the canvas. The app owns the canvas (`game-stage` creates it and
 * hands it to the renderer), so binding here needs nothing the renderer had that we don't.
 */
export function attachPointerSource(options: PointerSourceOptions): PointerSource {
  const { canvas, scene, tracker } = options;

  // Per-press state. `activePointers` tracks EVERY live pointer, which is what lets two fingers
  // pinch: a single scalar "dragging" flag could not tell one finger from two.
  let dragging = false;
  let pressMoved = false;
  let pressStartX = 0;
  let pressStartY = 0;
  let previousPointerX = 0;
  let previousPointerY = 0;
  // Threshold of the press in flight: a finger drifts more than a mouse, so the pointer type picks
  // it at press time rather than one global constant serving both.
  let pressDragThreshold = PICK_DRAG_THRESHOLD_PX;
  const activePointers = new Map<number, { x: number; y: number }>();
  // Pinch reference, re-armed on every zoom step AND whenever the pointer count changes. Letting it
  // survive a 2→1 finger transition is the classic cause of a sudden zoom jump.
  let pinchReferenceDistance: number | null = null;
  /**
   * Facing a finger has aimed at on the open picker. Touch has no hover, so a tap that CHANGES the
   * facing previews it and only a tap repeating it commits. Storing the direction rather than a
   * "has previewed" flag is the point: with a flag, changing your mind committed the new facing
   * immediately instead of showing it first (human, 2026-08-20).
   */
  let touchAimedDirection: Direction | null = null;

  /** Centroid + spread of the two live pointers, or null unless exactly two are down. */
  const pinchState = (): { centerX: number; centerY: number; distance: number } | null => {
    if (activePointers.size !== 2) {
      return null;
    }
    const [first, second] = [...activePointers.values()];
    if (!first || !second) {
      return null;
    }
    return {
      centerX: (first.x + second.x) / 2,
      centerY: (first.y + second.y) / 2,
      distance: Math.hypot(second.x - first.x, second.y - first.y),
    };
  };

  /** Pointer → canvas-relative coords, whichever overlay element the event bubbled from. */
  const canvasPointer = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const noteSource = (kind: PointerKind): void => {
    tracker.note(kind === PointerKind.Touch ? InputSource.Touch : InputSource.Pointer);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    noteSource(pointerKindOf(event));
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Keep receiving moves even if the finger slides off the canvas mid-drag. Only for a real
    // pointer: capturing an id the browser never issued (a synthetic tap from the e2e hook) throws
    // NotFoundError. Losing capture there is harmless — move/up are bound on `window` anyway.
    if (event.isTrusted) {
      canvas.setPointerCapture(event.pointerId);
    }
    if (activePointers.size >= 2) {
      // A second finger means a camera gesture, never a selection: drop both the press in flight and
      // any pending inspection so the gesture can't end up committing an action.
      dragging = false;
      const pinch = pinchState();
      pinchReferenceDistance = pinch?.distance ?? null;
      if (pinch) {
        // The pan now tracks the centroid, so seed it here — otherwise the first move would pan by
        // the whole distance between the last single-finger position and the centroid.
        previousPointerX = pinch.centerX;
        previousPointerY = pinch.centerY;
      }
      return;
    }
    dragging = true;
    pressMoved = false;
    pressStartX = event.clientX;
    pressStartY = event.clientY;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    pressDragThreshold =
      pointerKindOf(event) === PointerKind.Touch
        ? PICK_DRAG_THRESHOLD_TOUCH_PX
        : PICK_DRAG_THRESHOLD_PX;
  };

  const onPointerUp = (event: PointerEvent): void => {
    // `pointerdown` is bound to the canvas but `pointerup`/`pointermove` to the window, so a press
    // that started on the DOM chrome (Annuler, une attaque du menu) bubbles up here too. Acting on
    // it would pick a tile under a button — and with a finger still resting on the canvas,
    // `dragging` is true, so it would commit a board action the player never asked for.
    const wasOurs = activePointers.delete(event.pointerId);
    // Re-arm the pinch against whatever is still down: comparing a two-finger spread with a
    // one-finger position is what makes the zoom lurch when a finger lifts.
    pinchReferenceDistance = pinchState()?.distance ?? null;
    const wasClick = wasOurs && dragging && !pressMoved;
    dragging = false;
    if (!wasClick) {
      return;
    }
    const kind = pointerKindOf(event);
    const { x, y } = canvasPointer(event);
    // The compass sits on top of the board, so it has to win the press before the tile under it does
    // — otherwise the ray carries on and selects a tile the player never aimed at.
    if (scene.isCompassHitAt(x, y)) {
      scene.rotateCamera(1);
      return;
    }
    const pickerFacing = scene.directionPickerFacing();
    if (pickerFacing !== null) {
      const direction = scene.aimDirectionPickerAt(x, y) ?? pickerFacing;
      // No hover on touch, so a tap that CHANGES the facing must show it, not commit it. Only a tap
      // repeating the facing already on screen confirms.
      if (kind === PointerKind.Touch && touchAimedDirection !== direction) {
        touchAimedDirection = direction;
        scene.previewDirectionPickerFacing(direction);
        return;
      }
      touchAimedDirection = null;
      scene.confirmDirectionPickerFacing(direction);
      return;
    }
    const pick = scene.pickTileAt(x, y);
    if (!pick) {
      return;
    }
    // A tap does in one gesture what a mouse does in two — hover then click. Feeding the hover first
    // is what makes the info panels and the damage forecast appear at all on a finger.
    if (kind === PointerKind.Touch) {
      scene.setCursor(pick);
    }
    scene.dispatchTileClick(pick, tilePointerSourceOf(kind));
  };

  /** A pointer the OS took away (app switch, system gesture): forget it, and never let it act. */
  const onPointerCancel = (event: PointerEvent): void => {
    activePointers.delete(event.pointerId);
    pinchReferenceDistance = pinchState()?.distance ?? null;
    dragging = false;
    pressMoved = true;
  };

  const onPointerMove = (event: PointerEvent): void => {
    const tracked = activePointers.get(event.pointerId);
    if (tracked) {
      tracked.x = event.clientX;
      tracked.y = event.clientY;
    } else if (activePointers.size > 0) {
      // A pointer we never saw go down, while one of ours is held: the press belongs to the DOM
      // chrome (scrolling the battle log, say). Panning the camera from it would be wrong.
      return;
    }

    // Two fingers: pinch to step the zoom, and pan by the centroid so both happen in one gesture.
    const pinch = pinchState();
    if (pinch) {
      if (pinchReferenceDistance !== null && pinchReferenceDistance > 0) {
        const ratio = pinch.distance / pinchReferenceDistance;
        if (ratio >= PINCH_ZOOM_STEP_RATIO) {
          scene.zoomCamera(1);
          pinchReferenceDistance = pinch.distance;
        } else if (ratio <= 1 / PINCH_ZOOM_STEP_RATIO) {
          scene.zoomCamera(-1);
          pinchReferenceDistance = pinch.distance;
        }
      } else {
        pinchReferenceDistance = pinch.distance;
      }
      const deltaX = pinch.centerX - previousPointerX;
      const deltaY = pinch.centerY - previousPointerY;
      previousPointerX = pinch.centerX;
      previousPointerY = pinch.centerY;
      scene.panCameraByPixels(deltaX, deltaY);
      return;
    }

    if (!dragging) {
      // A finger produces no hover: it would flicker the cursor across every tile crossed before the
      // drag threshold trips. On touch the cursor is placed by the first tap instead (see onPointerUp).
      if (pointerKindOf(event) === PointerKind.Touch) {
        return;
      }
      // Only a REAL move counts as using the mouse: Chrome fires a zero-delta `pointermove` on
      // `pointerdown`, which would otherwise steal the active source back from the keyboard.
      tracker.notePointerMove(InputSource.Pointer, event.clientX, event.clientY);
      const { x, y } = canvasPointer(event);
      if (scene.directionPickerFacing() !== null) {
        // Picker open: the pointer position relative to the placed Pokémon picks the facing
        // (generous, whole-screen hit area); suppress the tile cursor.
        const direction = scene.aimDirectionPickerAt(x, y);
        if (direction !== null && direction !== scene.directionPickerFacing()) {
          scene.previewDirectionPickerFacing(direction);
        }
        return;
      }
      // Over the compass the cursor must not wander onto the tile behind it, exactly as the press
      // does not select it.
      scene.setCursor(scene.isCompassHitAt(x, y) ? null : scene.pickTileAt(x, y));
      return;
    }
    if (
      Math.abs(event.clientX - pressStartX) > pressDragThreshold ||
      Math.abs(event.clientY - pressStartY) > pressDragThreshold
    ) {
      pressMoved = true;
    }
    const deltaX = event.clientX - previousPointerX;
    const deltaY = event.clientY - previousPointerY;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    scene.panCameraByPixels(deltaX, deltaY);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointercancel", onPointerCancel);

  return {
    dispose: () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointercancel", onPointerCancel);
      activePointers.clear();
    },
  };
}
