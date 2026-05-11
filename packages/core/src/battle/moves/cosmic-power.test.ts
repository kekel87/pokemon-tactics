import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("cosmic-power", () => {
  it("raises Defense and SpDefense by 1 stage each", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["cosmic-power"],
      currentPp: { "cosmic-power": 20 },
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
      moveId: "cosmic-power",
      targetPosition: user.position,
    });

    expect(result.success).toBe(true);
    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.statStages[StatName.Defense]).toBe(1);
    expect(pokemon.statStages[StatName.SpDefense]).toBe(1);
  });

  it("does not raise Attack or Speed", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["cosmic-power"],
      currentPp: { "cosmic-power": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "cosmic-power",
      targetPosition: user.position,
    });

    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.statStages[StatName.Attack]).toBe(0);
    expect(pokemon.statStages[StatName.Speed]).toBe(0);
  });

  it("emits two StatChanged events", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["cosmic-power"],
      currentPp: { "cosmic-power": 20 },
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
      moveId: "cosmic-power",
      targetPosition: user.position,
    });

    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(2);
  });
});
