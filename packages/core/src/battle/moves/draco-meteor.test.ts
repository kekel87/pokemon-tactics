import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("draco-meteor", () => {
  it("deals damage to target within blast radius 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["draco-meteor"],
      currentPp: { "draco-meteor": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);
    const hpBefore = state.pokemon.get("target")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "draco-meteor",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("target")?.currentHp).toBeLessThan(hpBefore);
  });

  it("lowers caster SpAttack by 2 stages after use", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["draco-meteor"],
      currentPp: { "draco-meteor": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "draco-meteor",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(state.pokemon.get("caster")?.statStages[StatName.SpAttack]).toBe(-2);
  });

  it("does not hit target outside blast radius", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["draco-meteor"],
      currentPp: { "draco-meteor": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const inRange = MockPokemon.fresh(MockPokemon.base, {
      id: "in-range",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const outOfRadius = MockPokemon.fresh(MockPokemon.base, {
      id: "out-of-radius",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const hpBefore = outOfRadius.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, inRange, outOfRadius]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "draco-meteor",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(state.pokemon.get("out-of-radius")?.currentHp).toBe(hpBefore);
  });
});
