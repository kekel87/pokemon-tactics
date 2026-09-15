import { type BattleEvent, BattleEventType, PlayerId } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { shouldAnnounceLocalElimination } from "./local-elimination";

describe("shouldAnnounceLocalElimination", () => {
  it("annonce le camp local éliminé en ligne", () => {
    const events: BattleEvent[] = [
      { type: BattleEventType.PlayerEliminated, playerId: PlayerId.Player2 },
    ];

    expect(shouldAnnounceLocalElimination(events, [PlayerId.Player2])).toBe(true);
  });

  it("ne dit rien en hot-seat, où l'écran est partagé", () => {
    const events: BattleEvent[] = [
      { type: BattleEventType.PlayerEliminated, playerId: PlayerId.Player2 },
    ];

    expect(shouldAnnounceLocalElimination(events, undefined)).toBe(false);
  });

  it("ne dit rien quand c'est un adversaire qui tombe", () => {
    const events: BattleEvent[] = [
      { type: BattleEventType.PlayerEliminated, playerId: PlayerId.Player3 },
    ];

    expect(shouldAnnounceLocalElimination(events, [PlayerId.Player2])).toBe(false);
  });

  it("laisse la place au dialogue de victoire quand la partie se termine dans le même lot", () => {
    const events: BattleEvent[] = [
      { type: BattleEventType.PlayerEliminated, playerId: PlayerId.Player2 },
      { type: BattleEventType.BattleEnded, winnerId: PlayerId.Player1 },
    ];

    expect(shouldAnnounceLocalElimination(events, [PlayerId.Player2])).toBe(false);
  });

  it("ne dit rien sans élimination", () => {
    expect(shouldAnnounceLocalElimination([], [PlayerId.Player2])).toBe(false);
  });
});
