import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTelemetryStub, type TelemetryStub } from "../testing/telemetry-stub";

vi.mock("../i18n", () => ({ getLanguage: () => "fr" }));

const ITCH_HOST = "html-classic.itch.zone";
const PAGES_HOST = "kekel87.github.io";

/**
 * `telemetry.ts` porte des compteurs et un drapeau `first` au niveau du module : chaque test doit
 * repartir d'un module neuf, sinon les visites se mélangent.
 */
async function loadTelemetry(stub: TelemetryStub) {
  vi.resetModules();
  vi.stubGlobal("window", stub.window);
  vi.stubGlobal("document", stub.document);
  vi.stubGlobal("navigator", stub.navigator);
  vi.stubGlobal("__APP_VERSION__", "v2026.9.1");
  return import("./telemetry");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("garde-fou local", () => {
  it.each(["localhost", "127.0.0.1", "example.test"])(
    "n'envoie RIEN depuis %s",
    async (hostname) => {
      const stub = createTelemetryStub({ hostname });
      const telemetry = await loadTelemetry(stub);

      telemetry.countScreen(telemetry.TelemetryScreen.MainMenu);
      telemetry.flushSession();
      telemetry.trackBattleStarted({
        battleId: "abcd1234",
        mode: "local-vs-ai",
        map: "forest",
        format: "2v6",
        humans: 1,
        ai: 1,
        autoPlacement: true,
        teams: [],
      });

      expect(stub.beacon.envelopes).toEqual([]);
    },
  );
});

describe("enveloppe", () => {
  let stub: TelemetryStub;

  beforeEach(() => {
    stub = createTelemetryStub({ hostname: PAGES_HOST });
  });

  it("porte le type, le build et la plateforme", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.flushSession();

    expect(stub.beacon.envelopes[0]).toMatchObject({
      kind: "session",
      build: "v2026.9.1",
      platform: "ghp",
    });
  });

  it("vise le chemin anodin `/e` et non un motif que les bloqueurs ciblent", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.flushSession();

    expect(stub.beacon.urls[0]).toMatch(/\/e$/);
    expect(stub.beacon.urls[0]).not.toMatch(/analytics|track|collect|count/);
  });

  it("préfixe `itch` sous l'iframe itch.io", async () => {
    const itchStub = createTelemetryStub({ hostname: ITCH_HOST });
    const telemetry = await loadTelemetry(itchStub);

    telemetry.flushSession();

    expect(itchStub.beacon.envelopes[0]).toMatchObject({ platform: "itch" });
  });
});

describe("compteurs de visite", () => {
  let stub: TelemetryStub;

  beforeEach(() => {
    stub = createTelemetryStub({ hostname: PAGES_HOST, inputSource: "gamepad", screenWidth: 1440 });
  });

  it("envoie la première ligne MÊME sans aucun compteur, sinon les visites seraient incomptables", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.flushSession();

    expect(stub.beacon.envelopes).toHaveLength(1);
    expect(stub.beacon.envelopes[0]?.payload).toMatchObject({ first: true });
  });

  it("ne marque `first` que sur la première ligne de la visite", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.flushSession();
    telemetry.countScreen(telemetry.TelemetryScreen.Credits);
    telemetry.flushSession();

    expect(stub.beacon.envelopes).toHaveLength(2);
    expect(stub.beacon.envelopes[1]?.payload).not.toMatchObject({ first: true });
  });

  it("n'envoie rien de plus quand il n'y a plus rien à dire", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.flushSession();
    telemetry.flushSession();
    telemetry.flushSession();

    expect(stub.beacon.envelopes).toHaveLength(1);
  });

  it("envoie des DELTAS et non un cumul, pour que les lignes s'additionnent à la lecture", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.countScreen(telemetry.TelemetryScreen.MainMenu);
    telemetry.flushSession();
    telemetry.countScreen(telemetry.TelemetryScreen.MainMenu);
    telemetry.flushSession();

    const first = stub.beacon.envelopes[0]?.payload as { screens: Record<string, number> };
    const second = stub.beacon.envelopes[1]?.payload as { screens: Record<string, number> };
    expect(first.screens).toEqual({ "main-menu": 1 });
    expect(second.screens).toEqual({ "main-menu": 1 });
  });

  it("agrège les écrans et les actions de la visite", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.countScreen(telemetry.TelemetryScreen.MainMenu);
    telemetry.countScreen(telemetry.TelemetryScreen.MainMenu);
    telemetry.countScreen(telemetry.TelemetryScreen.MapSelect);
    telemetry.countAction(telemetry.TelemetryAction.ShowdownImportFail);
    telemetry.flushSession();

    expect(stub.beacon.envelopes[0]?.payload).toMatchObject({
      screens: { "main-menu": 2, "map-select": 1 },
      actions: { "showdown-import-fail": 1 },
    });
  });

  it("joint le contexte de visite, l'écran en PALIER et jamais au pixel", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.flushSession();

    expect(stub.beacon.envelopes[0]?.payload).toMatchObject({
      uiLanguage: "fr",
      inputSource: "gamepad",
      screen: "1280-1919",
      referrer: null,
    });
  });

  it.each([
    [2560, ">=1920"],
    [1920, ">=1920"],
    [1600, "1280-1919"],
    [1024, "768-1279"],
    [420, "<768"],
  ])("classe une largeur de %s px en palier %s", async (width, expected) => {
    const scoped = createTelemetryStub({ hostname: PAGES_HOST, screenWidth: width });
    const telemetry = await loadTelemetry(scoped);

    telemetry.flushSession();

    expect(scoped.beacon.envelopes[0]?.payload).toMatchObject({ screen: expected });
  });
});

describe("déclencheurs de fin de vie de page", () => {
  it("envoie au passage en arrière-plan", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const telemetry = await loadTelemetry(stub);
    telemetry.initTelemetry();

    stub.emitVisibilityChange("hidden");

    expect(stub.beacon.envelopes).toHaveLength(1);
  });

  it("n'envoie pas quand l'onglet redevient visible", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const telemetry = await loadTelemetry(stub);
    telemetry.initTelemetry();

    stub.emitVisibilityChange("visible");

    expect(stub.beacon.envelopes).toEqual([]);
  });

  it("🔴 envoie à `pagehide` — le cas de la fermeture d'onglet, raté en production le 2026-09-02", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const telemetry = await loadTelemetry(stub);
    telemetry.initTelemetry();

    stub.emitPageHide();

    expect(stub.beacon.envelopes).toHaveLength(1);
  });

  it("ne double PAS l'envoi quand les deux événements partent, les deltas rendant l'opération idempotente", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const telemetry = await loadTelemetry(stub);
    telemetry.initTelemetry();

    stub.emitVisibilityChange("hidden");
    stub.emitPageHide();

    expect(stub.beacon.envelopes).toHaveLength(1);
  });

  it("n'installe ses écouteurs qu'une fois", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const telemetry = await loadTelemetry(stub);
    telemetry.initTelemetry();
    telemetry.initTelemetry();

    stub.emitPageHide();

    expect(stub.beacon.envelopes).toHaveLength(1);
  });
});

describe("événements de partie", () => {
  let stub: TelemetryStub;

  beforeEach(() => {
    stub = createTelemetryStub({ hostname: PAGES_HOST });
  });

  it("envoie `battle_started` immédiatement, sans attendre un envoi groupé", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.trackBattleStarted({
      battleId: "abcd1234",
      mode: "local-vs-ai",
      map: "the-wall",
      format: "2v6",
      humans: 1,
      ai: 1,
      autoPlacement: false,
      teams: [{ side: 0, source: telemetry.TeamSource.HumanBuilt, members: [] }],
    });

    expect(stub.beacon.envelopes).toHaveLength(1);
    expect(stub.beacon.envelopes[0]).toMatchObject({ kind: "battle_started" });
    expect(stub.beacon.envelopes[0]?.payload).toMatchObject({ map: "the-wall", humans: 1 });
  });

  it("envoie `battle_ended` avec l'issue et le détail par Pokemon", async () => {
    const telemetry = await loadTelemetry(stub);

    telemetry.trackBattleEnded({
      battleId: "abcd1234",
      winnerSide: 0,
      draw: false,
      durationMs: 90_000,
      turns: 14,
      outcomes: [
        {
          species: "venusaur",
          moves: { "giga-drain": 3 },
          knockedOutTurn: null,
          knockedOutCause: null,
        },
      ],
    });

    expect(stub.beacon.envelopes[0]).toMatchObject({ kind: "battle_ended" });
    expect(stub.beacon.envelopes[0]?.payload).toMatchObject({ winnerSide: 0, turns: 14 });
  });
});

describe("createBattleId", () => {
  it("rend un identifiant court, et un différent à chaque partie", async () => {
    const telemetry = await loadTelemetry(createTelemetryStub({ hostname: PAGES_HOST }));

    const first = telemetry.createBattleId();
    const second = telemetry.createBattleId();

    expect(first).toMatch(/^[0-9a-f]{8}$/);
    expect(first).not.toBe(second);
  });
});

describe("robustesse", () => {
  it("ne laisse JAMAIS remonter une exception d'envoi dans l'appelant", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const telemetry = await loadTelemetry(stub);
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("beacon indisponible");
      },
    });

    expect(() => telemetry.flushSession()).not.toThrow();
  });

  it("bascule sur le repli `fetch` quand `sendBeacon` refuse la mise en file", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST, beaconQueued: false });
    const telemetry = await loadTelemetry(stub);
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchSpy);

    telemetry.flushSession();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/e$/),
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });
});
