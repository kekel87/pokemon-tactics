import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { FieldTerrain } from "../enums/field-terrain";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle, MockMap, MockPokemon } from "../testing";
import type { MoveDefinition } from "../types/move-definition";
import {
  getFieldTerrainMovePowerMultiplier,
  postFieldTerrain,
  resolveEffectiveTargeting,
  resolveFieldTerrainPulseMove,
} from "./field-terrain-system";
import { resolveNaturePowerMove } from "./nature-power-system";

const NEUTRAL: readonly PokemonType[] = [PokemonType.Normal];

function moveById(id: string): MoveDefinition {
  const move = loadData().moves.find((m) => m.id === id);
  if (!move) {
    throw new Error(`move ${id} not loaded`);
  }
  return move;
}

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
  });
  const target = MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    playerId: PlayerId.Player2,
    position: { x: 5, y: 7 },
  });
  const state = MockBattle.stateFrom([caster, target], 12, 12);
  return { state, caster, target };
}

describe("getFieldTerrainMovePowerMultiplier", () => {
  it("returns 1.0 with no fieldTerrainPowerBonus", () => {
    const { state, caster, target } = setup();
    const move = moveById("tri-attack");
    expect(getFieldTerrainMovePowerMultiplier(state, caster, NEUTRAL, target, NEUTRAL, move)).toBe(
      1.0,
    );
  });

  it("applies the target bonus only when the target is grounded on the terrain", () => {
    const { state, caster, target } = setup();
    const move = moveById("rising-voltage");
    expect(getFieldTerrainMovePowerMultiplier(state, caster, NEUTRAL, target, NEUTRAL, move)).toBe(
      1.0,
    );
    postFieldTerrain(state, target, FieldTerrain.Electric);
    expect(getFieldTerrainMovePowerMultiplier(state, caster, NEUTRAL, target, NEUTRAL, move)).toBe(
      2,
    );
    // Flying target on the zone escapes the gate.
    expect(
      getFieldTerrainMovePowerMultiplier(
        state,
        caster,
        NEUTRAL,
        target,
        [PokemonType.Flying],
        move,
      ),
    ).toBe(1.0);
  });

  it("applies the caster bonus for Misty Explosion / Expanding Force", () => {
    const { state, caster, target } = setup();
    const misty = moveById("misty-explosion");
    postFieldTerrain(state, caster, FieldTerrain.Misty);
    expect(getFieldTerrainMovePowerMultiplier(state, caster, NEUTRAL, target, NEUTRAL, misty)).toBe(
      1.5,
    );
  });
});

describe("resolveFieldTerrainPulseMove", () => {
  it("keeps Normal 50 off terrain and morphs type + power on terrain", () => {
    const { state, caster } = setup();
    const move = moveById("terrain-pulse");
    expect(resolveFieldTerrainPulseMove(state, caster, NEUTRAL, move).type).toBe(move.type);
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    const morphed = resolveFieldTerrainPulseMove(state, caster, NEUTRAL, move);
    expect(morphed.type).toBe(PokemonType.Psychic);
    expect(morphed.power).toBe(100);
  });

  it("does not morph a non-pulse move", () => {
    const { state, caster } = setup();
    const move = moveById("tri-attack");
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    expect(resolveFieldTerrainPulseMove(state, caster, NEUTRAL, move)).toBe(move);
  });
});

describe("resolveEffectiveTargeting", () => {
  it("morphs Expanding Force targeting only on Psychic Terrain (current caster tile)", () => {
    const { state, caster } = setup();
    const move = moveById("expanding-force");
    expect(resolveEffectiveTargeting(move, caster, NEUTRAL, state).kind).toBe(TargetingKind.Single);
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    expect(resolveEffectiveTargeting(move, caster, NEUTRAL, state).kind).toBe(TargetingKind.Blast);
  });
});

describe("resolveNaturePowerMove", () => {
  it("returns the source move unchanged when it is not Nature Power", () => {
    const { state, caster } = setup();
    const tri = moveById("tri-attack");
    const getMove = (id: string): MoveDefinition | undefined =>
      loadData().moves.find((m) => m.id === id);
    const grid = MockMap.buildGridWithHeights(Array.from({ length: 12 }, () => Array(12).fill(0)));
    expect(resolveNaturePowerMove(getMove, state, grid, caster, tri)).toBe(tri);
  });
});
