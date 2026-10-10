import { describe, expect, it } from "vitest";
import { selectDouble, sliderDouble } from "../testing/focusable-control-doubles";
import { applyToControl, directionalScore } from "./focus-navigation.js";
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

describe("directionalScore", () => {
  // La carte de camp du plan 228 : un bouton d'équipe large, l'icône ✏️ collée à sa droite, et un
  // bouton de difficulté sur la rangée du dessus dont le centre tombe à droite de celui de l'équipe.
  const teamButton = { left: 0, right: 300, top: 100, bottom: 140 };
  const editIcon = { left: 304, right: 344, top: 100, bottom: 140 };
  const rowAboveButton = { left: 160, right: 240, top: 40, bottom: 80 };

  it("préfère le voisin collé à droite d'un contrôle large au bouton de la rangée du dessus", () => {
    const toEditIcon = directionalScore(teamButton, editIcon, "right");
    const toRowAbove = directionalScore(teamButton, rowAboveButton, "right");
    expect(toEditIcon).toBe(4);
    expect(toRowAbove).toBe(20 * 2 + 60 * 1.5);
  });

  it("revient sur le contrôle large par ←, et non sur la rangée du dessus", () => {
    expect(directionalScore(editIcon, teamButton, "left")).toBe(4);
    expect(directionalScore(editIcon, rowAboveButton, "left")).toBe(64 + 20 * 2 + 60 * 1.5);
  });

  it("écarte un candidat dont le centre n'est pas dans la direction pressée", () => {
    expect(directionalScore(editIcon, teamButton, "right")).toBeNull();
    expect(directionalScore(teamButton, editIcon, "left")).toBeNull();
    expect(directionalScore(rowAboveButton, teamButton, "up")).toBeNull();
    expect(directionalScore(teamButton, rowAboveButton, "down")).toBeNull();
  });

  it("écarte un candidat aligné sur le centre, ni d'un côté ni de l'autre", () => {
    const sameCentre = { left: 100, right: 200, top: 0, bottom: 240 };
    expect(directionalScore(teamButton, sameCentre, "right")).toBeNull();
    expect(directionalScore(teamButton, sameCentre, "left")).toBeNull();
  });

  it("compte une distance nulle entre deux contrôles qui se chevauchent sur l'axe", () => {
    const overlapping = { left: 250, right: 350, top: 100, bottom: 140 };
    expect(directionalScore(teamButton, overlapping, "right")).toBe(0);
  });

  it("mesure la verticale bord à bord, le décalage des centres pesant ×1,5", () => {
    expect(directionalScore(teamButton, rowAboveButton, "up")).toBe(20 + 50 * 1.5);
    expect(directionalScore(rowAboveButton, teamButton, "down")).toBe(20 + 50 * 1.5);
  });

  it("préfère, parmi deux contrôles qui recouvrent celui qu'on quitte, le plus en face", () => {
    const facing = { left: 120, right: 180, top: 160, bottom: 200 };
    const atTheEdge = { left: 0, right: 60, top: 150, bottom: 200 };
    const toFacing = directionalScore(teamButton, facing, "down");
    const toEdge = directionalScore(teamButton, atTheEdge, "down");
    expect(toFacing).toBe(20);
    expect(toEdge).toBe(10 + 120 * 1.5);
  });

  it("pénalise ×2 l'écart transverse entre deux colonnes disjointes", () => {
    const sideColumn = { left: 400, right: 480, top: 40, bottom: 80 };
    expect(directionalScore(teamButton, sideColumn, "up")).toBe(20 + 100 * 2 + 290 * 1.5);
  });
});
