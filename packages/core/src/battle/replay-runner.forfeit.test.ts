import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { ForfeitReason } from "../enums/forfeit-reason";
import { PlayerId } from "../enums/player-id";
import { buildThreeCampEngine, endActiveTurn } from "../testing";
import type { BattleEvent } from "../types/battle-event";
import { dueForfeit, runReplay } from "./replay-runner";
import { battleStateChecksum } from "./state-checksum";

function eventTypes(batches: readonly (readonly BattleEvent[])[]): string[] {
  return batches.flat().map((event) => event.type);
}

describe("replay — abandons (plan 243)", () => {
  it("n'ajoute aucun champ au replay d'une partie sans abandon", () => {
    const engine = buildThreeCampEngine();
    endActiveTurn(engine);

    expect(Object.keys(engine.exportReplay())).toEqual(["seed", "actions"]);
  });

  it("enregistre l'abandon avec sa place dans le journal et son motif", () => {
    const engine = buildThreeCampEngine();
    endActiveTurn(engine);
    endActiveTurn(engine);

    engine.forfeit(PlayerId.Player3, ForfeitReason.Disconnected);

    expect(engine.exportReplay().forfeits).toEqual([
      { afterAction: 2, playerId: PlayerId.Player3, reason: ForfeitReason.Disconnected },
    ]);
    expect(engine.forfeitLogLength).toBe(1);
  });

  it("n'enregistre pas un abandon refusé", () => {
    const engine = buildThreeCampEngine();
    engine.forfeit(PlayerId.Player3);

    engine.forfeit(PlayerId.Player3);

    expect(engine.exportReplay().forfeits).toHaveLength(1);
  });

  it("rejoue une partie à trois jusqu'au vainqueur après un abandon au milieu", () => {
    const live = buildThreeCampEngine();
    endActiveTurn(live);
    live.forfeit(PlayerId.Player3, ForfeitReason.Resigned);
    endActiveTurn(live);
    endActiveTurn(live);
    live.forfeit(PlayerId.Player2);

    const batches: BattleEvent[][] = [];
    const replayed = runReplay(
      live.exportReplay(),
      () => buildThreeCampEngine(),
      (events) => batches.push([...events]),
    );

    expect(battleStateChecksum(replayed.getGameState(""))).toBe(
      battleStateChecksum(live.getGameState("")),
    );
    expect(eventTypes(batches).filter((type) => type === BattleEventType.PlayerForfeited)).toEqual([
      BattleEventType.PlayerForfeited,
      BattleEventType.PlayerForfeited,
    ]);
    expect(eventTypes(batches).at(-1)).toBe(BattleEventType.BattleEnded);
  });

  it("rejoue un abandon survenu avant la première action", () => {
    const live = buildThreeCampEngine();
    live.forfeit(PlayerId.Player1);
    endActiveTurn(live);

    const replayed = runReplay(live.exportReplay(), () => buildThreeCampEngine());

    expect(battleStateChecksum(replayed.getGameState(""))).toBe(
      battleStateChecksum(live.getGameState("")),
    );
  });

  it("garde l'ordre de deux abandons au même rang", () => {
    const live = buildThreeCampEngine();
    endActiveTurn(live);
    live.forfeit(PlayerId.Player3);
    live.forfeit(PlayerId.Player1);

    const batches: BattleEvent[][] = [];
    runReplay(
      live.exportReplay(),
      () => buildThreeCampEngine(),
      (events) => batches.push([...events]),
    );

    const forfeited = batches
      .flat()
      .flatMap((event) => (event.type === BattleEventType.PlayerForfeited ? [event.playerId] : []));
    expect(forfeited).toEqual([PlayerId.Player3, PlayerId.Player1]);
  });

  it("un journal tronqué au rang d'un abandon le rejoue, un rang avant non", () => {
    const live = buildThreeCampEngine();
    endActiveTurn(live);
    live.forfeit(PlayerId.Player3);
    endActiveTurn(live);
    const replay = live.exportReplay();

    const atForfeit = runReplay({ ...replay, actions: replay.actions.slice(0, 1) }, () =>
      buildThreeCampEngine(),
    );
    const beforeForfeit = runReplay({ ...replay, actions: [] }, () => buildThreeCampEngine());

    expect(atForfeit.getGameState("").pokemon.get("third")?.currentHp).toBe(0);
    expect(beforeForfeit.getGameState("").pokemon.get("third")?.currentHp).toBeGreaterThan(0);
  });

  it("ne désigne un abandon dû qu'au rang exact du suivant", () => {
    const forfeits = [
      { afterAction: 1, playerId: PlayerId.Player3 },
      { afterAction: 1, playerId: PlayerId.Player1 },
    ];

    expect(dueForfeit(forfeits, { actionLogLength: 0, forfeitLogLength: 0 })).toBeUndefined();
    expect(dueForfeit(forfeits, { actionLogLength: 1, forfeitLogLength: 0 })).toBe(forfeits[0]);
    expect(dueForfeit(forfeits, { actionLogLength: 1, forfeitLogLength: 1 })).toBe(forfeits[1]);
    expect(dueForfeit(forfeits, { actionLogLength: 1, forfeitLogLength: 2 })).toBeUndefined();
  });
});
