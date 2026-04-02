import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("sand-attack", () => {
  it("applies accuracy -1 to target in cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sand-attack",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(1);
    expect(state.pokemon.get(foe.id)?.statStages[StatName.Accuracy]).toBe(-1);
    vi.restoreAllMocks();
  });

  it("applies accuracy -1 to all targets in cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-2",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foe1, foe2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sand-attack",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(2);
    expect(state.pokemon.get(foe1.id)?.statStages[StatName.Accuracy]).toBe(-1);
    expect(state.pokemon.get(foe2.id)?.statStages[StatName.Accuracy]).toBe(-1);
    vi.restoreAllMocks();
  });

  it("does not affect target outside cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeOutside = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-outside",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foeInside = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-inside",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foeOutside, foeInside]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sand-attack",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foeOutside.id)?.statStages[StatName.Accuracy]).toBe(0);
    expect(state.pokemon.get(foeInside.id)?.statStages[StatName.Accuracy]).toBe(-1);
    vi.restoreAllMocks();
  });
});
