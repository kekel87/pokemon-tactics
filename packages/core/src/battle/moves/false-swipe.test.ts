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
    moveIds: ["false-swipe"],
    currentPp: { "false-swipe": 5 },
    combatStats: { hp: 100, attack: 250, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    currentHp: foeHp,
    maxHp: 200,
    combatStats: { hp: 200, attack: 55, defense: 20, spAttack: 55, spDefense: 55, speed: 55 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("false-swipe", () => {
  it("leaves the target at 1 HP instead of KOing it", () => {
    const { engine, state } = setup(2);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "false-swipe",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.PokemonKo);
    expect(state.pokemon.get("foe")?.currentHp).toBe(1);
  });

  it("does not overheal a target already at 1 HP", () => {
    const { engine, state } = setup(1);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "false-swipe",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(1);
  });
});
