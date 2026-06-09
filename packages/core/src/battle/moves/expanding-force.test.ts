import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { TargetingKind } from "../../enums/targeting-kind";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postFieldTerrain } from "../field-terrain-system";

// Vaste Pouvoir (expanding-force) — Single 80; on Psychic Terrain (caster): Blast r1 + ×1.5 (#440, #448)

function makeCaster(position = { x: 5, y: 5 }, definitionId = "test") {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    definitionId,
    playerId: PlayerId.Player1,
    position,
    moveIds: ["expanding-force"],
    currentPp: { "expanding-force": 10 },
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

describe("expanding-force — Single off-zone, Blast r1 on Psychic Terrain", () => {
  it("hits a single target off Psychic Terrain", () => {
    const caster = makeCaster();
    const a = makeFoe("a", { x: 5, y: 3 });
    const b = makeFoe("b", { x: 6, y: 3 });
    const { engine, state } = buildMoveTestEngine([caster, a, b], {
      gridSize: 10,
      random: () => 0.5,
    });
    const aHpBefore = a.currentHp;
    const bHpBefore = b.currentHp;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "expanding-force",
      targetPosition: { x: 5, y: 3 },
    });
    expect(result.success).toBe(true);
    // Only the targeted foe takes damage (Single), the adjacent one is untouched.
    expect(state.pokemon.get(a.id)?.currentHp).toBeLessThan(aHpBefore);
    expect(state.pokemon.get(b.id)?.currentHp).toBe(bHpBefore);
  });

  it("morphs to Blast r1 hitting adjacent foes when the caster stands on Psychic Terrain", () => {
    const caster = makeCaster();
    const a = makeFoe("a", { x: 5, y: 3 });
    const b = makeFoe("b", { x: 6, y: 3 });
    const { engine, state } = buildMoveTestEngine([caster, a, b], {
      gridSize: 10,
      random: () => 0.5,
    });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    const aHpBefore = a.currentHp;
    const bHpBefore = b.currentHp;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "expanding-force",
      targetPosition: { x: 5, y: 3 },
    });
    expect(result.success).toBe(true);
    // Both foes within radius 1 of the impact tile take damage (AoE morph).
    expect(state.pokemon.get(a.id)?.currentHp).toBeLessThan(aHpBefore);
    expect(state.pokemon.get(b.id)?.currentHp).toBeLessThan(bHpBefore);
  });

  it("applies ×1.5 power to the primary target on Psychic Terrain", () => {
    const run = (onPsychic: boolean): number => {
      const caster = makeCaster();
      const target = makeFoe("t", { x: 5, y: 3 });
      const { engine, state } = buildMoveTestEngine([caster, target], {
        gridSize: 10,
        random: () => 0.5,
      });
      if (onPsychic) {
        postFieldTerrain(state, caster, FieldTerrain.Psychic);
      }
      const hpBefore = target.currentHp;
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: caster.id,
        moveId: "expanding-force",
        targetPosition: { x: 5, y: 3 },
      });
      return hpBefore - (state.pokemon.get(target.id)?.currentHp ?? 0);
    };
    const base = run(false);
    const boosted = run(true);
    expect(boosted).toBeGreaterThan(base * 1.3);
  });

  it("getLegalActions exposes the Zone morph (legality matches execution)", () => {
    const caster = makeCaster();
    const { engine, state } = buildMoveTestEngine([caster, makeFoe("a", { x: 5, y: 3 })], {
      gridSize: 10,
    });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    const effective = engine.getEffectiveMove(caster.id, "expanding-force");
    expect(effective?.targeting.kind).toBe(TargetingKind.Blast);
  });

  it("does NOT morph when the caster is a Flying-type on the zone (double gate)", () => {
    const caster = makeCaster({ x: 5, y: 5 }, "pidgey");
    const { engine, state } = buildMoveTestEngine([caster, makeFoe("a", { x: 5, y: 3 })], {
      gridSize: 10,
    });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    const effective = engine.getEffectiveMove(caster.id, "expanding-force");
    expect(effective?.targeting.kind).toBe(TargetingKind.Single);
  });
});
