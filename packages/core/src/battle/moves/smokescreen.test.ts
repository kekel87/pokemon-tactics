import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("smokescreen", () => {
  it("reduces accuracy of target within zone radius 1", () => {
    const caster = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "smokescreen",
      targetPosition: caster.position,
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatChanged);
    expect(state.pokemon.get(target.id)?.statStages[StatName.Accuracy]).toBe(-1);
  });

  it("does not affect target outside zone radius 1", () => {
    const caster = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, farTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "smokescreen",
      targetPosition: caster.position,
    });

    expect(state.pokemon.get(farTarget.id)?.statStages[StatName.Accuracy]).toBe(0);
  });
});
