import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("stockpile", () => {
  it("raises Defense and SpDefense by 1", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["stockpile"],
      currentPp: { stockpile: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "stockpile",
      targetPosition: user.position,
    });

    expect(result.success).toBe(true);

    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.statStages[StatName.Defense]).toBe(1);
    expect(pokemon.statStages[StatName.SpDefense]).toBe(1);
  });

  it("emits StatChanged events for Defense and SpDefense", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["stockpile"],
      currentPp: { stockpile: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "stockpile",
      targetPosition: user.position,
    });

    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(2);
  });

  it("does not affect Attack or SpAttack", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["stockpile"],
      currentPp: { stockpile: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "stockpile",
      targetPosition: user.position,
    });

    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.statStages[StatName.Attack]).toBe(0);
    expect(pokemon.statStages[StatName.SpAttack]).toBe(0);
  });

  it("stacks on second use", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["stockpile"],
      currentPp: { stockpile: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "stockpile",
      targetPosition: user.position,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "stockpile",
      targetPosition: user.position,
    });

    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.statStages[StatName.Defense]).toBe(2);
    expect(pokemon.statStages[StatName.SpDefense]).toBe(2);
  });
});
