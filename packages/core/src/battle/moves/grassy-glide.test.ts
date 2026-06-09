import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postFieldTerrain } from "../field-terrain-system";

// Gliss'Herbe (grassy-glide) — Dash whose range extends 2 → 4 on Grassy Terrain (#439)

function makeCaster(position = { x: 5, y: 5 }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position,
    moveIds: ["grassy-glide"],
    currentPp: { "grassy-glide": 20 },
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

describe("grassy-glide — Dash range", () => {
  it("reaches distance 2 (default) but not distance 3 off Grassy Terrain", () => {
    const caster = makeCaster();
    const { engine } = buildMoveTestEngine([caster, makeFoe("foe", { x: 9, y: 9 })], {
      gridSize: 10,
    });

    const targets = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove && a.moveId === "grassy-glide")
      .map((a) => (a.kind === ActionKind.UseMove ? a.targetPosition : null));

    // North column: y = 4 (dist 1), y = 3 (dist 2) reachable; y = 2 (dist 3) NOT.
    expect(targets).toContainEqual({ x: 5, y: 3 });
    expect(targets).not.toContainEqual({ x: 5, y: 2 });
  });

  it("extends to distance 4 when the caster starts on Grassy Terrain", () => {
    const caster = makeCaster();
    const { engine, state } = buildMoveTestEngine([caster, makeFoe("foe", { x: 9, y: 9 })], {
      gridSize: 10,
    });
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    const targets = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove && a.moveId === "grassy-glide")
      .map((a) => (a.kind === ActionKind.UseMove ? a.targetPosition : null));

    // Distance 4 now reachable (y = 1); distance 5 (y = 0) still not.
    expect(targets).toContainEqual({ x: 5, y: 1 });
    expect(targets).not.toContainEqual({ x: 5, y: 0 });
  });

  it("range is computed at the start tile — a 4-tile dash can land outside the zone", () => {
    // Zone r3 around (5,5) covers up to y=2 north. A dash of 4 lands on y=1, OUTSIDE the zone.
    const caster = makeCaster();
    const target = makeFoe("foe", { x: 5, y: 1 });
    const { engine, state } = buildMoveTestEngine([caster, target], { gridSize: 10 });
    postFieldTerrain(state, caster, FieldTerrain.Grassy);
    const hpBefore = target.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "grassy-glide",
      targetPosition: { x: 5, y: 1 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("is blocked at the border by an enemy Psychic Terrain barrier", () => {
    const caster = makeCaster({ x: 5, y: 7 });
    const barrierCaster = makeFoe("barrier", { x: 5, y: 3 });
    const victim = makeFoe("victim", { x: 5, y: 4 });
    const { engine, state } = buildMoveTestEngine([caster, barrierCaster, victim], {
      gridSize: 10,
    });
    postFieldTerrain(state, caster, FieldTerrain.Grassy);
    // Enemy Psychic zone centered at (5,3): covers (5,4)..(5,6). Dash north from (5,7) is stopped.
    postFieldTerrain(state, barrierCaster, FieldTerrain.Psychic);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "grassy-glide",
      targetPosition: { x: 5, y: 4 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DashBlockedByPsychicTerrain);
    // Stopped at the last tile before the Psychic zone (zone tile nearest is (5,6) → stop at (5,7)).
    const casterAfter = state.pokemon.get(caster.id);
    expect(casterAfter?.position.y).toBeGreaterThanOrEqual(7);
  });
});
