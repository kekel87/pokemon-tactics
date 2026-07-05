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

function makeCaster() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["ice-ball", "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function makeFoe(position: { x: number; y: number }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    playerId: PlayerId.Player2,
    position,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

describe("ice-ball", () => {
  it("hits an enemy and records a snowball streak of 1 on a fresh cast", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 2, y: 0 })]);
    const hpBefore = state.pokemon.get("target")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "ice-ball",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("target")?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get("caster")?.rolloutStreak).toBe(1);

    vi.restoreAllMocks();
  });

  it("extends its Dash range with the consecutive-cast streak", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 5, y: 0 })]);
    const live = state.pokemon.get("caster");
    if (!live) {
      throw new Error("missing caster");
    }
    expect(dashRange(engine.getEffectiveMove("caster", "ice-ball"))).toBe(2);
    live.lastUsedMoveId = "ice-ball";
    live.rolloutStreak = 3;
    expect(dashRange(engine.getEffectiveMove("caster", "ice-ball"))).toBe(5);
  });
});
