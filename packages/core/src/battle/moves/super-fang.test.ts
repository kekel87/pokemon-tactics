import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup(foeHp: number) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["super-fang"],
    currentPp: { "super-fang": 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    currentHp: foeHp,
    maxHp: 200,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe], { random: () => 0 });
}

describe("super-fang", () => {
  it("deals damage equal to half the target's current HP", () => {
    const { engine, state } = setup(120);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "super-fang",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.SuperFangApplied);
    expect(state.pokemon.get("foe")?.currentHp).toBe(60);
  });

  it("deals at least 1 and can KO a target at 1 HP", () => {
    const { engine, state } = setup(1);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "super-fang",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.SuperFangApplied);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
  });
});
