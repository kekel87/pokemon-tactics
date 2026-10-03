import { BattleEventType } from "@pokemon-tactic/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleLogContext } from "./BattleLogFormatter.js";
import { createBattleLog } from "./battle-log.js";

class FakeElement {
  className = "";
  textContent: string | null = "";
  hidden = false;
  type = "";
  scrollTop = 0;
  readonly scrollHeight = 0;
  readonly clientHeight = 0;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  private readonly attributes = new Map<string, string>();

  get childElementCount(): number {
    return this.children.length;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...nodes);
  }

  readonly addEventListener = (): void => undefined;

  findAllByTestId(testId: string): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(child.dataset.testid === testId ? [child] : []),
      ...child.findAllByTestId(testId),
    ]);
  }
}

type Language = BattleLogContext["language"];

let currentLanguage: Language = "fr";

const pendingFrames: (() => void)[] = [];

const POKEMON_NAMES: Record<Language, Record<string, string>> = {
  fr: { "p1-bulbasaur": "Bulbizarre", "p2-charmander": "Salamèche" },
  en: { "p1-bulbasaur": "Bulbasaur", "p2-charmander": "Charmander" },
};

const translate = (key: string, params?: Record<string, string | number>): string => {
  const args = Object.values(params ?? {}).join(",");
  return `${currentLanguage}:${key}${args === "" ? "" : `(${args})`}`;
};

const context: BattleLogContext = {
  getPokemonName: (id) => POKEMON_NAMES[currentLanguage][id] ?? id,
  getMoveName: (id) => id,
  getAbilityName: () => null,
  getItemName: () => null,
  get language() {
    return currentLanguage;
  },
  translate,
};

const turnOf = (pokemonId: string) => ({ type: BattleEventType.TurnStarted, pokemonId }) as const;

function entryTexts(root: FakeElement): (string | null)[] {
  return root.findAllByTestId("battle-log-entry").map((entry) => entry.textContent);
}

/** Le journal et sa racine vue comme le faux DOM qui la porte. */
function mountLog(teamOf: (pokemonId: string) => number | null = () => null): {
  log: ReturnType<typeof createBattleLog>;
  root: FakeElement;
} {
  const log = createBattleLog({ context, teamOf, translate });
  return { log, root: log.element as unknown as FakeElement };
}

describe("createBattleLog — relocalize (plan 221)", () => {
  beforeEach(() => {
    currentLanguage = "fr";
    vi.stubGlobal("document", { createElement: () => new FakeElement() });
    pendingFrames.length = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rewrites every existing line in the new language, keeping order and count", () => {
    const { log, root } = mountLog(() => 1);
    log.report(turnOf("p1-bulbasaur"));
    log.report(turnOf("p2-charmander"));
    log.report(turnOf("p1-bulbasaur"));
    expect(entryTexts(root)).toEqual([
      "fr:battleLog.turnStarted(Bulbizarre)",
      "fr:battleLog.turnStarted(Salamèche)",
      "fr:battleLog.turnStarted(Bulbizarre)",
    ]);

    currentLanguage = "en";
    log.relocalize();

    expect(entryTexts(root)).toEqual([
      "en:battleLog.turnStarted(Bulbasaur)",
      "en:battleLog.turnStarted(Charmander)",
      "en:battleLog.turnStarted(Bulbasaur)",
    ]);
  });

  it("retranslates the panel title", () => {
    const { log, root } = mountLog();
    const [title] = root.findAllByTestId("battle-log-title");
    expect(title?.textContent).toBe("fr:log.title");

    currentLanguage = "en";
    log.relocalize();

    expect(title?.textContent).toBe("en:log.title");
  });

  it("keeps lines reported after a relocalize in the new language, after the rewritten ones", () => {
    const { log, root } = mountLog();
    log.report(turnOf("p1-bulbasaur"));
    currentLanguage = "en";
    log.relocalize();
    log.report(turnOf("p2-charmander"));

    expect(entryTexts(root)).toEqual([
      "en:battleLog.turnStarted(Bulbasaur)",
      "en:battleLog.turnStarted(Charmander)",
    ]);
  });

  it("mutes the live region during the rewrite and restores it on the next frame", () => {
    const { log, root } = mountLog();
    log.report(turnOf("p1-bulbasaur"));
    const list = root.children.find((child) => child.className === "bl-list");
    expect(list?.getAttribute("aria-live")).toBe("polite");

    log.relocalize();
    expect(list?.getAttribute("aria-live")).toBeNull();

    for (const frame of pendingFrames) {
      frame();
    }
    expect(list?.getAttribute("aria-live")).toBe("polite");
  });
});
