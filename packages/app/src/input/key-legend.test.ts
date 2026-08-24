import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Language } from "../i18n/types.js";
import { keyLabel, resolveKeyLabels } from "./key-legend.js";

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

describe("keyLabel", () => {
  it("falls back to the AZERTY letter in French when the layout API is absent", async () => {
    stubKeyboard(null);
    await resolveKeyLabels();

    expect(keyLabel("KeyQ")).toBe("A");
    expect(keyLabel("KeyE")).toBe("E");
    expect(keyLabel("KeyR")).toBe("R");
    expect(keyLabel("KeyF")).toBe("F");
    expect(keyLabel("Digit1")).toBe("1");
  });

  it("falls back to the QWERTY letter in English", async () => {
    language.current = Language.English;
    stubKeyboard(null);
    await resolveKeyLabels();

    expect(keyLabel("KeyQ")).toBe("Q");
    expect(keyLabel("KeyE")).toBe("E");
  });

  it("prefers what the layout API reports over the language guess", async () => {
    stubKeyboard(new Map([["KeyQ", "q"]]));
    await resolveKeyLabels();

    expect(keyLabel("KeyQ")).toBe("Q");
    expect(keyLabel("KeyR")).toBe("R");
  });

  it("falls back when the API throws (permission policy)", async () => {
    stubKeyboard(new Error("SecurityError"));
    await resolveKeyLabels();

    expect(keyLabel("KeyQ")).toBe("A");
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

    expect(keyLabel("KeyQ")).toBe("A");
    expect(keyLabel("KeyE")).toBe("E");
    expect(keyLabel("KeyR")).toBe("R");
  });

  it("returns an empty label for a position nobody maps", async () => {
    stubKeyboard(null);
    await resolveKeyLabels();

    expect(keyLabel("KeyZ")).toBe("");
  });
});
