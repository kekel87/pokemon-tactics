import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("quiver-dance", () => {
  it("raises SpAttack, SpDefense and Speed by 1 stage on self", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["quiver-dance"],
      currentPp: { "quiver-dance": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const dummy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, dummy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "quiver-dance",
      targetPosition: attacker.position,
    });

    expect(result.success).toBe(true);
    const after = state.pokemon.get(attacker.id);
    expect(after?.statStages[StatName.SpAttack]).toBe(1);
    expect(after?.statStages[StatName.SpDefense]).toBe(1);
    expect(after?.statStages[StatName.Speed]).toBe(1);
  });
});
