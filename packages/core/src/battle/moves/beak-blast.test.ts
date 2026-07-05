import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { ChargeReaction } from "../../enums/charge-reaction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["beak-blast", "tackle"],
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

describe("beak-blast", () => {
  it("winds up on the first turn with the beak reaction", () => {
    const { engine, state } = setup();
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "beak-blast",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveCharging);
    expect(state.pokemon.get("attacker")?.chargingMove?.reaction).toBe(ChargeReaction.Beak);
  });

  it("still strikes on the second turn regardless of being hit while charging", () => {
    const { engine, state } = setup();
    const attacker = state.pokemon.get("attacker");
    if (attacker) {
      attacker.chargingMove = { moveId: "beak-blast", reaction: ChargeReaction.Beak };
    }
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "beak-blast",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBeLessThan(hpBefore);
  });
});
