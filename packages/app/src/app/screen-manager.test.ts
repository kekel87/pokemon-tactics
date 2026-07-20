import { describe, expect, it } from "vitest";
import { type Screen, ScreenManager, type ScreenRegistry } from "./screen-manager";
import { SCREEN_TRANSITIONS, type ScreenId, type ScreenParamsById } from "./screens";

const hostStub = {} as HTMLElement;

const PARAMS: ScreenParamsById = {
  "main-menu": undefined,
  "battle-mode": undefined,
  "map-select": undefined,
  "team-select": { mapUrl: "maps/volcano.tmj" },
  "my-teams": undefined,
  "team-edit": { teamId: "team-1" },
  settings: undefined,
  credits: undefined,
  combat: { mapUrl: "maps/volcano.tmj" },
};

const ALL_SCREEN_IDS = Object.keys(SCREEN_TRANSITIONS) as ScreenId[];

interface Harness {
  manager: ScreenManager;
  events: string[];
}

function createHarness(mountDelayMs = 0): Harness {
  const events: string[] = [];
  const makeScreen = (id: ScreenId): Screen => ({
    mount: () => {
      if (mountDelayMs === 0) {
        events.push(`mount:${id}`);
        return;
      }
      return new Promise((resolveMount) => {
        setTimeout(() => {
          events.push(`mount:${id}`);
          resolveMount();
        }, mountDelayMs);
      });
    },
    dispose: () => {
      events.push(`dispose:${id}`);
    },
  });
  const registry = Object.fromEntries(
    ALL_SCREEN_IDS.map((id) => [id, () => makeScreen(id)]),
  ) as ScreenRegistry;
  return { manager: new ScreenManager(hostStub, registry), events };
}

describe("ScreenManager", () => {
  it("mounts the boot screen via start()", async () => {
    const { manager, events } = createHarness();
    await manager.start("main-menu", undefined);
    expect(events).toEqual(["mount:main-menu"]);
    expect(manager.current).toBe("main-menu");
  });

  it("accepts every legal transition of the table", async () => {
    for (const from of ALL_SCREEN_IDS) {
      for (const to of SCREEN_TRANSITIONS[from]) {
        const { manager } = createHarness();
        await manager.start(from, PARAMS[from]);
        await manager.navigate(to, PARAMS[to]);
        expect(manager.current).toBe(to);
      }
    }
  });

  it("disposes the current screen before mounting the next", async () => {
    const { manager, events } = createHarness();
    await manager.start("main-menu", undefined);
    await manager.navigate("battle-mode", undefined);
    expect(events).toEqual(["mount:main-menu", "dispose:main-menu", "mount:battle-mode"]);
  });

  it("rejects an illegal transition and keeps the current screen", async () => {
    const { manager } = createHarness();
    await manager.start("settings", undefined);
    await expect(manager.navigate("combat", PARAMS.combat)).rejects.toThrow(
      "Illegal screen transition: settings → combat",
    );
    expect(manager.current).toBe("settings");
  });

  it("rejects every transition absent from the table", async () => {
    for (const from of ALL_SCREEN_IDS) {
      const legal = SCREEN_TRANSITIONS[from];
      for (const to of ALL_SCREEN_IDS.filter((id) => !legal.includes(id))) {
        const { manager } = createHarness();
        await manager.start(from, PARAMS[from]);
        await expect(manager.navigate(to, PARAMS[to])).rejects.toThrow(
          `Illegal screen transition: ${from} → ${to}`,
        );
        expect(manager.current).toBe(from);
      }
    }
  });

  it("stays usable after a rejected transition", async () => {
    const { manager } = createHarness();
    await manager.start("settings", undefined);
    await expect(manager.navigate("combat", PARAMS.combat)).rejects.toThrow();
    await manager.navigate("main-menu", undefined);
    expect(manager.current).toBe("main-menu");
  });

  it("passes params to mount()", async () => {
    const received: unknown[] = [];
    const screen: Screen = {
      mount: (_mountHost, params) => {
        received.push(params);
      },
      dispose: () => undefined,
    };
    const registry = Object.fromEntries(
      ALL_SCREEN_IDS.map((id) => [id, () => screen]),
    ) as ScreenRegistry;
    const manager = new ScreenManager(hostStub, registry);
    await manager.start("team-select", { mapUrl: "maps/desert.tmj" });
    expect(received).toEqual([{ mapUrl: "maps/desert.tmj" }]);
  });

  it("serializes navigations issued during an async mount", async () => {
    const { manager, events } = createHarness(5);
    const boot = manager.start("main-menu", undefined);
    const first = manager.navigate("battle-mode", undefined);
    const second = manager.navigate("map-select", undefined);
    await Promise.all([boot, first, second]);
    expect(events).toEqual([
      "mount:main-menu",
      "dispose:main-menu",
      "mount:battle-mode",
      "dispose:battle-mode",
      "mount:map-select",
    ]);
    expect(manager.current).toBe("map-select");
  });

  it("walks the full battle path and back to the menu (gate path A)", async () => {
    const { manager } = createHarness();
    await manager.start("main-menu", undefined);
    await manager.navigate("battle-mode", undefined);
    await manager.navigate("map-select", undefined);
    await manager.navigate("team-select", PARAMS["team-select"]);
    await manager.navigate("combat", PARAMS.combat);
    await manager.navigate("main-menu", undefined);
    expect(manager.current).toBe("main-menu");
  });
});
