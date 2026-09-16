import {
  type BattleEvent,
  BattleEventType,
  PlayerController,
  type TeamSelection,
} from "@pokemon-tactic/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelemetryStub, type TelemetryStub } from "../testing/telemetry-stub";
import { AbandonSource, TeamSource, type TelemetryTeam } from "./telemetry";

/**
 * L'identifiant de partie, du setup jusqu'à l'événement émis (plan 204).
 *
 * 🔴 **Ce que ce fichier couvre, et ce qu'il ne couvre pas.** En ligne, les deux pairs émettent
 * chacun leur `battle_started` et leur `battle_ended` : sans identifiant commun, rien à la lecture
 * ne dit que ces lignes sont la même partie. Le protocole, le transport et l'agrégation ont leurs
 * propres tests ; ici on éprouve le dernier maillon *testable en unitaire* — que l'identifiant reçu
 * soit celui qui part, sur les DEUX événements, et qu'en son absence un identifiant soit tiré.
 *
 * Le maillon restant — le setup qui atteint cette fonction depuis l'écran de combat — n'est pas
 * observable ici : il est pris en e2e, à deux navigateurs (`e2e/tests/dom/online-lobby.spec.ts`,
 * §11.1 (e)), parce que la décision #979 a montré qu'un passe-plat bâti par `...` conditionnels
 * jette un champ EN SILENCE sans que le compilateur ni un test unitaire ne le voient.
 */

// `telemetry.ts` lit la langue à chaque envoi, et `team-telemetry.ts` le préfixe des équipes
// générées. Ni l'un ni l'autre ne compte ici, mais les deux exports doivent exister.
vi.mock("../i18n", () => ({ getLanguage: () => "fr", t: (key: string) => key }));

/** Un hôte de publication : hors de cette liste, la télémétrie est muette et rien n'est capturé. */
const PAGES_HOST = "kekel87.github.io";

/**
 * `telemetry.ts` porte des compteurs de module, et `battle-telemetry-session.ts` la partie en
 * cours : chaque test repart d'un graphe neuf, sinon deux parties se chevauchent.
 */
async function loadSession(stub: TelemetryStub) {
  vi.resetModules();
  vi.stubGlobal("window", stub.window);
  vi.stubGlobal("document", stub.document);
  vi.stubGlobal("navigator", stub.navigator);
  vi.stubGlobal("__APP_VERSION__", "v2026.9.1");
  return import("./battle-telemetry-session");
}

/** Les deux places d'une partie en ligne : la distante est rabattue sur `human` dans le setup. */
const ONLINE_TEAMS: readonly TeamSelection[] = [
  { playerId: "player-1", pokemonDefinitionIds: ["alakazam"], controller: PlayerController.Human },
  { playerId: "player-2", pokemonDefinitionIds: ["abra"], controller: PlayerController.Human },
];

/** Notre camp, et lui seul — c'est l'invariant du plan 201 que la déduplication doit préserver. */
const LOCAL_SIDE: readonly TelemetryTeam[] = [
  {
    side: 0,
    source: TeamSource.HumanBuilt,
    members: [
      {
        species: "alakazam",
        ability: "synchronize",
        item: null,
        nature: "timid",
        moves: ["shadow-ball"],
      },
    ],
  },
];

const SETUP = {
  mapUrl: "assets/maps/simple-arena.tmj",
  formatKey: "2v1",
  autoPlacement: true,
  damagePreview: true,
  telemetryTeams: LOCAL_SIDE,
  teams: ONLINE_TEAMS,
} as const;

const battleEnded: BattleEvent = {
  type: BattleEventType.BattleEnded,
  winnerId: "player-1",
};

/** L'identifiant des deux événements de l'enveloppe capturée, dans l'ordre d'émission. */
function emittedBattleIds(stub: TelemetryStub): { kind: unknown; battleId: unknown }[] {
  return stub.beacon.envelopes.map((envelope) => ({
    kind: envelope.kind,
    battleId: (envelope.payload as { battleId?: unknown }).battleId,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("beginBattleTelemetry", () => {
  it("émet `battle_started` sous l'identifiant reçu de l'hôte", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);

    session.beginBattleTelemetry({ ...SETUP, localSeat: 1, battleId: "deadbeef" });

    expect(emittedBattleIds(stub)).toEqual([{ kind: "battle_started", battleId: "deadbeef" }]);
  });

  it("clôt la partie sous le MÊME identifiant, sans quoi la déduplication ne rapproche rien", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);

    session.beginBattleTelemetry({ ...SETUP, localSeat: 1, battleId: "deadbeef" });
    session.observeBattleTelemetry(battleEnded);
    session.endBattleTelemetry();

    expect(emittedBattleIds(stub)).toEqual([
      { kind: "battle_started", battleId: "deadbeef" },
      { kind: "battle_ended", battleId: "deadbeef" },
    ]);
  });

  it("tire son propre identifiant en local, où personne n'en apporte", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);

    session.beginBattleTelemetry(SETUP);
    session.observeBattleTelemetry(battleEnded);
    session.endBattleTelemetry();

    const [started, ended] = emittedBattleIds(stub);
    expect(started?.battleId).toMatch(/^[0-9a-f]{8}$/);
    expect(ended?.battleId).toBe(started?.battleId);
  });
});

/**
 * L'exclusivité entre `battle_ended` et `battle_abandoned` (plan 212, Lot F).
 *
 * 🔴 Pourquoi ce fichier plutôt que celui du collecteur : le collecteur se garde lui-même (il refuse
 * de bâtir un abandon sur une partie finie), mais c'est la SESSION qui met la référence à `null`, et
 * c'est ce second verrou qui empêche l'onglet fermé après une victoire de produire un abandon
 * fantôme. Un double comptage ici rendrait le taux faux sans que rien n'ait l'air cassé.
 */
describe("une partie émet une fin OU un abandon, jamais les deux", () => {
  it("émet un abandon quand le joueur quitte en cours de partie", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.beginBattleTelemetry({ ...SETUP, battleId: "aaaa1111" });
    session.abandonBattleTelemetry(AbandonSource.Menu);

    expect(emittedBattleIds(stub)).toEqual([
      { kind: "battle_started", battleId: "aaaa1111" },
      { kind: "battle_abandoned", battleId: "aaaa1111" },
    ]);
  });

  it("🔴 ne produit aucun abandon fantôme après une victoire", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.beginBattleTelemetry({ ...SETUP, battleId: "bbbb2222" });
    session.observeBattleTelemetry(battleEnded);
    session.endBattleTelemetry();
    // L'onglet se ferme juste après : le cas exact que `pagehide` déclenche en production.
    session.abandonBattleTelemetry(AbandonSource.TabClosed);

    expect(emittedBattleIds(stub)).toEqual([
      { kind: "battle_started", battleId: "bbbb2222" },
      { kind: "battle_ended", battleId: "bbbb2222" },
    ]);
  });

  it("🔴 ne produit aucune fin après un abandon", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.beginBattleTelemetry({ ...SETUP, battleId: "cccc3333" });
    session.abandonBattleTelemetry(AbandonSource.Diverged);
    session.endBattleTelemetry();

    expect(emittedBattleIds(stub)).toEqual([
      { kind: "battle_started", battleId: "cccc3333" },
      { kind: "battle_abandoned", battleId: "cccc3333" },
    ]);
  });

  it("reste muet hors d'une partie mesurée — bac à sable, reprise", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.abandonBattleTelemetry(AbandonSource.Menu);

    expect(stub.beacon.envelopes).toEqual([]);
  });
});

/**
 * Le dernier des trois chemins de départ du Lot F : **l'onglet qu'on ferme**.
 *
 * 🔴 Les tests ci-dessus appellent `abandonBattleTelemetry` à la main — ils éprouvent le verrou, pas
 * le POINT D'ÉMISSION. Or `tab-closed` n'a pas d'appelant dans l'écran de combat : il part d'un
 * écouteur `pagehide` posé par `attachBattleRuntime`, et un écouteur jamais posé est exactement le
 * défaut que le plan 212 existe pour trouver — un compteur déclaré et jamais émis donne l'illusion
 * de la mesure. C'est aussi le seul des six compteurs du plan dont le point d'émission soit
 * atteignable sans Babylon.
 */
describe("l'onglet qui se ferme sur une partie en cours (plan 212, Lot F)", () => {
  /** Ce que l'écran de combat confie à l'analytique une fois le combat monté. */
  const RUNTIME = {
    pokemonIds: ["alakazam"],
    localSide: 0,
    readHealthRatios: () => ({ "0": 1, "1": 1 }),
  } as const;

  it("émet `battle_abandoned` sur `pagehide`, sans qu'aucun appelant ne le demande", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.beginBattleTelemetry({ ...SETUP, battleId: "dddd4444" });
    session.attachBattleRuntime({ ...RUNTIME });

    stub.emitPageHide();

    expect(stub.beacon.envelopes.map((envelope) => envelope.kind)).toEqual([
      "battle_started",
      "battle_abandoned",
    ]);
    expect(stub.beacon.envelopes[1]?.payload).toMatchObject({
      battleId: "dddd4444",
      from: AbandonSource.TabClosed,
      side: 0,
    });
  });

  it("🔴 ne produit aucun abandon fantôme quand l'onglet se ferme APRÈS la victoire", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.beginBattleTelemetry({ ...SETUP, battleId: "eeee5555" });
    session.attachBattleRuntime({ ...RUNTIME });
    session.observeBattleTelemetry(battleEnded);
    session.endBattleTelemetry();

    stub.emitPageHide();

    expect(stub.beacon.envelopes.map((envelope) => envelope.kind)).toEqual([
      "battle_started",
      "battle_ended",
    ]);
  });

  it("🔴 lit les PV à l'instant du DÉPART, jamais ceux du montage", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.beginBattleTelemetry({ ...SETUP, battleId: "ffff6666" });
    // Le combat tourne : ce que la fonction rend change entre le montage et le départ, et c'est
    // pour ça que l'analytique reçoit une FONCTION et non un instantané.
    let ratios: Record<string, number> = { "0": 1, "1": 1 };
    session.attachBattleRuntime({ ...RUNTIME, readHealthRatios: () => ratios });
    ratios = { "0": 0.15, "1": 0.8 };

    session.abandonBattleTelemetry(AbandonSource.Menu);

    expect(stub.beacon.envelopes[1]?.payload).toMatchObject({
      from: AbandonSource.Menu,
      healthRatios: { "0": 0.15, "1": 0.8 },
    });
  });

  it("n'installe qu'un seul écouteur de fermeture, quel que soit le nombre de combats montés", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.beginBattleTelemetry({ ...SETUP, battleId: "aaaa7777" });
    session.attachBattleRuntime({ ...RUNTIME });
    session.endBattleTelemetry();
    session.beginBattleTelemetry({ ...SETUP, battleId: "bbbb8888" });
    session.attachBattleRuntime({ ...RUNTIME });

    // Deux écouteurs feraient partir deux abandons pour une seule fermeture, donc un taux faux.
    expect(stub.listenerCount("pagehide")).toBe(1);
  });

  it("reste muet hors d'une partie mesurée : le bac à sable ne monte aucun collecteur", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const session = await loadSession(stub);
    session.attachBattleRuntime({ ...RUNTIME });

    stub.emitPageHide();

    expect(stub.beacon.envelopes).toEqual([]);
  });
});
