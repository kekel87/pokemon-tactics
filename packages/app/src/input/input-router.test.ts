import type { InputContext } from "@pokemon-tactic/view-core";
import { describe, expect, it, vi } from "vitest";
import {
  type BoardInputConsumer,
  createInputRouter,
  type InspectInputConsumer,
  type MenuInputConsumer,
} from "./input-router.js";
import { LogicalAction } from "./logical-action.js";

function makeBoard(): BoardInputConsumer & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    moveCursor: (direction) => calls.push(`moveCursor:${direction}`),
    confirmCursorTile: () => {
      calls.push("confirmCursorTile");
      return true;
    },
    cancel: () => {
      calls.push("cancel");
      return true;
    },
    cycleTarget: (delta) => {
      calls.push(`cycleTarget:${delta}`);
      return true;
    },
    rotateCamera: (step) => calls.push(`rotateCamera:${step}`),
    panCamera: (deltaX, deltaY) => calls.push(`panCamera:${deltaX},${deltaY}`),
    zoomCamera: (step) => calls.push(`zoomCamera:${step}`),
    setZoomLevel: (index) => calls.push(`setZoomLevel:${index}`),
    scrollLog: (delta) => calls.push(`scrollLog:${delta}`),
    toggleLog: () => calls.push("toggleLog"),
    scrollTimeline: (delta) => calls.push(`scrollTimeline:${delta}`),
    openCombatMenu: () => {
      calls.push("openCombatMenu");
      return true;
    },
  };
}

function makeMenu(): MenuInputConsumer & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    focusMove: (direction) => calls.push(`focusMove:${direction}`),
    confirm: () => {
      calls.push("confirm");
      return true;
    },
    cancel: () => {
      calls.push("cancel");
      return true;
    },
  };
}

function makeInspect(active: boolean): InspectInputConsumer & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    toggle: () => {
      calls.push("toggle");
      return true;
    },
    isActive: () => active,
    step: (delta) => calls.push(`step:${delta}`),
    stop: () => calls.push("stop"),
  };
}

function setupInspect(context: InputContext, inspector: InspectInputConsumer) {
  const board = makeBoard();
  const menu = makeMenu();
  const router = createInputRouter({
    context: () => context,
    board: () => board,
    menu: () => menu,
    inspect: () => inspector,
  });
  return { router, board, menu };
}

function setup(context: InputContext | "screen") {
  const board = makeBoard();
  const menu = makeMenu();
  const router = createInputRouter({
    context: () => context,
    board: () => board,
    menu: () => menu,
  });
  return { router, board, menu };
}

describe("createInputRouter", () => {
  it("drives the board cursor with the arrows in board context", () => {
    const { router, board, menu } = setup("board");

    expect(router.handle(LogicalAction.CursorUp)).toBe(true);
    expect(router.handle(LogicalAction.CursorLeft)).toBe(true);

    expect(board.calls).toEqual(["moveCursor:up", "moveCursor:left"]);
    expect(menu.calls).toEqual([]);
  });

  it("drives the menu focus with the arrows in menu context", () => {
    const { router, board, menu } = setup("menu");

    router.handle(LogicalAction.CursorDown);
    router.handle(LogicalAction.CursorUp);

    expect(menu.calls).toEqual(["focusMove:down", "focusMove:up"]);
    expect(board.calls).toEqual([]);
  });

  it("hands ALL FOUR directions to the menu (a screen is a 2D layout)", () => {
    const { router, menu } = setup("menu");

    expect(router.handle(LogicalAction.CursorLeft)).toBe(true);
    expect(router.handle(LogicalAction.CursorRight)).toBe(true);

    expect(menu.calls).toEqual(["focusMove:left", "focusMove:right"]);
  });

  it("sends Confirm to the tile under the cursor on the board, to the menu otherwise", () => {
    const onBoard = setup("board");
    onBoard.router.handle(LogicalAction.Confirm);
    expect(onBoard.board.calls).toEqual(["confirmCursorTile"]);
    expect(onBoard.menu.calls).toEqual([]);

    const inMenu = setup("menu");
    inMenu.router.handle(LogicalAction.Confirm);
    expect(inMenu.menu.calls).toEqual(["confirm"]);
    expect(inMenu.board.calls).toEqual([]);
  });

  it("keeps camera, zoom and panel scrolling available while a menu is open", () => {
    const { router, board } = setup("menu");

    router.handle(LogicalAction.RotateCameraLeft);
    router.handle(LogicalAction.ZoomLevel3);
    router.handle(LogicalAction.ZoomIn);
    router.handle(LogicalAction.ScrollLogDown);
    router.handle(LogicalAction.ScrollTimelineUp);
    router.handle(LogicalAction.PanCameraRight);

    expect(board.calls).toEqual([
      "rotateCamera:-1",
      "setZoomLevel:2",
      "zoomCamera:1",
      "scrollLog:1",
      "scrollTimeline:-1",
      "panCamera:-8,0",
    ]);
  });

  it("consumes nothing at all while locked (animation, battle over)", () => {
    const { router, board, menu } = setup("locked");

    for (const action of Object.values(LogicalAction)) {
      expect(router.handle(action)).toBe(false);
    }

    expect(board.calls).toEqual([]);
    expect(menu.calls).toEqual([]);
  });

  it("cycles targets only on the board, and reports when there was nothing to cycle", () => {
    const { router, board } = setup("board");
    expect(router.handle(LogicalAction.CycleTargetNext)).toBe(true);
    expect(board.calls).toEqual(["cycleTarget:1"]);

    const inMenu = setup("menu");
    expect(inMenu.router.handle(LogicalAction.CycleTargetPrevious)).toBe(false);

    const idleBoard = { ...makeBoard(), cycleTarget: () => false };
    const idleRouter = createInputRouter({
      context: () => "board",
      board: () => idleBoard,
      menu: () => null,
    });
    expect(idleRouter.handle(LogicalAction.CycleTargetNext)).toBe(false);
  });

  it("reports not-consumed when the menu declines Confirm (a focused button owns the key)", () => {
    const menu = { ...makeMenu(), confirm: () => false };
    const router = createInputRouter({
      context: () => "menu",
      board: () => null,
      menu: () => menu,
    });

    expect(router.handle(LogicalAction.Confirm)).toBe(false);
  });

  it("falls back to not consuming when the context has no consumer wired", () => {
    const router = createInputRouter({
      context: () => "board",
      board: () => null,
      menu: () => null,
    });

    expect(router.handle(LogicalAction.CursorUp)).toBe(false);
    expect(router.handle(LogicalAction.Confirm)).toBe(false);
    expect(router.handle(LogicalAction.Cancel)).toBe(false);
  });

  it("INVARIANT: an action never reaches two consumers", () => {
    for (const context of ["menu", "board", "screen", "locked"] as const) {
      for (const action of Object.values(LogicalAction)) {
        const board = makeBoard();
        const menu = makeMenu();
        const router = createInputRouter({
          context: () => context,
          board: () => board,
          menu: () => menu,
        });

        router.handle(action);

        const touched = [board.calls.length > 0, menu.calls.length > 0].filter(Boolean).length;
        expect(touched, `${context}/${action} reached ${touched} consumers`).toBeLessThanOrEqual(1);
        expect(board.calls.length + menu.calls.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("re-reads its consumers on every action (placement hands the board over to combat)", () => {
    const placement = makeBoard();
    const combat = makeBoard();
    let active: BoardInputConsumer = placement;
    const router = createInputRouter({
      context: () => "board",
      board: () => active,
      menu: () => null,
    });

    router.handle(LogicalAction.Cancel);
    active = combat;
    router.handle(LogicalAction.Cancel);

    expect(placement.calls).toEqual(["cancel"]);
    expect(combat.calls).toEqual(["cancel"]);
  });

  it("asks for the context once per action, so a mid-turn phase change is picked up", () => {
    const context = vi.fn<() => InputContext>().mockReturnValue("board");
    const board = makeBoard();
    const router = createInputRouter({ context, board: () => board, menu: () => null });

    router.handle(LogicalAction.CursorUp);
    context.mockReturnValue("locked");
    router.handle(LogicalAction.CursorUp);

    expect(board.calls).toEqual(["moveCursor:up"]);
  });
});

describe("createInputRouter — contexte `watching`", () => {
  it("laisse tourner et déplacer la caméra pendant le tour d'un autre joueur", () => {
    const { router, board } = setup("watching");

    expect(router.handle(LogicalAction.RotateCameraLeft)).toBe(true);
    expect(router.handle(LogicalAction.PanCameraUp)).toBe(true);
    expect(router.handle(LogicalAction.ZoomIn)).toBe(true);

    expect(board.calls).toEqual(["rotateCamera:-1", "panCamera:0,8", "zoomCamera:1"]);
  });

  it("laisse lire le journal et la timeline", () => {
    const { router, board } = setup("watching");

    expect(router.handle(LogicalAction.ScrollLogDown)).toBe(true);
    expect(router.handle(LogicalAction.ScrollTimelineUp)).toBe(true);
    expect(router.handle(LogicalAction.ToggleBattleLog)).toBe(true);

    expect(board.calls).toEqual(["scrollLog:1", "scrollTimeline:-1", "toggleLog"]);
  });

  it("laisse ouvrir le menu de combat — l'attente peut être longue", () => {
    const { router, board } = setup("watching");

    expect(router.handle(LogicalAction.OpenCombatMenu)).toBe(true);
    expect(board.calls).toEqual(["openCombatMenu"]);
  });

  /*
   * Régression 2026-09-15 : le curseur était coupé ici, ce qui rendait le plateau inspectable à la
   * SOURIS (le survol repeint le panneau d'info pendant tout le tour distant) et pas au clavier ni
   * à la manette — une asymétrie multi-entrée sur une attente qui monte à ~11 min à douze camps.
   */
  it("laisse déplacer le curseur pour inspecter le plateau, comme la souris le fait déjà", () => {
    const { router, board, menu } = setup("watching");

    expect(router.handle(LogicalAction.CursorUp)).toBe(true);
    expect(router.handle(LogicalAction.CursorRight)).toBe(true);

    expect(board.calls).toEqual(["moveCursor:up", "moveCursor:right"]);
    // Le curseur va au PLATEAU, jamais au menu : une flèche pendant un tour distant ne doit pas
    // déplacer un focus DOM.
    expect(menu.calls).toEqual([]);
  });

  it("ne laisse toucher à aucun geste de jeu — la partie n'est pas à nous", () => {
    const { router, board, menu } = setup("watching");

    expect(router.handle(LogicalAction.Confirm)).toBe(false);
    expect(router.handle(LogicalAction.Cancel)).toBe(false);
    expect(router.handle(LogicalAction.CycleTargetNext)).toBe(false);
    expect(router.handle(LogicalAction.CycleTargetPrevious)).toBe(false);

    expect(board.calls).toEqual([]);
    expect(menu.calls).toEqual([]);
  });

  it("`locked` continue de tout couper, caméra comprise", () => {
    const { router, board } = setup("locked");

    expect(router.handle(LogicalAction.RotateCameraLeft)).toBe(false);
    expect(router.handle(LogicalAction.PanCameraUp)).toBe(false);

    expect(board.calls).toEqual([]);
  });
});

describe("createInputRouter — mode Inspecter (plan 225)", () => {
  it("bascule le mode Inspecter, sur le plateau comme dans un menu ou un tour distant", () => {
    for (const context of ["board", "menu", "watching"] as const) {
      const inspector = makeInspect(false);
      const { router, board, menu } = setupInspect(context, inspector);

      expect(router.handle(LogicalAction.InspectInfo), context).toBe(true);

      expect(inspector.calls, context).toEqual(["toggle"]);
      expect([...board.calls, ...menu.calls], context).toEqual([]);
    }
  });

  it("laisse passer la touche quand il n'y a rien à inspecter", () => {
    const inspector = { ...makeInspect(false), toggle: () => false };
    const { router } = setupInspect("board", inspector);

    expect(router.handle(LogicalAction.InspectInfo)).toBe(false);
  });

  it("une fois actif, les flèches parcourent les étapes au lieu de bouger le curseur", () => {
    const inspector = makeInspect(true);
    const { router, board } = setupInspect("board", inspector);

    router.handle(LogicalAction.CursorUp);
    router.handle(LogicalAction.CursorLeft);
    router.handle(LogicalAction.CursorDown);
    router.handle(LogicalAction.CursorRight);

    expect(inspector.calls).toEqual(["step:-1", "step:-1", "step:1", "step:1"]);
    expect(board.calls).toEqual([]);
  });

  it("une fois actif, les flèches ne déplacent pas non plus le focus d'un menu", () => {
    const inspector = makeInspect(true);
    const { router, menu } = setupInspect("menu", inspector);

    expect(router.handle(LogicalAction.CursorDown)).toBe(true);

    expect(inspector.calls).toEqual(["step:1"]);
    expect(menu.calls).toEqual([]);
  });

  it("une fois actif, Confirmer et Annuler en sortent sans atteindre le plateau", () => {
    const inspector = makeInspect(true);
    const { router, board } = setupInspect("board", inspector);

    expect(router.handle(LogicalAction.Confirm)).toBe(true);
    expect(router.handle(LogicalAction.Cancel)).toBe(true);

    expect(inspector.calls).toEqual(["stop", "stop"]);
    expect(board.calls).toEqual([]);
  });

  it("une fois actif, la caméra reste libre", () => {
    const inspector = makeInspect(true);
    const { router, board } = setupInspect("board", inspector);

    expect(router.handle(LogicalAction.RotateCameraLeft)).toBe(true);

    expect(board.calls).toEqual(["rotateCamera:-1"]);
    expect(inspector.calls).toEqual([]);
  });

  it("inactif, il ne prend ni les flèches ni Confirmer", () => {
    const inspector = makeInspect(false);
    const { router, board } = setupInspect("board", inspector);

    router.handle(LogicalAction.CursorUp);
    router.handle(LogicalAction.Confirm);

    expect(board.calls).toEqual(["moveCursor:up", "confirmCursorTile"]);
    expect(inspector.calls).toEqual([]);
  });

  it("verrouillé, même la touche Inspecter est coupée", () => {
    const inspector = makeInspect(true);
    const { router } = setupInspect("locked", inspector);

    expect(router.handle(LogicalAction.InspectInfo)).toBe(false);
    expect(router.handle(LogicalAction.CursorUp)).toBe(false);

    expect(inspector.calls).toEqual([]);
  });

  it("sans consommateur Inspecter, la touche n'est pas prise et le reste ne change pas", () => {
    const { router, board } = setup("board");

    expect(router.handle(LogicalAction.InspectInfo)).toBe(false);
    router.handle(LogicalAction.CursorUp);

    expect(board.calls).toEqual(["moveCursor:up"]);
  });
});
