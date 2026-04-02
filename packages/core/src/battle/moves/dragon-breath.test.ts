import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("dragon-breath", () => {
  it("deals damage to target in cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
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
    const hpBefore = state.pokemon.get(foe.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-breath",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(hpBefore);
    vi.restoreAllMocks();
  });

  it("applies paralysis when proc triggers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
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
      moveId: "dragon-breath",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const statusEvents = result.events.filter((e) => e.type === BattleEventType.StatusApplied);
    expect(statusEvents).toHaveLength(1);
    expect(state.pokemon.get(foe.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Paralyzed }),
    );
    vi.restoreAllMocks();
  });

  it("does not apply paralysis when proc does not trigger", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
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

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-breath",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foe.id)?.statusEffects).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("hits multiple targets in cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
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

    const { engine } = buildMoveTestEngine([attacker, foe1, foe2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-breath",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("does not hit target outside cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
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

    const { engine } = buildMoveTestEngine([attacker, foeOutside, foeInside]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-breath",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: "damage_dealt" }> =>
        e.type === BattleEventType.DamageDealt,
    );
    const hitIds = damageEvents.map((e) => e.targetId);
    expect(hitIds).not.toContain("foe-outside");
    expect(hitIds).toContain("foe-inside");
    vi.restoreAllMocks();
  });
});
