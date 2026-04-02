import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("psybeam", () => {
  it("hits single target in line", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["psybeam"],
      currentPp: { psybeam: 20 },
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
      moveId: "psybeam",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(hpBefore);
    vi.restoreAllMocks();
  });

  it("hits multiple targets along the line", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["psybeam"],
      currentPp: { psybeam: 20 },
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
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine } = buildMoveTestEngine([attacker, foe1, foe2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "psybeam",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("does not hit target off the line axis", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["psybeam"],
      currentPp: { psybeam: 20 },
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

    const { engine } = buildMoveTestEngine([attacker, foeOnLine, foeOffLine]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "psybeam",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: "damage_dealt" }> =>
        e.type === BattleEventType.DamageDealt,
    );
    const hitIds = damageEvents.map((e) => e.targetId);
    expect(hitIds).toContain("foe-on-line");
    expect(hitIds).not.toContain("foe-off-line");
    vi.restoreAllMocks();
  });
});
