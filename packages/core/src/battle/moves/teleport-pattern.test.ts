import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { SemiInvulnerableState } from "../../types/semi-invulnerable-state";
import { createPrng } from "../../utils/prng";

describe("teleport (pure 1-turn)", () => {
  it("Given target empty + no neighbours, When teleport submitted, Then caster relocates and no damage emitted", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["teleport"],
      currentPp: { teleport: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const bystander = MockPokemon.fresh(MockPokemon.charmander, {
      id: "bystander",
      playerId: PlayerId.Player2,
      position: { x: 7, y: 7 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, bystander], {
      gridSize: 8,
      random: createPrng(1),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "teleport",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.Teleported)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(false);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 3, y: 3 });
  });

  it("Given target occupied by enemy, When teleport submitted, Then action invalid", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["teleport"],
      currentPp: { teleport: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const blocker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "blocker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, blocker], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "teleport",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.success).toBe(false);
  });
});

describe("two-turn TP charge — T1 behaviour", () => {
  const cases: Array<{
    moveId: string;
    expectedState: SemiInvulnerableState;
  }> = [
    { moveId: "fly", expectedState: SemiInvulnerableState.Flying },
    { moveId: "dig", expectedState: SemiInvulnerableState.Burrowing },
    { moveId: "bounce", expectedState: SemiInvulnerableState.Flying },
    { moveId: "phantom-force", expectedState: SemiInvulnerableState.Vanished },
    { moveId: "shadow-force", expectedState: SemiInvulnerableState.Vanished },
    { moveId: "dive", expectedState: SemiInvulnerableState.Diving },
  ];

  for (const { moveId, expectedState } of cases) {
    it(`Given ${moveId} T1, When submitted, Then emits MoveCharging + sets semi-invulnerable state + no damage`, () => {
      const caster = MockPokemon.fresh(MockPokemon.base, {
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: [moveId],
        currentPp: { [moveId]: 15 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const defender = MockPokemon.fresh(MockPokemon.charmander, {
        id: "defender",
        playerId: PlayerId.Player2,
        position: { x: 3, y: 1 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildMoveTestEngine([caster, defender], {
        gridSize: 8,
        random: createPrng(0),
      });

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: caster.id,
        moveId,
        targetPosition: { x: 3, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(result.events.some((e) => e.type === BattleEventType.MoveCharging)).toBe(true);
      expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(false);
      expect(result.events.some((e) => e.type === BattleEventType.Teleported)).toBe(false);

      const currentCaster = state.pokemon.get(caster.id);
      expect(currentCaster?.position).toEqual({ x: 0, y: 0 });
      expect(currentCaster?.semiInvulnerableState).toBe(expectedState);
      expect(currentCaster?.chargingMove?.moveId).toBe(moveId);
      expect(currentCaster?.lockedMoveId).toBe(moveId);
    });
  }
});

describe("teleport range invariants", () => {
  it("Given out-of-range target, When teleport submitted, Then invalid target", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["teleport"],
      currentPp: { teleport: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 6, y: 6 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "teleport",
      targetPosition: { x: 7, y: 7 },
    });

    expect(result.success).toBe(false);
  });
});
