import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("friendly fire", () => {
  it("AoE Zone hits allies in the area", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const geodude = MockPokemon.fresh(MockPokemon.base, {
      id: "geodude-1",
      definitionId: "geodude",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      moveIds: ["magnitude"],
      currentPp: { magnitude: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 3, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 60 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });

    const { engine, state } = buildMoveTestEngine([geodude, ally, enemy]);
    const allyPokemon = state.pokemon.get("charmander-1")!;
    const hpBefore = allyPokemon.currentHp;

    const damageEvents: BattleEvent[] = [];
    engine.on(BattleEventType.DamageDealt, (e) => damageEvents.push(e));

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "geodude-1",
      moveId: "magnitude",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.success).toBe(true);
    const allyDamageEvent = damageEvents.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === "charmander-1",
    );
    expect(allyDamageEvent).toBeDefined();
    expect(allyPokemon.currentHp).toBeLessThan(hpBefore);

    vi.restoreAllMocks();
  });

  it("AoE Cone hits allies in the cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const pidgey = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      derivedStats: { movement: 4, jump: 2, initiative: 90 },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 3, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 60 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });

    const { engine, state } = buildMoveTestEngine([pidgey, ally, enemy]);
    const allyPokemon = state.pokemon.get("charmander-1")!;
    const hpBefore = allyPokemon.currentHp;

    const damageEvents: BattleEvent[] = [];
    engine.on(BattleEventType.DamageDealt, (e) => damageEvents.push(e));

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "pidgey-1",
      moveId: "gust",
      targetPosition: { x: 3, y: 4 },
    });

    expect(result.success).toBe(true);
    const allyDamageEvent = damageEvents.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === "charmander-1",
    );
    expect(allyDamageEvent).toBeDefined();
    expect(allyPokemon.currentHp).toBeLessThan(hpBefore);

    vi.restoreAllMocks();
  });
});
