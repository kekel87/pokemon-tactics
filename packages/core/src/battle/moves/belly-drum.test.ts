import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup(currentHp: number) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["belly-drum"],
    currentPp: { "belly-drum": 5 },
    currentHp,
    maxHp: 100,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 3, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("belly-drum", () => {
  it("halves max HP and maximises Attack", () => {
    const { engine, state } = setup(100);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "belly-drum",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.BellyDrumUsed);
    const caster = state.pokemon.get("caster");
    expect(caster?.currentHp).toBe(50);
    expect(caster?.statStages[StatName.Attack]).toBe(6);
  });

  it("fails when HP is at or below half", () => {
    const { engine, state } = setup(50);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "belly-drum",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(state.pokemon.get("caster")?.statStages[StatName.Attack]).toBe(0);
  });
});
