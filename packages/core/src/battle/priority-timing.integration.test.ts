import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { MoveFailedReason } from "../enums/move-failed-reason";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../testing";

// Priorité / timing conditionnel (plan 150): end-to-end coverage of the reactive-charge wiring
// (the handle-damage hook firing during the wait window) and the conditional gates.

function duel(attackerMoves: string[], foeMoves: string[], foeInitiative = 10) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: attackerMoves,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    moveIds: foeMoves,
    derivedStats: { movement: 3, jump: 1, initiative: foeInitiative },
  });
  return buildMoveTestEngine([attacker, foe]);
}

describe("Mitra-Poing (focus-punch) — cross-turn interrupt", () => {
  it("fizzles when the foe strikes the user during the charge", () => {
    const { engine, state } = duel(["focus-punch", "tackle"], ["tackle"]);

    // Given: the user winds up Mitra-Poing.
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "focus-punch",
      targetPosition: { x: 1, y: 0 },
    });
    expect(state.pokemon.get("attacker")?.chargingMove?.moveId).toBe("focus-punch");

    // When: the foe hits the charging user before it strikes.
    endTurnUntilActor(engine, state, "foe");
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "foe",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });
    expect(state.pokemon.get("attacker")?.focusInterrupted).toBe(true);

    // Then: the strike fizzles on the user's next turn.
    endTurnUntilActor(engine, state, "attacker");
    const foeHpBefore = state.pokemon.get("foe")?.currentHp ?? 0;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "focus-punch",
      targetPosition: { x: 1, y: 0 },
    });

    const failed = result.events.find((event) => event.type === BattleEventType.MoveFailed);
    expect(failed && "reason" in failed ? failed.reason : undefined).toBe(MoveFailedReason.Focus);
    expect(state.pokemon.get("foe")?.currentHp).toBe(foeHpBefore);
  });

  it("strikes when the user is left alone during the charge", () => {
    const { engine, state } = duel(["focus-punch", "tackle"], ["tackle"]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "focus-punch",
      targetPosition: { x: 1, y: 0 },
    });

    // The foe just waits — no hit lands on the charging user.
    endTurnUntilActor(engine, state, "foe");
    endTurnUntilActor(engine, state, "attacker");
    const foeHpBefore = state.pokemon.get("foe")?.currentHp ?? 0;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "focus-punch",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(foeHpBefore);
  });
});

describe("Bec-Canon (beak-blast) — contact burn during charge", () => {
  it("burns a contact attacker while still firing later", () => {
    const { engine, state } = duel(["beak-blast", "tackle"], ["tackle"]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "beak-blast",
      targetPosition: { x: 1, y: 0 },
    });

    endTurnUntilActor(engine, state, "foe");
    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "foe",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.BeakBlastBurn);
    expect(state.pokemon.get("foe")?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Burned }),
    );
    expect(state.pokemon.get("attacker")?.focusInterrupted).toBeUndefined();
  });
});

describe("Coup Bas (sucker-punch) — freshness gate", () => {
  it("hits a foe whose last action was an attack", () => {
    const { engine, state } = duel(["sucker-punch", "tackle"], ["tackle"], 200);

    // The foe acts first and attacks (its last action is offensive).
    endTurnUntilActor(engine, state, "foe");
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "foe",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });

    endTurnUntilActor(engine, state, "attacker");
    const foeHpBefore = state.pokemon.get("foe")?.currentHp ?? 0;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sucker-punch",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(foeHpBefore);
  });

  it("fizzles against a foe that only waited", () => {
    const { engine, state } = duel(["sucker-punch", "tackle"], ["tackle"], 200);

    // The foe acts first but only waits (its last action is not offensive).
    endTurnUntilActor(engine, state, "foe");
    endTurnUntilActor(engine, state, "attacker");
    const foeHpBefore = state.pokemon.get("foe")?.currentHp ?? 0;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sucker-punch",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(state.pokemon.get("foe")?.currentHp).toBe(foeHpBefore);
  });
});
