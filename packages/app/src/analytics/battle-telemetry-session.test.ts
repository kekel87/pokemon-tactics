import {
  type BattleEvent,
  BattleEventType,
  PlayerController,
  type TeamSelection,
} from "@pokemon-tactic/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelemetryStub, type TelemetryStub } from "../testing/telemetry-stub";
import { TeamSource, type TelemetryTeam } from "./telemetry";

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
