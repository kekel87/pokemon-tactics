import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("razor-leaf", () => {
  it("hits single target directly in front", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.bulbasaur, {
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
      moveId: "razor-leaf",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(hpBefore);
    vi.restoreAllMocks();
  });

  it("hits all 3 slash tiles: front and both diagonals", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeFront = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-front",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foeDiag1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-diag1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const foeDiag2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-diag2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 8 },
    });

    const { engine } = buildMoveTestEngine([attacker, foeFront, foeDiag1, foeDiag2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "razor-leaf",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(3);
    vi.restoreAllMocks();
  });

  it("does not hit target outside slash arc", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.bulbasaur, {
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
      moveId: "razor-leaf",
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

  it("misses when accuracy check fails", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const attacker = MockPokemon.fresh(MockPokemon.bulbasaur, {
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

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "razor-leaf",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foe.id)?.currentHp).toBe(hpBefore);
    vi.restoreAllMocks();
  });
});
