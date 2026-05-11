import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("coil", () => {
  it("raises Attack, Defense and Accuracy by 1 stage each", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["coil"],
      currentPp: { coil: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "coil",
      targetPosition: user.position,
    });

    expect(result.success).toBe(true);
    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.statStages[StatName.Attack]).toBe(1);
    expect(pokemon.statStages[StatName.Defense]).toBe(1);
    expect(pokemon.statStages[StatName.Accuracy]).toBe(1);
  });

  it("emits StatChanged events for Attack, Defense, and Accuracy", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["coil"],
      currentPp: { coil: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "coil",
      targetPosition: user.position,
    });

    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(3);
  });

  it("does not deal damage", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["coil"],
      currentPp: { coil: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "coil",
      targetPosition: user.position,
    });

    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
  });
});
