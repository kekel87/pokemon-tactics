import type { InputContext } from "@pokemon-tactic/view-core";
import { describe, expect, it, vi } from "vitest";
import {
  type BoardInputConsumer,
  createInputRouter,
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
    scrollTimeline: (delta) => calls.push(`scrollTimeline:${delta}`),
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
