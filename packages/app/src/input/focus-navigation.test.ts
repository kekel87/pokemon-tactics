import { describe, expect, it } from "vitest";
import { selectDouble, sliderDouble } from "../testing/focusable-control-doubles";
import { applyToControl } from "./focus-navigation.js";
import { LogicalAction } from "./logical-action.js";

describe("applyToControl — slider", () => {
  it("règle la valeur sur l'axe qu'un slider revendique, et émet `input`", () => {
    const control = sliderDouble(5);
    expect(applyToControl(control, LogicalAction.CursorRight)).toBe(true);
    expect(control.value).toBe("6");
    expect(control.events.map((event) => event.type)).toEqual(["input"]);

    expect(applyToControl(control, LogicalAction.CursorLeft)).toBe(true);
    expect(control.value).toBe("5");
  });

  it("ne revendique pas la verticale : ↑ ↓ doivent pouvoir sortir du slider", () => {
    const control = sliderDouble(5);
    expect(applyToControl(control, LogicalAction.CursorUp)).toBe(false);
    expect(applyToControl(control, LogicalAction.CursorDown)).toBe(false);
    expect(control.value).toBe("5");
    expect(control.events).toEqual([]);
  });

  it("rend l'appui au routeur en butée, plutôt que de l'avaler dans le vide", () => {
    const atMax = sliderDouble(10, { max: 10 });
    expect(applyToControl(atMax, LogicalAction.CursorRight)).toBe(false);
    expect(atMax.events).toEqual([]);

    const atMin = sliderDouble(0, { min: 0 });
    expect(applyToControl(atMin, LogicalAction.CursorLeft)).toBe(false);
    expect(atMin.events).toEqual([]);
  });

  it("laisse passer un slider désactivé", () => {
    const control = sliderDouble(5, { disabled: true });
    expect(applyToControl(control, LogicalAction.CursorRight)).toBe(false);
    expect(control.value).toBe("5");
  });
});

describe("applyToControl — select", () => {
  it("change l'option en place sur la verticale, et émet `change`", () => {
    const control = selectDouble(1);
    expect(applyToControl(control, LogicalAction.CursorDown)).toBe(true);
    expect(control.selectedIndex).toBe(2);
    expect(control.events.map((event) => event.type)).toEqual(["change"]);

    expect(applyToControl(control, LogicalAction.CursorUp)).toBe(true);
    expect(control.selectedIndex).toBe(1);
  });

  it("ne revendique pas l'horizontale : ← → sont la sortie du contrôle", () => {
    const control = selectDouble(1);
    expect(applyToControl(control, LogicalAction.CursorLeft)).toBe(false);
    expect(applyToControl(control, LogicalAction.CursorRight)).toBe(false);
    expect(control.selectedIndex).toBe(1);
    expect(control.events).toEqual([]);
  });

  it("rend l'appui au routeur sur la première et la dernière option", () => {
    const first = selectDouble(0);
    expect(applyToControl(first, LogicalAction.CursorUp)).toBe(false);

    const last = selectDouble(2, 3);
    expect(applyToControl(last, LogicalAction.CursorDown)).toBe(false);
  });

  it("laisse passer un select désactivé", () => {
    const control = selectDouble(1, 3, true);
    expect(applyToControl(control, LogicalAction.CursorDown)).toBe(false);
    expect(control.selectedIndex).toBe(1);
  });
});

describe("applyToControl — ce qui ne revendique rien", () => {
  it("ne revendique pas un champ texte : la manette ne saisit pas, elle doit pouvoir sortir", () => {
    for (const type of ["text", "search", "number"]) {
      const control = { tagName: "INPUT", type, dispatchEvent: () => undefined };
      expect(applyToControl(control, LogicalAction.CursorLeft)).toBe(false);
      expect(applyToControl(control, LogicalAction.CursorDown)).toBe(false);
    }
  });

  it("ne revendique pas une case à cocher ni un bouton", () => {
    for (const tag of [
      { tagName: "INPUT", type: "checkbox" },
      { tagName: "INPUT", type: "radio" },
      { tagName: "BUTTON" },
      { tagName: "TEXTAREA" },
    ]) {
      expect(applyToControl(tag, LogicalAction.CursorLeft)).toBe(false);
      expect(applyToControl(tag, LogicalAction.CursorUp)).toBe(false);
    }
  });

  it("ne revendique aucune action hors des quatre directions", () => {
    const control = sliderDouble(5);
    for (const action of [
      LogicalAction.Confirm,
      LogicalAction.Cancel,
      LogicalAction.ZoomIn,
      LogicalAction.OpenCombatMenu,
    ]) {
      expect(applyToControl(control, action)).toBe(false);
    }
    expect(control.value).toBe("5");
  });

  it("ne lève pas sur une cible absente ou sans `tagName`", () => {
    expect(applyToControl(null, LogicalAction.CursorLeft)).toBe(false);
    expect(applyToControl(undefined, LogicalAction.CursorLeft)).toBe(false);
    expect(applyToControl({}, LogicalAction.CursorLeft)).toBe(false);
    expect(applyToControl({ tagName: 42 }, LogicalAction.CursorLeft)).toBe(false);
  });
});
