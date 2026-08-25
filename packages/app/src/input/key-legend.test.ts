import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Language } from "../i18n/types.js";
import { getBindings } from "./bindings-store.js";
import { cameraKeyLabels, resolveKeyLabels } from "./key-legend.js";
import { LogicalAction } from "./logical-action.js";

const language = vi.hoisted(() => ({ current: "fr" as Language }));
vi.mock("../i18n/index.js", () => ({
  getLanguage: () => language.current,
}));

function stubKeyboard(layout: Map<string, string> | Error | null): void {
  if (layout === null) {
    vi.stubGlobal("navigator", {});
    return;
  }
  vi.stubGlobal("navigator", {
    keyboard: {
      getLayoutMap: () =>
        layout instanceof Error ? Promise.reject(layout) : Promise.resolve(layout),
    },
  });
}

beforeEach(() => {
  language.current = Language.French;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cameraKeyLabels", () => {
  it("falls back to the AZERTY letter in French when the layout API is absent", async () => {
    stubKeyboard(null);
    await resolveKeyLabels();

    expect(cameraKeyLabels().rotateLeft).toBe("A");
    expect(cameraKeyLabels().rotateRight).toBe("E");
    expect(cameraKeyLabels().zoomIn).toBe("R");
    expect(cameraKeyLabels().zoomOut).toBe("F");
  });

  it("resolves each control through its binding, not through a hard-coded key", async () => {
    const boundToRotateLeft = getBindings().current().keyboard[LogicalAction.RotateCameraLeft][0];
    stubKeyboard(new Map([[boundToRotateLeft?.code ?? "", "z"]]));
    await resolveKeyLabels();

    expect(cameraKeyLabels().rotateLeft).toBe("Z");
  });

  it("falls back to the QWERTY letter in English", async () => {
    language.current = Language.English;
    stubKeyboard(null);
    await resolveKeyLabels();

    expect(cameraKeyLabels().rotateLeft).toBe("Q");
    expect(cameraKeyLabels().rotateRight).toBe("E");
  });

  it("prefers what the layout API reports over the language guess", async () => {
    stubKeyboard(new Map([["KeyQ", "q"]]));
    await resolveKeyLabels();

    expect(cameraKeyLabels().rotateLeft).toBe("Q");
    expect(cameraKeyLabels().zoomIn).toBe("R");
  });

  it("falls back when the API throws (permission policy)", async () => {
    stubKeyboard(new Error("SecurityError"));
    await resolveKeyLabels();

    expect(cameraKeyLabels().rotateLeft).toBe("A");
  });

  it("ignores characters the tilesheet cannot draw", async () => {
    stubKeyboard(
      new Map([
        ["KeyQ", "й"],
        ["KeyE", "é"],
        ["KeyR", "]"],
      ]),
    );
    await resolveKeyLabels();

    expect(cameraKeyLabels().rotateLeft).toBe("A");
    expect(cameraKeyLabels().rotateRight).toBe("E");
    expect(cameraKeyLabels().zoomIn).toBe("R");
  });
});
