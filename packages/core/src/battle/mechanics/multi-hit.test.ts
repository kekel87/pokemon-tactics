import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("multi-hit", () => {
  function makeAttacker(moveId: string) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: [moveId],
      currentPp: { [moveId]: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
  }

  function makeFoe(overrides?: Partial<Parameters<typeof MockPokemon.fresh>[1]>) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      ...overrides,
    });
  }

  it("double-kick hits exactly 2 times", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker("double-kick");
    const foe = makeFoe({ currentHp: 500, maxHp: 500 });
    const { engine } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "double-kick",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(2);
    const multiComplete = result.events.filter((e) => e.type === BattleEventType.MultiHitComplete);
    expect(multiComplete).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("fury-swipes variable hits with correct distribution", () => {
    let callCount = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      callCount++;
      if (callCount === 1) return 0;
      return 0.8;
    });
    const attacker = makeAttacker("fury-swipes");
    const foe = makeFoe({ currentHp: 500, maxHp: 500 });
    const { engine } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "fury-swipes",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBeGreaterThanOrEqual(2);
    expect(damageEvents.length).toBeLessThanOrEqual(5);
    vi.restoreAllMocks();
  });

  it("stops if target is KO before all hits", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker("double-kick");
    attacker.combatStats = {
      hp: 100,
      attack: 200,
      defense: 55,
      spAttack: 55,
      spDefense: 55,
      speed: 55,
    };
    const foe = makeFoe({ currentHp: 1, maxHp: 100 });
    const { engine } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "double-kick",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(1);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.PokemonKo);
    vi.restoreAllMocks();
  });

  it("performs a single accuracy check for all hits", () => {
    let callCount = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      callCount++;
      return 0.99;
    });
    const attacker = makeAttacker("fury-swipes");
    const foe = makeFoe({ currentHp: 500, maxHp: 500 });
    const { engine } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "fury-swipes",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveMissed);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
