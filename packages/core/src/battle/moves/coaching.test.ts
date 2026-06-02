import { describe, expect, it } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("coaching", () => {
  it("raises ally Attack and Defense each by 1 stage", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["coaching"],
      currentPp: { coaching: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine, state } = buildMoveTestEngine([user, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "coaching",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(2);
    expect(state.pokemon.get(ally.id)?.statStages[StatName.Attack]).toBe(1);
    expect(state.pokemon.get(ally.id)?.statStages[StatName.Defense]).toBe(1);
  });

  it("does not affect the user", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["coaching"],
      currentPp: { coaching: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine, state } = buildMoveTestEngine([user, ally]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "coaching",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(user.id)?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get(user.id)?.statStages[StatName.Defense]).toBe(0);
  });

  it("cannot target an enemy", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["coaching"],
      currentPp: { coaching: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([user, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "coaching",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
