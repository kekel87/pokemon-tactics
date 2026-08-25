import type { InputContext } from "@pokemon-tactic/view-core";
import { CURSOR_ACTION_DIRECTION, LogicalAction } from "./logical-action.js";

/**
 * Pixels de pan par frame quand le stick droit est à fond. ~8 px à 60 fps = ~480 px/s : assez pour
 * traverser une carte sans que le geste paraisse brusque.
 *
 * ⚠️ **Négatif**, et c'est le point (retour humain 2026-08-21) : `panCamera` parle le langage d'un
 * GLISSÉ de souris (on tire le plateau, il suit le doigt), alors qu'un stick parle celui d'un regard
 * (je pousse à droite, je regarde à droite) — les deux sont opposés. Une inversion configurable est
 * prévue au plan de remapping ; ce défaut-là est le sens naturel du stick.
 */
const GAMEPAD_PAN_STEP_PX = -8;

/** Where the arrows point on screen — never a grid direction (the camera rotates). */
export type ScreenDirection = "up" | "down" | "left" | "right";

/**
 * The board and its camera. Implemented by the combat screen over the scene during battle, and by
 * the placement flow while placing — never both at once, which is what keeps "one consumer per
 * (context, action)" true.
 */
export interface BoardInputConsumer {
  moveCursor(direction: ScreenDirection): void;
  /**
   * Validate the tile under the cursor (the keyboard/gamepad equivalent of a click). Returns false
   * when there is no cursor yet, so the key is not swallowed for nothing.
   */
  confirmCursorTile(): boolean;
  /** Returns whether anything was actually cancelled. */
  cancel(): boolean;
  /** Returns whether it consumed the input, so the producer knows to swallow the key. */
  cycleTarget(delta: 1 | -1): boolean;
  rotateCamera(step: 1 | -1): void;
  /** Pan continu, en pixels de canvas (stick droit). */
  panCamera(deltaX: number, deltaY: number): void;
  zoomCamera(step: 1 | -1): void;
  setZoomLevel(index: number): void;
  scrollLog(delta: 1 | -1): void;
  /** Ouvrir / refermer le journal de combat (plan 186). */
  toggleLog(): void;
  scrollTimeline(delta: 1 | -1): void;
  /**
   * Ouvrir le menu de combat (plan 187). Renvoie false quand l'ouverture est refusée — menu déjà
   * ouvert, ou dialogue de victoire à l'écran, qui porte déjà ses propres sorties.
   *
   * Vit sur le consommateur PLATEAU parce que c'est exactement là qu'il doit vivre : les deux
   * registrations en combat (bataille et placement) en fournissent un, aucun écran de menu n'en
   * fournit — la route est donc exacte par construction, sans test de contexte à écrire.
   */
  openCombatMenu(): boolean;
}

/** A DOM menu whose buttons take the focus: the combat action menu, or a menu screen. */
export interface MenuInputConsumer {
  /**
   * Move the focus toward a SCREEN direction. All four are handed over — a menu screen is a
   * two-dimensional layout, and stepping through DOM order made ← and → dead keys while ↓ hopped
   * diagonally between columns (retour humain 2026-08-21). A single-column menu ignores ← →.
   */
  focusMove(direction: ScreenDirection): void;
  /**
   * Fallback when no button of the menu holds the focus. Returns FALSE when the browser should
   * handle the press instead — a focused `<button>` already activates on Space/Enter, and swallowing
   * the key here would mean either a double activation or none at all.
   */
  confirm(): boolean;
  cancel(): boolean;
}

export interface InputRouterOptions {
  /**
   * The active context. `"screen"` covers everything outside a battle (menu screens), where only
   * focus navigation and Cancel/back make sense.
   */
  context: () => InputContext | "screen";
  board: () => BoardInputConsumer | null;
  menu: () => MenuInputConsumer | null;
}

export interface InputRouter {
  /** Returns true when a consumer acted on the action (so the producer can swallow the key). */
  handle(action: LogicalAction): boolean;
}

/**
 * Routes one logical action to exactly ONE consumer, decided by the current context (plan 184).
 *
 * This is the central arbitration the five scattered `keydown` listeners never had. The invariant —
 * an action reaches at most one consumer — is what replaces `combat-scene.ts`'s
 * `stopImmediatePropagation()`, and it is covered by a test: a future "re-place mid-battle" mode
 * would otherwise silently reintroduce the ambiguity that call used to paper over.
 */
export function createInputRouter(options: InputRouterOptions): InputRouter {
  const { context, board, menu } = options;

  /**
   * Camera, zoom and panel scrolling are context-independent: looking around while the action menu
   * is open is legitimate (the mouse wheel already does it today). Only `locked` blocks them.
   */
  const handleViewAction = (action: LogicalAction, target: BoardInputConsumer): boolean => {
    switch (action) {
      case LogicalAction.RotateCameraLeft:
        target.rotateCamera(-1);
        return true;
      case LogicalAction.RotateCameraRight:
        target.rotateCamera(1);
        return true;
      case LogicalAction.ZoomIn:
        target.zoomCamera(1);
        return true;
      case LogicalAction.ZoomOut:
        target.zoomCamera(-1);
        return true;
      case LogicalAction.ZoomLevel1:
        target.setZoomLevel(0);
        return true;
      case LogicalAction.ZoomLevel2:
        target.setZoomLevel(1);
        return true;
      case LogicalAction.ZoomLevel3:
        target.setZoomLevel(2);
        return true;
      case LogicalAction.ToggleBattleLog:
        target.toggleLog();
        return true;
      // Traité ici, donc soumis au même verrou que le reste : pendant `locked` (animation en cours)
      // le menu ne s'ouvre pas (plan 187 décision 14). Les verrous durent moins d'une seconde, et une
      // exception rouvrirait la question « que se passe-t-il si le joueur quitte au milieu d'une
      // animation » pour un gain nul.
      case LogicalAction.OpenCombatMenu:
        return target.openCombatMenu();
      case LogicalAction.ScrollLogUp:
        target.scrollLog(-1);
        return true;
      case LogicalAction.ScrollLogDown:
        target.scrollLog(1);
        return true;
      case LogicalAction.ScrollTimelineUp:
        target.scrollTimeline(-1);
        return true;
      case LogicalAction.ScrollTimelineDown:
        target.scrollTimeline(1);
        return true;
      case LogicalAction.PanCameraUp:
        target.panCamera(0, -GAMEPAD_PAN_STEP_PX);
        return true;
      case LogicalAction.PanCameraDown:
        target.panCamera(0, GAMEPAD_PAN_STEP_PX);
        return true;
      case LogicalAction.PanCameraLeft:
        target.panCamera(-GAMEPAD_PAN_STEP_PX, 0);
        return true;
      case LogicalAction.PanCameraRight:
        target.panCamera(GAMEPAD_PAN_STEP_PX, 0);
        return true;
      default:
        return false;
    }
  };

  return {
    handle(action) {
      const activeContext = context();
      if (activeContext === "locked") {
        return false;
      }

      const boardConsumer = board();
      if (boardConsumer && handleViewAction(action, boardConsumer)) {
        return true;
      }

      const direction = CURSOR_ACTION_DIRECTION[action as keyof typeof CURSOR_ACTION_DIRECTION];
      if (direction !== undefined) {
        if (activeContext === "board") {
          if (!boardConsumer) {
            return false;
          }
          boardConsumer.moveCursor(direction);
          return true;
        }
        const menuConsumer = menu();
        if (!menuConsumer) {
          return false;
        }
        menuConsumer.focusMove(direction);
        return true;
      }

      switch (action) {
        case LogicalAction.Confirm:
          if (activeContext === "board") {
            return boardConsumer?.confirmCursorTile() ?? false;
          }
          return menu()?.confirm() ?? false;
        case LogicalAction.Cancel:
          if (activeContext === "board") {
            return boardConsumer?.cancel() ?? false;
          }
          return menu()?.cancel() ?? false;
        case LogicalAction.CycleTargetNext:
          return activeContext === "board" && (boardConsumer?.cycleTarget(1) ?? false);
        case LogicalAction.CycleTargetPrevious:
          return activeContext === "board" && (boardConsumer?.cycleTarget(-1) ?? false);
        default:
          return false;
      }
    },
  };
}
