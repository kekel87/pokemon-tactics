import { type BattleEvent, BattleEventType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { createBattleTelemetryCollector } from "./battle-telemetry";

function collector(trackedSides: number[] = [0, 1]) {
  return createBattleTelemetryCollector({
    battleId: "abcd1234",
    trackedSides: new Set(trackedSides),
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
