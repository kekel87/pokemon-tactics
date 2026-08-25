import { describe, expect, it } from "vitest";
import { getBindings } from "./bindings-store.js";
import { isClaimedByFocusedControl, resolveKeyboardAction } from "./keyboard-source.js";
import { LogicalAction } from "./logical-action.js";

const press = (code: string, modifiers: Partial<KeyboardEvent> = {}) =>
  resolveKeyboardAction({ code, shiftKey: false, ...modifiers });

describe("resolveKeyboardAction", () => {
  it("maps both the arrows and the movement pad to the cursor", () => {
    expect(press("ArrowUp")).toBe(LogicalAction.CursorUp);
    expect(press("ArrowRight")).toBe(LogicalAction.CursorRight);
    expect(press("KeyW")).toBe(LogicalAction.CursorUp);
    expect(press("KeyA")).toBe(LogicalAction.CursorLeft);
    expect(press("KeyS")).toBe(LogicalAction.CursorDown);
    expect(press("KeyD")).toBe(LogicalAction.CursorRight);
  });

  it("puts the camera on the two keys flanking the movement pad", () => {
    expect(press("KeyQ")).toBe(LogicalAction.RotateCameraLeft);
    expect(press("KeyE")).toBe(LogicalAction.RotateCameraRight);
  });

  it("binds the 3 zoom notches to the digit row by POSITION, not by character", () => {
    expect(press("Digit1")).toBe(LogicalAction.ZoomLevel1);
    expect(press("Digit2")).toBe(LogicalAction.ZoomLevel2);
    expect(press("Digit3")).toBe(LogicalAction.ZoomLevel3);
    expect(press("Numpad2")).toBe(LogicalAction.ZoomLevel2);
    expect(press("KeyR")).toBe(LogicalAction.ZoomIn);
    expect(press("KeyF")).toBe(LogicalAction.ZoomOut);
  });

  it("never binds `+` / `-` (the Minus position carries `)` on AZERTY)", () => {
    expect(press("Minus")).toBeNull();
    expect(press("Equal")).toBeNull();
  });

  it("pairs Shift with the three keys that need a second meaning", () => {
    expect(press("Tab")).toBe(LogicalAction.CycleTargetNext);
    expect(press("Tab", { shiftKey: true })).toBe(LogicalAction.CycleTargetPrevious);
    expect(press("PageDown")).toBe(LogicalAction.ScrollTimelineDown);
    expect(press("PageUp")).toBe(LogicalAction.ScrollTimelineUp);
    expect(press("PageDown", { shiftKey: true })).toBe(LogicalAction.ScrollLogDown);
    expect(press("PageUp", { shiftKey: true })).toBe(LogicalAction.ScrollLogUp);
  });

  it("leaves the browser and the OS their shortcuts", () => {
    expect(press("KeyR", { ctrlKey: true })).toBeNull();
    expect(press("Tab", { altKey: true })).toBeNull();
    expect(press("KeyW", { metaKey: true })).toBeNull();
    expect(press("KeyW", { shiftKey: true })).toBeNull();
  });

  it("keeps confirm and cancel on their conventional keys", () => {
    expect(press("Space")).toBe(LogicalAction.Confirm);
    expect(press("Enter")).toBe(LogicalAction.Confirm);
    expect(press("Escape")).toBe(LogicalAction.Cancel);
    // `NumpadEnter` est PERDU depuis le plan 186 (décision 6) : Confirmer était la seule action à 3
    // bindings, et un binding remappable n'a que 2 slots. Le joueur peut le remettre lui-même.
    expect(press("NumpadEnter")).toBeNull();
  });

  it("returns null for an unbound key", () => {
    expect(press("KeyZ")).toBeNull();
    expect(press("F5")).toBeNull();
    expect(press("")).toBeNull();
  });

  it("has no `key`-based binding at all — the whole table is physical positions", () => {
    for (const lookupKey of getBindings().keyboardLookup().keys()) {
      expect(lookupKey.replace("Shift+", "")).not.toMatch(/^[a-z0-9+=-]$/i);
    }
  });
});

describe("isClaimedByFocusedControl", () => {
  const element = (tagName: string, extra: Record<string, unknown> = {}) =>
    ({ tagName, ...extra }) as unknown as EventTarget;

  const claims = (target: EventTarget | null, action: LogicalAction) =>
    isClaimedByFocusedControl(target, action);

  it("gives a text field the whole keyboard", () => {
    const field = element("INPUT", { type: "text" });
    for (const action of [
      LogicalAction.CursorUp,
      LogicalAction.CursorLeft,
      LogicalAction.Confirm,
      LogicalAction.Cancel,
    ]) {
      expect(claims(field, action)).toBe(true);
    }
    expect(claims(element("TEXTAREA"), LogicalAction.CursorUp)).toBe(true);
    expect(claims(element("DIV", { isContentEditable: true }), LogicalAction.CursorUp)).toBe(true);
  });

  it("lets a select keep only the key that OPENS it, so the arrows can leave it", () => {
    const select = element("SELECT");
    expect(claims(select, LogicalAction.Confirm)).toBe(true);
    for (const action of [
      LogicalAction.CursorUp,
      LogicalAction.CursorDown,
      LogicalAction.CursorLeft,
      LogicalAction.CursorRight,
    ]) {
      expect(claims(select, action)).toBe(false);
    }
  });

  it("lets a slider keep the horizontal axis but release the vertical one", () => {
    const slider = element("INPUT", { type: "range" });
    expect(claims(slider, LogicalAction.CursorLeft)).toBe(true);
    expect(claims(slider, LogicalAction.CursorRight)).toBe(true);
    expect(claims(slider, LogicalAction.CursorUp)).toBe(false);
    expect(claims(slider, LogicalAction.CursorDown)).toBe(false);
  });

  it("claims nothing for a toggle, so the arrows can leave it", () => {
    for (const type of ["checkbox", "radio", "button", "submit", "reset", "color", "file"]) {
      const toggle = element("INPUT", { type });
      expect(claims(toggle, LogicalAction.CursorUp)).toBe(false);
      expect(claims(toggle, LogicalAction.CursorLeft)).toBe(false);
      expect(claims(toggle, LogicalAction.Confirm)).toBe(false);
    }
  });

  it("claims nothing for a button or the canvas", () => {
    expect(claims(element("BUTTON"), LogicalAction.CursorUp)).toBe(false);
    expect(claims(element("CANVAS"), LogicalAction.Confirm)).toBe(false);
    expect(claims(null, LogicalAction.CursorUp)).toBe(false);
    expect(claims({} as EventTarget, LogicalAction.CursorUp)).toBe(false);
  });
});
