import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["guard-split"],
    currentPp: { "guard-split": 10 },
    combatStats: { hp: 100, attack: 55, defense: 100, spAttack: 55, spDefense: 40, speed: 55 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    combatStats: { hp: 100, attack: 55, defense: 50, spAttack: 55, spDefense: 80, speed: 55 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("guard-split", () => {
  it("averages Defense and Sp. Def between caster and target", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "guard-split",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.GuardSplit);
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    expect(caster?.defenseStatOverride).toBe(75);
    expect(foe?.defenseStatOverride).toBe(75);
    expect(caster?.spDefenseStatOverride).toBe(60);
    expect(foe?.spDefenseStatOverride).toBe(60);
  });
});
