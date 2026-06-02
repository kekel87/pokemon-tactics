import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { SemiInvulnerableState } from "../../types/semi-invulnerable-state";
import { createPrng } from "../../utils/prng";

describe("bounce", () => {
  it("T1 charge emits MoveCharging, sets Flying semi-invulnerable state, no damage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["bounce"],
      currentPp: { bounce: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "bounce",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.MoveCharging)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(false);
    expect(result.events.some((e) => e.type === BattleEventType.Teleported)).toBe(false);

    const casterState = state.pokemon.get("attacker");
    expect(casterState?.semiInvulnerableState).toBe(SemiInvulnerableState.Flying);
    expect(casterState?.chargingMove?.moveId).toBe("bounce");
    expect(casterState?.lockedMoveId).toBe("bounce");
    expect(casterState?.position).toEqual({ x: 0, y: 0 });
    expect(state.pokemon.get("defender")?.currentHp).toBe(MockPokemon.charmander.currentHp);
  });

  it("T2 teleports to landing tile and deals damage to adjacent foe", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["bounce"],
      currentPp: { bounce: 4 },
      chargingMove: { moveId: "bounce", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "bounce",
      semiInvulnerableState: SemiInvulnerableState.Flying,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "bounce",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.Teleported)).toBe(true);
    expect(state.pokemon.get("defender")?.currentHp).toBeLessThan(9999);

    const casterAfter = state.pokemon.get("attacker");
    expect(casterAfter?.chargingMove).toBeUndefined();
    expect(casterAfter?.lockedMoveId).toBeUndefined();
    expect(casterAfter?.semiInvulnerableState).toBeUndefined();
  });

  it("T2 applies paralysis with 30% chance when random favors it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["bounce"],
      currentPp: { bounce: 4 },
      chargingMove: { moveId: "bounce", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "bounce",
      semiInvulnerableState: SemiInvulnerableState.Flying,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], {
      gridSize: 8,
      random: createPrng(0),
    });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "bounce",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(
      state.pokemon.get("defender")?.statusEffects.some((s) => s.type === StatusType.Paralyzed),
    ).toBe(true);
  });
});
