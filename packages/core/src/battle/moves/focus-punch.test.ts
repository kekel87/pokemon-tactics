import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { ChargeReaction } from "../../enums/charge-reaction";
import { MoveFailedReason } from "../../enums/move-failed-reason";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["focus-punch", "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([attacker, defender]);
}

function useFocusPunch(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "focus-punch",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("focus-punch", () => {
  it("winds up on the first turn and stores the focus reaction", () => {
    const { engine, state } = setup();
    const result = useFocusPunch(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveCharging);
    expect(state.pokemon.get("attacker")?.chargingMove?.reaction).toBe(ChargeReaction.Focus);
  });

  it("strikes on the second turn when focus was not broken", () => {
    const { engine, state } = setup();
    const attacker = state.pokemon.get("attacker");
    if (attacker) {
      attacker.chargingMove = { moveId: "focus-punch", reaction: ChargeReaction.Focus };
    }
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = useFocusPunch(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get("attacker")?.chargingMove).toBeUndefined();
  });

  it("fizzles on the second turn when focus was broken by a hit", () => {
    const { engine, state } = setup();
    const attacker = state.pokemon.get("attacker");
    if (attacker) {
      attacker.chargingMove = { moveId: "focus-punch", reaction: ChargeReaction.Focus };
      attacker.focusInterrupted = true;
    }
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = useFocusPunch(engine);

    const failed = result.events.find((event) => event.type === BattleEventType.MoveFailed);
    expect(failed).toBeDefined();
    expect(failed && "reason" in failed ? failed.reason : undefined).toBe(MoveFailedReason.Focus);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBe(hpBefore);
    expect(state.pokemon.get("attacker")?.focusInterrupted).toBeUndefined();
  });
});
