/**
 * Logical input actions (plan 184, Lot 2 du plan-cadre 173).
 *
 * Every input device — keyboard, gamepad, pointer, finger — produces one of these, and the
 * consumers (board cursor, camera, DOM menu focus, orchestrator) listen to them instead of raw
 * events. That indirection is what makes a device swap cheap: adding the gamepad meant adding a
 * producer, not touching a single consumer.
 *
 * Before this layer, five `window.addEventListener("keydown")` scattered across four files each
 * tested `event.key` and guessed whether they were concerned — to the point that one of them had
 * to call `stopImmediatePropagation()` so a single Escape wouldn't both cancel an aim AND undo a
 * placement.
 */
export const LogicalAction = {
  /** Screen-relative, never grid-relative: "up" is the top of the screen whatever the azimuth. */
  CursorUp: "cursor-up",
  CursorDown: "cursor-down",
  CursorLeft: "cursor-left",
  CursorRight: "cursor-right",
  Confirm: "confirm",
  Cancel: "cancel",
  /** Cycle the combat preview across the targets of an area footprint (plan 175). */
  CycleTargetNext: "cycle-target-next",
  CycleTargetPrevious: "cycle-target-previous",
  /** One quarter turn — the iso camera has exactly 4 azimuths (décision #476). */
  RotateCameraLeft: "rotate-camera-left",
  RotateCameraRight: "rotate-camera-right",
  /**
   * Pan caméra, émis à CHAQUE frame tant que le stick est poussé (pas de détection de front, pas de
   * délai de répétition) : un pan est analogique par nature, c'est la seule action continue du jeu.
   */
  PanCameraUp: "pan-camera-up",
  PanCameraDown: "pan-camera-down",
  PanCameraLeft: "pan-camera-left",
  PanCameraRight: "pan-camera-right",
  /** Relative zoom, one notch of `ZOOM_LEVELS`. */
  ZoomIn: "zoom-in",
  ZoomOut: "zoom-out",
  /** Absolute zoom: `ZOOM_LEVELS` only holds 3 notches, so each gets its own key. */
  ZoomLevel1: "zoom-level-1",
  ZoomLevel2: "zoom-level-2",
  ZoomLevel3: "zoom-level-3",
  /**
   * The battle log and the CT timeline scroll by wheel and drag only; neither is focusable, so
   * without a dedicated binding a keyboard player never sees past the ~11 first predicted turns
   * (décision humaine 2026-08-20: dedicated bindings rather than making both regions focusable).
   */
  ScrollLogUp: "scroll-log-up",
  ScrollLogDown: "scroll-log-down",
  ScrollTimelineUp: "scroll-timeline-up",
  ScrollTimelineDown: "scroll-timeline-down",
  /**
   * Ouvrir / refermer le journal (plan 186, retour humain 2026-08-25). Le panneau a toujours eu son
   * repli, mais seulement au clic sur son en-tête : au clavier il était inatteignable, et rien
   * n'indiquait qu'il s'ouvrait.
   */
  ToggleBattleLog: "toggle-battle-log",
} as const;

export type LogicalAction = (typeof LogicalAction)[keyof typeof LogicalAction];

/** The four cursor actions, mapped to the screen direction they mean. */
export const CURSOR_ACTION_DIRECTION = {
  [LogicalAction.CursorUp]: "up",
  [LogicalAction.CursorDown]: "down",
  [LogicalAction.CursorLeft]: "left",
  [LogicalAction.CursorRight]: "right",
} as const satisfies Partial<Record<LogicalAction, "up" | "down" | "left" | "right">>;
