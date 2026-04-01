import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("aurora-beam", () => {
  it("deals damage to target in line", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["aurora-beam"],
      currentPp: { "aurora-beam": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foe]);
    const hpBefore = state.pokemon.get(foe.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "aurora-beam",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(hpBefore);
    vi.restoreAllMocks();
  });

  it("applies attack -1 to target in line", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["aurora-beam"],
      currentPp: { "aurora-beam": 20 },
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
      moveId: "aurora-beam",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const statEvents = result.events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents).toHaveLength(1);
    expect(state.pokemon.get(foe.id)?.statStages[StatName.Attack]).toBe(-1);
    vi.restoreAllMocks();
  });

  it("applies attack -1 to all targets hit along the line", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["aurora-beam"],
      currentPp: { "aurora-beam": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-2",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foe1, foe2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "aurora-beam",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(foe1.id)?.statStages[StatName.Attack]).toBe(-1);
    expect(state.pokemon.get(foe2.id)?.statStages[StatName.Attack]).toBe(-1);
    vi.restoreAllMocks();
  });

  it("does not affect target off the line axis", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["aurora-beam"],
      currentPp: { "aurora-beam": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeOnLine = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-on-line",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foeOffLine = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-off-line",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foeOnLine, foeOffLine]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "aurora-beam",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foeOnLine.id)?.statStages[StatName.Attack]).toBe(-1);
    expect(state.pokemon.get(foeOffLine.id)?.statStages[StatName.Attack]).toBe(0);
    vi.restoreAllMocks();
  });
});
