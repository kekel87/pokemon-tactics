import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapturedInput } from "./bindings-store.js";
import { createInputSystem, type InputSystem } from "./input-system.js";

function stubWindow(): (event: Partial<KeyboardEvent>) => void {
  const handlers = new Map<string, (event: unknown) => void>();
  vi.stubGlobal("window", {
    addEventListener: (type: string, handler: (event: unknown) => void) =>
      handlers.set(type, handler),
    removeEventListener: (type: string) => handlers.delete(type),
  });
  vi.stubGlobal("navigator", { getGamepads: () => [] });
  return (event) => {
    handlers.get("keydown")?.({
      code: "",
      shiftKey: false,
      target: null,
      preventDefault: () => undefined,
      ...event,
    });
  };
}

let system: InputSystem | null = null;

afterEach(() => {
  system?.dispose();
  system = null;
  vi.unstubAllGlobals();
});

describe("mode capture (plan 186)", () => {
  it("détourne la frappe vers le récepteur au lieu de la router", () => {
    const press = stubWindow();
    system = createInputSystem(null);
    const rotate = vi.fn();
    system.register({
      context: () => "board",
      board: {
        moveCursor: vi.fn(),
        confirmCursorTile: () => true,
        cancel: () => true,
        cycleTarget: () => true,
        rotateCamera: rotate,
        panCamera: vi.fn(),
        zoomCamera: vi.fn(),
        setZoomLevel: vi.fn(),
        scrollLog: vi.fn(),
        scrollTimeline: vi.fn(),
      },
    });
    const captured: (CapturedInput | null)[] = [];
    system.beginCapture((value) => captured.push(value));

    press({ code: "KeyQ" });

    expect(captured).toEqual([{ kind: "key", code: "KeyQ", shift: false }]);
    expect(rotate).not.toHaveBeenCalled();
  });

  it("garde Maj comme partie du binding capturé", () => {
    const press = stubWindow();
    system = createInputSystem(null);
    const captured: (CapturedInput | null)[] = [];
    system.beginCapture((value) => captured.push(value));

    press({ code: "Tab", shiftKey: true });

    expect(captured).toEqual([{ kind: "key", code: "Tab", shift: true }]);
  });

  it("annule sur Échap, sans l'assigner (décision 8)", () => {
    const press = stubWindow();
    system = createInputSystem(null);
    const captured: (CapturedInput | null)[] = [];
    system.beginCapture((value) => captured.push(value));

    press({ code: "Escape" });

    expect(captured).toEqual([null]);
  });

  it("ignore une frappe à Ctrl / Alt / Meta sans clore la capture", () => {
    const press = stubWindow();
    system = createInputSystem(null);
    const captured: (CapturedInput | null)[] = [];
    system.beginCapture((value) => captured.push(value));

    press({ code: "KeyR", ctrlKey: true });
    expect(captured).toEqual([]);

    press({ code: "KeyR" });
    expect(captured).toEqual([{ kind: "key", code: "KeyR", shift: false }]);
  });

  it("rend la main au routeur une fois la capture close", () => {
    const press = stubWindow();
    system = createInputSystem(null);
    const rotate = vi.fn();
    system.register({
      context: () => "board",
      board: {
        moveCursor: vi.fn(),
        confirmCursorTile: () => true,
        cancel: () => true,
        cycleTarget: () => true,
        rotateCamera: rotate,
        panCamera: vi.fn(),
        zoomCamera: vi.fn(),
        setZoomLevel: vi.fn(),
        scrollLog: vi.fn(),
        scrollTimeline: vi.fn(),
      },
    });
    system.beginCapture(() => undefined);

    press({ code: "KeyQ" });
    press({ code: "KeyQ" });

    expect(rotate).toHaveBeenCalledTimes(1);
  });

  it("annule la capture par la fonction rendue (le bouton « Annuler » de l'écran)", () => {
    stubWindow();
    system = createInputSystem(null);
    const captured: (CapturedInput | null)[] = [];

    const cancel = system.beginCapture((value) => captured.push(value));
    cancel();

    expect(captured).toEqual([null]);
  });

  it("annule la capture en cours quand une seconde s'ouvre", () => {
    stubWindow();
    system = createInputSystem(null);
    const first: (CapturedInput | null)[] = [];

    system.beginCapture((value) => first.push(value));
    system.beginCapture(() => undefined);

    expect(first).toEqual([null]);
  });
});
