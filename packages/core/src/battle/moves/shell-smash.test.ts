import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("shell-smash", () => {
  it("raises Attack, SpAttack, and Speed by 2 stages", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["shell-smash"],
      currentPp: { "shell-smash": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "shell-smash",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    const userPokemon = state.pokemon.get(user.id)!;
    expect(userPokemon.statStages[StatName.Attack]).toBe(2);
    expect(userPokemon.statStages[StatName.SpAttack]).toBe(2);
    expect(userPokemon.statStages[StatName.Speed]).toBe(2);
  });

  it("lowers Defense and SpDefense by 1 stage", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["shell-smash"],
      currentPp: { "shell-smash": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "shell-smash",
      targetPosition: { x: 0, y: 0 },
    });

    const userPokemon = state.pokemon.get(user.id)!;
    expect(userPokemon.statStages[StatName.Defense]).toBe(-1);
    expect(userPokemon.statStages[StatName.SpDefense]).toBe(-1);
  });

  it("emits StatChanged events for all 5 affected stats", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["shell-smash"],
      currentPp: { "shell-smash": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "shell-smash",
      targetPosition: { x: 0, y: 0 },
    });

    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(5);
  });

  it("does not affect the foe's stat stages", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["shell-smash"],
      currentPp: { "shell-smash": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "shell-smash",
      targetPosition: { x: 0, y: 0 },
    });

    const foePokemon = state.pokemon.get(foe.id)!;
    expect(foePokemon.statStages[StatName.Attack]).toBe(0);
    expect(foePokemon.statStages[StatName.Defense]).toBe(0);
    expect(foePokemon.statStages[StatName.SpAttack]).toBe(0);
    expect(foePokemon.statStages[StatName.SpDefense]).toBe(0);
    expect(foePokemon.statStages[StatName.Speed]).toBe(0);
  });
});
