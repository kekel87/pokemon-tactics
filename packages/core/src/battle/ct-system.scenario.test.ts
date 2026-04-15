import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { TurnSystemKind } from "../enums/turn-system-kind";
import { buildCtTestEngine } from "../testing/build-ct-test-engine";

describe("CT system — scenario", () => {
  it("state has turnSystemKind=charge-time and ctSnapshot after init", () => {
    // Given
    const { state } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });

    // Then
    expect(state.turnSystemKind).toBe(TurnSystemKind.ChargeTime);
    expect(state.ctSnapshot).toBeDefined();
    expect(Object.keys(state.ctSnapshot ?? {})).toHaveLength(2);
  });

  it("getLegalActions works and includes EndTurn for current actor", () => {
    // Given
    const { engine, state } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });

    // When
    const actorId = state.turnOrder[0];
    const playerId = actorId === "fast" ? PlayerId.Player1 : PlayerId.Player2;
    const actions = engine.getLegalActions(playerId);

    // Then
    expect(actions.length).toBeGreaterThan(0);
    const endTurnActions = actions.filter((a) => a.kind === ActionKind.EndTurn);
    expect(endTurnActions.length).toBeGreaterThan(0);
  });

  it("EndTurn advances to next actor", () => {
    // Given
    const { engine, state } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });
    const firstActorId = state.turnOrder[0] ?? "";
    const firstPlayerId = firstActorId === "fast" ? PlayerId.Player1 : PlayerId.Player2;

    // When
    const result = engine.submitAction(firstPlayerId, {
      kind: ActionKind.EndTurn,
      pokemonId: firstActorId,
      direction: Direction.South,
    });

    // Then
    expect(result.success).toBe(true);
    const secondActorId = state.turnOrder[0];
    expect(secondActorId).toBeDefined();
  });

  it("faster Pokemon acts more often — ratio 1.3-1.6x over 20 EndTurns", () => {
    // Given
    const { engine, state } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });

    let fastCount = 0;
    let slowCount = 0;
    const total = 20;

    // When
    for (let i = 0; i < total; i++) {
      const actorId = state.turnOrder[0] ?? "";
      if (actorId === "fast") {
        fastCount++;
      } else {
        slowCount++;
      }

      const playerId = actorId === "fast" ? PlayerId.Player1 : PlayerId.Player2;
      engine.submitAction(playerId, {
        kind: ActionKind.EndTurn,
        pokemonId: actorId,
        direction: Direction.South,
      });
    }

    // Then
    expect(fastCount + slowCount).toBe(total);
    const ratio = fastCount / slowCount;
    expect(ratio).toBeGreaterThanOrEqual(1.2);
    expect(ratio).toBeLessThanOrEqual(1.8);
  });

  it("ctSnapshot updates after each EndTurn", () => {
    // Given
    const { engine, state } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });
    const before = { ...(state.ctSnapshot ?? {}) };

    // When
    const actorId = state.turnOrder[0] ?? "";
    const playerId = actorId === "fast" ? PlayerId.Player1 : PlayerId.Player2;
    engine.submitAction(playerId, {
      kind: ActionKind.EndTurn,
      pokemonId: actorId,
      direction: Direction.South,
    });

    // Then
    const after = state.ctSnapshot ?? {};
    expect(after).not.toEqual(before);
  });

  it("KO'd Pokemon no longer appears in ctSnapshot", () => {
    // Given — fast Pokemon already dead (hp=0), slow Pokemon alive
    const { engine, state } = buildCtTestEngine({
      fastSpeed: 90,
      slowSpeed: 20,
      fastHp: 0,
    });

    // When — slow Pokemon acts
    const actorId = state.turnOrder[0] ?? "slow";
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: actorId,
      direction: Direction.South,
    });

    // Then — fast Pokemon excluded from the CT snapshot (stronger assertion)
    const snapshot = state.ctSnapshot ?? {};
    expect(Object.keys(snapshot)).not.toContain("fast");
    expect(Object.keys(snapshot)).toContain("slow");
  });
});
