import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { TargetingKind } from "../../enums/targeting-kind";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { MoveDefinition } from "../../types/move-definition";

function dashRange(move: MoveDefinition | null): number {
  if (move?.targeting.kind !== TargetingKind.Dash) {
    throw new Error("expected a Dash move");
  }
  return move.targeting.maxDistance;
}

function makeCaster(position = { x: 0, y: 0 }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position,
    moveIds: ["rollout", "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function makeFoe(id: string, position: { x: number; y: number }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id,
    playerId: PlayerId.Player2,
    position,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

describe("rollout", () => {
  it("hits enemy and repositions caster when accuracy check passes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = makeCaster();
    const target = makeFoe("target-1", { x: 2, y: 0 });
    const hpBefore = target.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "rollout",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 1, y: 0 });

    vi.restoreAllMocks();
  });

  it("repositions caster without damage when dashing into empty space", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = makeCaster({ x: 2, y: 2 });
    const foe = makeFoe("foe-1", { x: 0, y: 0 });
    const { engine, state } = buildMoveTestEngine([caster, foe]);
    const foeHpBefore = foe.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "rollout",
      targetPosition: { x: 2, y: 4 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 2, y: 4 });
    expect(state.pokemon.get(foe.id)?.currentHp).toBe(foeHpBefore);

    vi.restoreAllMocks();
  });

  it("does not consume hasMoved after dashing", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = makeCaster({ x: 2, y: 2 });
    const foe = makeFoe("foe-1", { x: 0, y: 0 });
    const { engine } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "rollout",
      targetPosition: { x: 2, y: 4 },
    });

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: caster.id,
      path: [{ x: 2, y: 3 }],
    });

    expect(moveResult.success).toBe(true);

    vi.restoreAllMocks();
  });

  describe("snowball", () => {
    it("dashes 2 tiles on a fresh cast (streak index 1)", () => {
      const caster = makeCaster();
      const { engine } = buildMoveTestEngine([caster, makeFoe("foe-1", { x: 5, y: 0 })]);
      expect(dashRange(engine.getEffectiveMove(caster.id, "rollout"))).toBe(2);
    });

    it("extends range with the consecutive-cast streak, capped at 5", () => {
      const caster = makeCaster();
      const { engine, state } = buildMoveTestEngine([caster, makeFoe("foe-1", { x: 5, y: 0 })]);
      const live = state.pokemon.get(caster.id);
      if (!live) {
        throw new Error("missing caster");
      }
      live.lastUsedMoveId = "rollout";
      live.rolloutStreak = 1;
      expect(dashRange(engine.getEffectiveMove(caster.id, "rollout"))).toBe(3);
      live.rolloutStreak = 3;
      expect(dashRange(engine.getEffectiveMove(caster.id, "rollout"))).toBe(5);
      live.rolloutStreak = 4;
      expect(dashRange(engine.getEffectiveMove(caster.id, "rollout"))).toBe(5);
    });

    it("hits harder as the streak grows (power doubles per cast)", () => {
      const caster = makeCaster();
      const { engine, state } = buildMoveTestEngine([caster, makeFoe("target-1", { x: 5, y: 0 })]);
      const live = state.pokemon.get(caster.id);
      if (!live) {
        throw new Error("missing caster");
      }
      live.lastUsedMoveId = "rollout";
      live.rolloutStreak = 0;
      const fresh = engine.estimateDamage(caster.id, "rollout", "target-1");
      live.rolloutStreak = 3;
      const snowballed = engine.estimateDamage(caster.id, "rollout", "target-1");
      expect(snowballed?.max ?? 0).toBeGreaterThan(fresh?.max ?? 0);
    });

    it("records a streak of 1 after a fresh Rollout cast", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const caster = makeCaster();
      const { engine, state } = buildMoveTestEngine([caster, makeFoe("foe-1", { x: 5, y: 0 })]);
      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: caster.id,
        moveId: "rollout",
        targetPosition: { x: 2, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get(caster.id)?.rolloutStreak).toBe(1);

      vi.restoreAllMocks();
    });

    it("resets the streak when a different move is used", () => {
      const caster = makeCaster();
      const target = makeFoe("target-1", { x: 1, y: 0 });
      const { engine, state } = buildMoveTestEngine([caster, target]);
      const live = state.pokemon.get(caster.id);
      if (!live) {
        throw new Error("missing caster");
      }
      live.lastUsedMoveId = "rollout";
      live.rolloutStreak = 3;

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: caster.id,
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get(caster.id)?.rolloutStreak).toBe(0);
    });
  });
});
