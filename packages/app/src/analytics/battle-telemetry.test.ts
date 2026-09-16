import { type BattleEvent, BattleEventType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { createBattleTelemetryCollector } from "./battle-telemetry";
import { AbandonSource, TeamSource } from "./telemetry";

function collector(trackedSides: number[] = [0, 1], source = TeamSource.HumanBuilt) {
  return createBattleTelemetryCollector({
    battleId: "abcd1234",
    trackedSources: new Map(trackedSides.map((side) => [side, source])),
    startedAt: 0,
    now: () => 90_000,
  });
}

function observeAll(
  target: ReturnType<typeof collector>,
  events: readonly BattleEvent[],
): ReturnType<typeof collector> {
  for (const event of events) {
    target.observe(event);
  }
  return target;
}

/**
 * Confie au collecteur ce que l'écran de combat lui donne au montage. Les valeurs par défaut
 * couvrent le cas courant des tests, qui ne s'intéressent qu'au roster.
 */
function attachRuntime(
  target: ReturnType<typeof collector>,
  pokemonIds: readonly string[],
  runtime: { localSide?: number | null; healthRatios?: Record<string, number> } = {},
): void {
  target.attachRuntime({
    pokemonIds,
    localSide: runtime.localSide ?? null,
    readHealthRatios: () => runtime.healthRatios ?? {},
  });
}

const turnStarted: BattleEvent = {
  type: BattleEventType.TurnStarted,
  pokemonId: "p1-venusaur",
} as BattleEvent;

function koOf(pokemonId: string): BattleEvent {
  return { type: BattleEventType.PokemonKo, pokemonId, countdownStart: 0 } as BattleEvent;
}

function battleEnded(winnerId: string | null): BattleEvent {
  return { type: BattleEventType.BattleEnded, winnerId } as BattleEvent;
}

describe("createBattleTelemetryCollector", () => {
  it("ne rend rien tant que le combat n'est pas terminé", () => {
    const target = observeAll(collector(), [turnStarted, koOf("p2-crobat")]);

    expect(target.buildEndedPayload()).toBeNull();
  });

  it("range une partie jouée jusqu'au bout en `combat`", () => {
    const target = observeAll(collector(), [
      turnStarted,
      koOf("p2-crobat"),
      battleEnded("player-1"),
    ]);

    expect(target.buildEndedPayload()?.endReason).toBe("combat");
  });

  it("range une partie quittée en `forfeit`", () => {
    const target = observeAll(collector(), [
      turnStarted,
      { type: BattleEventType.PlayerForfeited, playerId: "player-2" },
      koOf("p2-crobat"),
      battleEnded("player-1"),
    ]);

    expect(target.buildEndedPayload()?.endReason).toBe("forfeit");
  });

  it("qualifie d'abandon les K.O. du camp qui a quitté", () => {
    const target = observeAll(collector(), [
      turnStarted,
      { type: BattleEventType.PlayerForfeited, playerId: "player-2" },
      koOf("p2-crobat"),
      battleEnded("player-1"),
    ]);

    const outcome = target
      .buildEndedPayload()
      ?.outcomes.find((entry) => entry.species === "crobat");
    expect(outcome?.knockedOutCause).toBe("forfeit");
  });

  it("laisse les K.O. des autres camps à leur cause réelle", () => {
    const target = observeAll(collector(), [
      turnStarted,
      koOf("p1-venusaur"),
      { type: BattleEventType.PlayerForfeited, playerId: "player-2" },
      koOf("p2-crobat"),
      battleEnded(null),
    ]);

    const payload = target.buildEndedPayload();
    const venusaur = payload?.outcomes.find((entry) => entry.species === "venusaur");
    const crobat = payload?.outcomes.find((entry) => entry.species === "crobat");
    expect(venusaur?.knockedOutCause).not.toBe("forfeit");
    expect(crobat?.knockedOutCause).toBe("forfeit");
  });

  it("reporte le camp vainqueur et le match nul", () => {
    const won = observeAll(collector(), [turnStarted, battleEnded("player-2")]);
    const drawn = observeAll(collector(), [turnStarted, battleEnded(null)]);

    expect(won.buildEndedPayload()).toMatchObject({ winnerSide: 1, draw: false });
    expect(drawn.buildEndedPayload()).toMatchObject({ winnerSide: null, draw: true });
  });

  it("ignore les camps dont la composition n'a pas voyagé", () => {
    const target = observeAll(collector([0]), [
      turnStarted,
      { type: BattleEventType.PlayerForfeited, playerId: "player-2" },
      koOf("p2-crobat"),
      battleEnded("player-1"),
    ]);

    expect(target.buildEndedPayload()?.outcomes).toEqual([]);
  });
});

describe("provenance et camp portés par chaque issue (plan 212, Lot E)", () => {
  it("étiquette chaque issue de la provenance de son camp", () => {
    const target = createBattleTelemetryCollector({
      battleId: "abcd1234",
      trackedSources: new Map([
        [0, TeamSource.HumanBuilt],
        [1, TeamSource.HumanRandom],
      ]),
      startedAt: 0,
      now: () => 90_000,
    });
    observeAll(target, [
      turnStarted,
      koOf("p1-venusaur"),
      koOf("p2-crobat"),
      battleEnded("player-1"),
    ]);

    const payload = target.buildEndedPayload();
    expect(payload?.outcomes.find((entry) => entry.species === "venusaur")).toMatchObject({
      source: "human-built",
      side: 0,
    });
    expect(payload?.outcomes.find((entry) => entry.species === "crobat")).toMatchObject({
      source: "human-random",
      side: 1,
    });
  });

  it("suit désormais les équipes aléatoires tenues par un humain", () => {
    const target = createBattleTelemetryCollector({
      battleId: "abcd1234",
      trackedSources: new Map([[1, TeamSource.HumanRandom]]),
      startedAt: 0,
      now: () => 90_000,
    });
    observeAll(target, [turnStarted, koOf("p2-crobat"), battleEnded("player-1")]);

    // Avant le plan 212 cette issue n'existait pas : `trackedSidesOf` ne retenait que `human-built`.
    expect(target.buildEndedPayload()?.outcomes).toHaveLength(1);
  });

  it("🔴 garde un Pokemon posé qui n'a ni agi ni chuté", () => {
    const target = collector([0]);
    attachRuntime(target, ["p1-venusaur", "p1-pikachu"]);
    observeAll(target, [turnStarted, koOf("p1-venusaur"), battleEnded("player-2")]);

    const survivor = target
      .buildEndedPayload()
      ?.outcomes.find((entry) => entry.species === "pikachu");
    // Sans le semis, `outcomes` se bâtissait de `moveCounts` ∪ `knockOuts` : un survivant passif
    // était absent, donc la survie ne comptait que les morts.
    expect(survivor).toMatchObject({ knockedOutTurn: null, knockedOutCause: null });
  });

  it("ne sème pas les camps qu'on ne suit pas", () => {
    const target = collector([0]);
    attachRuntime(target, ["p2-crobat"]);
    observeAll(target, [turnStarted, battleEnded("player-1")]);

    expect(target.buildEndedPayload()?.outcomes).toEqual([]);
  });
});

describe("abandon et fin ne coexistent jamais (plan 212, Lot F)", () => {
  it("bâtit un abandon sur une partie en cours", () => {
    const target = observeAll(collector(), [turnStarted, turnStarted]);
    attachRuntime(target, [], { localSide: 0, healthRatios: { "0": 0.2, "1": 0.9 } });

    expect(target.buildAbandonedPayload(AbandonSource.Menu)).toMatchObject({
      battleId: "abcd1234",
      turns: 2,
      durationMs: 90_000,
      from: "menu",
      side: 0,
      healthRatios: { "0": 0.2, "1": 0.9 },
    });
  });

  it("🔴 refuse de bâtir un abandon sur une partie terminée", () => {
    const target = observeAll(collector(), [turnStarted, battleEnded("player-1")]);

    // Le verrou qui empêche un double comptage : une partie gagnée puis dont l'onglet se ferme ne
    // doit pas produire d'abandon fantôme, sans quoi le taux serait faux sans rien casser de visible.
    expect(target.buildAbandonedPayload(AbandonSource.TabClosed)).toBeNull();
  });

  it("🔴 refuse de bâtir une fin sur une partie seulement abandonnée", () => {
    const target = observeAll(collector(), [turnStarted]);
    target.buildAbandonedPayload(AbandonSource.Menu);

    expect(target.buildEndedPayload()).toBeNull();
  });
});
