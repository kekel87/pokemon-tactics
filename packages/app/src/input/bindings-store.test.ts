import { describe, expect, it } from "vitest";
import {
  acceptsGamepadBinding,
  type BindingsStorage,
  createBindingsStore,
  DEFAULT_BINDINGS,
  keyLookupKey,
} from "./bindings-store.js";
import { LogicalAction } from "./logical-action.js";

const PLAN_184_KEYBOARD: Record<string, LogicalAction> = {
  ArrowUp: LogicalAction.CursorUp,
  ArrowDown: LogicalAction.CursorDown,
  ArrowLeft: LogicalAction.CursorLeft,
  ArrowRight: LogicalAction.CursorRight,
  KeyW: LogicalAction.CursorUp,
  KeyA: LogicalAction.CursorLeft,
  KeyS: LogicalAction.CursorDown,
  KeyD: LogicalAction.CursorRight,
  Space: LogicalAction.Confirm,
  Enter: LogicalAction.Confirm,
  Escape: LogicalAction.Cancel,
  KeyQ: LogicalAction.RotateCameraLeft,
  KeyE: LogicalAction.RotateCameraRight,
  Digit1: LogicalAction.ZoomLevel1,
  Digit2: LogicalAction.ZoomLevel2,
  Digit3: LogicalAction.ZoomLevel3,
  // Le pavé numérique a quitté le zoom au plan 189 (décision 3) : il porte le panoramique, en croix.
  Numpad8: LogicalAction.PanCameraUp,
  Numpad2: LogicalAction.PanCameraDown,
  Numpad4: LogicalAction.PanCameraLeft,
  Numpad6: LogicalAction.PanCameraRight,
  // Secours des claviers sans pavé numérique (plan 189, décision 2) : fixe, non remappable.
  "Shift+ArrowUp": LogicalAction.PanCameraUp,
  "Shift+ArrowDown": LogicalAction.PanCameraDown,
  "Shift+ArrowLeft": LogicalAction.PanCameraLeft,
  "Shift+ArrowRight": LogicalAction.PanCameraRight,
  KeyR: LogicalAction.ZoomIn,
  KeyF: LogicalAction.ZoomOut,
  Tab: LogicalAction.CycleTargetNext,
  PageUp: LogicalAction.ScrollTimelineUp,
  PageDown: LogicalAction.ScrollTimelineDown,
  KeyJ: LogicalAction.ToggleBattleLog,
  "Shift+Tab": LogicalAction.CycleTargetPrevious,
  "Shift+PageUp": LogicalAction.ScrollLogUp,
  "Shift+PageDown": LogicalAction.ScrollLogDown,
};

const PLAN_184_GAMEPAD: Record<number, LogicalAction> = {
  0: LogicalAction.Confirm,
  1: LogicalAction.Cancel,
  2: LogicalAction.CycleTargetNext,
  4: LogicalAction.RotateCameraLeft,
  5: LogicalAction.RotateCameraRight,
  6: LogicalAction.ZoomOut,
  7: LogicalAction.ZoomIn,
};

function fakeStorage(initial?: string): BindingsStorage & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() {
      return this.value;
    },
    setItem(_key, next) {
      this.value = next;
    },
  };
}

describe("transposition des défauts du plan 184", () => {
  it("garde chaque touche sur la même action", () => {
    const lookup = createBindingsStore(null).keyboardLookup();
    for (const [code, action] of Object.entries(PLAN_184_KEYBOARD)) {
      expect(lookup.get(code), code).toBe(action);
    }
  });

  it("n'invente aucune touche que le plan 184 n'avait pas", () => {
    const lookup = createBindingsStore(null).keyboardLookup();
    for (const code of lookup.keys()) {
      expect(PLAN_184_KEYBOARD, code).toHaveProperty([code]);
    }
  });

  it("range les 6 variantes Maj sur des actions distinctes", () => {
    const lookup = createBindingsStore(null).keyboardLookup();
    expect(lookup.get(keyLookupKey("Tab", false))).toBe(LogicalAction.CycleTargetNext);
    expect(lookup.get(keyLookupKey("Tab", true))).toBe(LogicalAction.CycleTargetPrevious);
    expect(lookup.get(keyLookupKey("PageUp", false))).toBe(LogicalAction.ScrollTimelineUp);
    expect(lookup.get(keyLookupKey("PageUp", true))).toBe(LogicalAction.ScrollLogUp);
    expect(lookup.get(keyLookupKey("PageDown", false))).toBe(LogicalAction.ScrollTimelineDown);
    expect(lookup.get(keyLookupKey("PageDown", true))).toBe(LogicalAction.ScrollLogDown);
  });

  it("garde chaque bouton de manette du plan 184 sur la même action", () => {
    const lookup = createBindingsStore(null).gamepadLookup();
    for (const [index, action] of Object.entries(PLAN_184_GAMEPAD)) {
      expect(lookup.get(Number(index)), index).toBe(action);
    }
  });

  it("ajoute les trois boutons que le plan 184 laissait libres : Y, Select et Start", () => {
    const lookup = createBindingsStore(null).gamepadLookup();
    expect(lookup.get(3)).toBe(LogicalAction.CycleTargetPrevious);
    expect(lookup.get(8)).toBe(LogicalAction.ToggleBattleLog);
    // Start, gardé libre par le plan 186 en prévision du menu de combat (plan 187).
    expect(lookup.get(9)).toBe(LogicalAction.OpenCombatMenu);
    expect([...lookup.keys()].sort((left, right) => left - right)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("perd `NumpadEnter`, seul binding en trop des 2 slots (décision 6)", () => {
    expect(createBindingsStore(null).keyboardLookup().has("NumpadEnter")).toBe(false);
  });
});

describe("assignation", () => {
  it("déloge la touche de son ancienne action plutôt que de la dupliquer", () => {
    const store = createBindingsStore(null);
    const result = store.assign(LogicalAction.ZoomIn, 0, {
      kind: "key",
      code: "KeyQ",
      shift: false,
    });

    expect(result).toEqual({
      status: "assigned",
      displaced: { action: LogicalAction.RotateCameraLeft, cell: 0 },
    });
    expect(store.keyboardLookup().get("KeyQ")).toBe(LogicalAction.ZoomIn);
    expect(store.current().keyboard[LogicalAction.RotateCameraLeft][0]).toBeNull();
    expect(store.isDisplaced(LogicalAction.RotateCameraLeft, 0)).toBe(true);
  });

  it("ne signale PAS comme délogé un slot vide de naissance (décision 15)", () => {
    const store = createBindingsStore(null);
    expect(store.current().keyboard[LogicalAction.RotateCameraLeft][1]).toBeNull();
    expect(store.isDisplaced(LogicalAction.RotateCameraLeft, 1)).toBe(false);
  });

  it("distingue une position selon Maj — `Maj+KeyR` ne déloge pas `KeyR`", () => {
    const store = createBindingsStore(null);
    store.assign(LogicalAction.CycleTargetPrevious, 1, { kind: "key", code: "KeyR", shift: true });

    expect(store.keyboardLookup().get("KeyR")).toBe(LogicalAction.ZoomIn);
    expect(store.keyboardLookup().get("Shift+KeyR")).toBe(LogicalAction.CycleTargetPrevious);
  });

  it("refuse de toucher à Annuler, la seule action fixe", () => {
    const store = createBindingsStore(null);
    expect(
      store.assign(LogicalAction.Cancel, 0, { kind: "key", code: "KeyZ", shift: false }),
    ).toEqual({ status: "fixed" });
    expect(store.keyboardLookup().has("KeyZ")).toBe(false);
  });

  it("refuse un bouton de manette sur une action qui n'en accepte pas", () => {
    const store = createBindingsStore(null);
    expect(store.assign(LogicalAction.CursorUp, "pad", { kind: "pad", index: 3 })).toEqual({
      status: "fixed",
    });
    expect(store.assign(LogicalAction.ZoomLevel1, "pad", { kind: "pad", index: 3 })).toEqual({
      status: "fixed",
    });
  });

  it("refuse une touche dans la colonne manette, et l'inverse", () => {
    const store = createBindingsStore(null);
    expect(
      store.assign(LogicalAction.ZoomIn, "pad", { kind: "key", code: "KeyG", shift: false }),
    ).toEqual({ status: "wrong-device" });
    expect(store.assign(LogicalAction.ZoomIn, 0, { kind: "pad", index: 3 })).toEqual({
      status: "wrong-device",
    });
  });

  it("refuse de voler `Échap` à Annuler", () => {
    const store = createBindingsStore(null);
    expect(
      store.assign(LogicalAction.ZoomIn, 1, { kind: "key", code: "Escape", shift: false }),
    ).toEqual({ status: "fixed" });
    expect(store.keyboardLookup().get("Escape")).toBe(LogicalAction.Cancel);
  });

  it("échange aussi les boutons de manette, sur un slot unique", () => {
    const store = createBindingsStore(null);

    store.assign(LogicalAction.ZoomIn, "pad", { kind: "pad", index: 2 });

    expect(store.gamepadLookup().get(2)).toBe(LogicalAction.ZoomIn);
    expect(store.gamepadButton(LogicalAction.CycleTargetNext)).toBeNull();
    expect(store.isDisplaced(LogicalAction.CycleTargetNext, "pad")).toBe(true);
  });

  it("déplacer une touche d'un slot à l'autre de la MÊME action n'est pas un échange", () => {
    const store = createBindingsStore(null);

    const result = store.assign(LogicalAction.Confirm, 1, {
      kind: "key",
      code: "Space",
      shift: false,
    });

    expect(result).toEqual({ status: "assigned", displaced: null });
    expect(store.keyBinding(LogicalAction.Confirm, 0)).toBeNull();
    expect(store.isDisplaced(LogicalAction.Confirm, 0)).toBe(false);
    expect(store.keyBinding(LogicalAction.Confirm, 1)).toEqual({ code: "Space", shift: false });
  });

  it("réinitialise, y compris l'état « délogé »", () => {
    const store = createBindingsStore(null);
    store.assign(LogicalAction.ZoomIn, 0, { kind: "key", code: "KeyQ", shift: false });
    store.reset();

    expect(store.keyboardLookup().get("KeyQ")).toBe(LogicalAction.RotateCameraLeft);
    expect(store.isDisplaced(LogicalAction.RotateCameraLeft, 0)).toBe(false);
    expect(store.isCustomised(LogicalAction.ZoomIn, 0)).toBe(false);
  });
});

describe("persistance", () => {
  it("n'écrit que les écarts au défaut (décision 12)", () => {
    const storage = fakeStorage();
    const store = createBindingsStore(storage);
    store.assign(LogicalAction.ZoomIn, 1, { kind: "key", code: "KeyG", shift: false });

    const stored = JSON.parse(storage.value ?? "{}") as {
      version: number;
      keyboard: Record<string, unknown>;
    };
    expect(stored.version).toBe(1);
    expect(Object.keys(stored.keyboard)).toEqual([LogicalAction.ZoomIn]);
  });

  it("relit ses écarts au chargement suivant", () => {
    const storage = fakeStorage();
    createBindingsStore(storage).assign(LogicalAction.ZoomIn, 1, {
      kind: "key",
      code: "KeyG",
      shift: false,
    });

    expect(createBindingsStore(storage).keyboardLookup().get("KeyG")).toBe(LogicalAction.ZoomIn);
  });

  it("ignore un écart sur une action disparue, et le purge à l'écriture suivante", () => {
    const storage = fakeStorage(
      JSON.stringify({
        version: 1,
        keyboard: { "menu-next": [{ code: "KeyM", shift: false }, null] },
        gamepad: {},
      }),
    );
    const store = createBindingsStore(storage);
    expect(store.keyboardLookup().has("KeyM")).toBe(false);

    store.assign(LogicalAction.ZoomIn, 1, { kind: "key", code: "KeyG", shift: false });
    expect(storage.value).not.toContain("menu-next");
  });

  it("repart des défauts sur une sauvegarde illisible ou d'une autre version", () => {
    expect(createBindingsStore(fakeStorage("{{")).keyboardLookup().get("KeyQ")).toBe(
      LogicalAction.RotateCameraLeft,
    );
    expect(
      createBindingsStore(fakeStorage(JSON.stringify({ version: 99, keyboard: {}, gamepad: {} })))
        .keyboardLookup()
        .get("KeyQ"),
    ).toBe(LogicalAction.RotateCameraLeft);
  });

  it("expose le panoramique, remappable depuis le plan 189", () => {
    // Inverse du test précédent, et c'est le point : les décisions #807/#811 l'excluaient parce que le
    // clavier n'avait pas de maintien. Il en a un (`keyboard-hold-source`), donc la ligne existe.
    expect(Object.keys(DEFAULT_BINDINGS.keyboard)).toContain(LogicalAction.PanCameraUp);
  });

  it("pose le panoramique sur le pavé numérique, en croix", () => {
    const store = createBindingsStore(null);
    expect(store.keyboardLookup().get("Numpad8")).toBe(LogicalAction.PanCameraUp);
    expect(store.keyboardLookup().get("Numpad2")).toBe(LogicalAction.PanCameraDown);
    expect(store.keyboardLookup().get("Numpad4")).toBe(LogicalAction.PanCameraLeft);
    expect(store.keyboardLookup().get("Numpad6")).toBe(LogicalAction.PanCameraRight);
  });

  it("libère Numpad1/2/3 des crans de zoom, qui gardent la rangée de chiffres", () => {
    const store = createBindingsStore(null);
    // `Numpad2` doit appartenir au panoramique et à lui seul : c'est la collision que la décision 3
    // tranche. Les crans gardent `Digit1/2/3`.
    expect(store.keyboardLookup().get("Numpad1")).toBeUndefined();
    expect(store.keyboardLookup().get("Numpad3")).toBeUndefined();
    expect(store.keyboardLookup().get("Digit1")).toBe(LogicalAction.ZoomLevel1);
    expect(store.keyboardLookup().get("Digit2")).toBe(LogicalAction.ZoomLevel2);
    expect(store.keyboardLookup().get("Digit3")).toBe(LogicalAction.ZoomLevel3);
  });

  it("offre Maj+flèches en secours du panoramique, pour un clavier sans pavé numérique", () => {
    const lookup = createBindingsStore(null).keyboardLookup();
    expect(lookup.get("Shift+ArrowUp")).toBe(LogicalAction.PanCameraUp);
    expect(lookup.get("Shift+ArrowDown")).toBe(LogicalAction.PanCameraDown);
    expect(lookup.get("Shift+ArrowLeft")).toBe(LogicalAction.PanCameraLeft);
    expect(lookup.get("Shift+ArrowRight")).toBe(LogicalAction.PanCameraRight);
    // Les flèches NUES restent le curseur : le secours vit sur la variante à Maj, pas à leur place.
    expect(lookup.get("ArrowUp")).toBe(LogicalAction.CursorUp);
  });

  it("le secours cède la place à une assignation du joueur", () => {
    const store = createBindingsStore(null);
    // Le joueur pose `Maj+↑` sur *Confirmer* : c'est SON choix qui doit s'appliquer, sinon le jeu lui
    // volerait une touche en silence au profit d'un repli qu'il n'a pas demandé.
    const result = store.assign(LogicalAction.Confirm, 0, {
      kind: "key",
      code: "ArrowUp",
      shift: true,
    });
    expect(result.status).toBe("assigned");
    expect(store.keyboardLookup().get("Shift+ArrowUp")).toBe(LogicalAction.Confirm);
    // Les trois autres directions du secours ne sont pas touchées.
    expect(store.keyboardLookup().get("Shift+ArrowDown")).toBe(LogicalAction.PanCameraDown);
  });

  it("n'accepte aucun bouton de manette pour le panoramique, qui est un stick", () => {
    expect(acceptsGamepadBinding(LogicalAction.PanCameraUp)).toBe(false);
    expect(acceptsGamepadBinding(LogicalAction.PanCameraRight)).toBe(false);
    // Témoin : une action à bouton reste assignable.
    expect(acceptsGamepadBinding(LogicalAction.Confirm)).toBe(true);
  });

  it("expose les mêmes actions côté clavier et côté manette", () => {
    expect(Object.keys(DEFAULT_BINDINGS.keyboard).sort()).toEqual(
      Object.keys(DEFAULT_BINDINGS.gamepad).sort(),
    );
  });
});
