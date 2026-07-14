import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { TerrainType } from "../enums/terrain-type";
import { Grid } from "../grid/Grid";
import { MockBattle, MockPokemon } from "../testing";
import { predictKnockbackOutcome } from "./knockback-prediction";

const BASE = MockPokemon.base;

function setup(
  attackerPosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  targetTypes: PokemonType[],
  patches: Array<{ x: number; y: number; terrain?: TerrainType; height?: number }>,
  width = 10,
  extra: Array<{ id: string; x: number; y: number }> = [],
) {
  const target = MockPokemon.fresh(BASE, {
    id: "target",
    position: targetPosition,
    playerId: PlayerId.Player2,
    currentHp: 100,
    maxHp: 100,
  });
  const others = extra.map((e) =>
    MockPokemon.fresh(BASE, {
      id: e.id,
      position: { x: e.x, y: e.y },
      playerId: PlayerId.Player2,
      currentHp: 100,
      maxHp: 100,
    }),
  );
  const state = MockBattle.stateFrom([target, ...others], width, 3);
  for (const patch of patches) {
    MockBattle.setTile(state, patch.x, patch.y, {
      ...(patch.terrain === undefined ? {} : { terrain: patch.terrain }),
      ...(patch.height === undefined ? {} : { height: patch.height }),
    });
  }
  const grid = new Grid(width, 3, state.grid);
  return { attackerPosition, target, grid, state, targetTypes };
}

describe("predictKnockbackOutcome", () => {
  it("returns null when the push is blocked at the map edge", () => {
    const { attackerPosition, target, grid, state, targetTypes } = setup(
      { x: 8, y: 0 },
      { x: 9, y: 0 },
      [PokemonType.Normal],
      [],
    );
    const outcome = predictKnockbackOutcome({
      attackerPosition,
      target,
      distance: 1,
      grid,
      targetTypes,
      state,
    });
    expect(outcome).toBeNull();
  });

  it("flags a lethal fall when pushed off a high ledge", () => {
    const { attackerPosition, target, grid, state, targetTypes } = setup(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      [PokemonType.Normal],
      [
        { x: 1, y: 0, height: 4.5 },
        { x: 2, y: 0, height: 0.5 },
      ],
    );
    const outcome = predictKnockbackOutcome({
      attackerPosition,
      target,
      distance: 1,
      grid,
      targetTypes,
      state,
    });
    expect(outcome?.finalPosition).toEqual({ x: 2, y: 0 });
    expect(outcome?.lethal).toBe(true);
  });

  it("flags a lethal push onto impassable terrain", () => {
    const { attackerPosition, target, grid, state, targetTypes } = setup(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      [PokemonType.Normal],
      [{ x: 2, y: 0, terrain: TerrainType.Lava }],
    );
    const outcome = predictKnockbackOutcome({
      attackerPosition,
      target,
      distance: 1,
      grid,
      targetTypes,
      state,
    });
    expect(outcome?.lethal).toBe(true);
    expect(outcome?.finalPosition).toEqual({ x: 2, y: 0 });
  });

  it("extends the push across ice and adds the fall off the far edge of the plateau", () => {
    const { attackerPosition, target, grid, state, targetTypes } = setup(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      [PokemonType.Normal],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice, height: 4.5 },
        { x: 3, y: 0, terrain: TerrainType.Ice, height: 4.5 },
        { x: 4, y: 0, terrain: TerrainType.Normal, height: 0.5 },
      ],
    );
    const outcome = predictKnockbackOutcome({
      attackerPosition,
      target,
      distance: 1,
      grid,
      targetTypes,
      state,
    });
    expect(outcome?.finalPosition).toEqual({ x: 4, y: 0 });
    expect(outcome?.lethal).toBe(true);
  });

  it("predicts no slide for an Ice-type target", () => {
    const { attackerPosition, target, grid, state, targetTypes } = setup(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      [PokemonType.Ice],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
      ],
    );
    const outcome = predictKnockbackOutcome({
      attackerPosition,
      target,
      distance: 1,
      grid,
      targetTypes,
      state,
    });
    expect(outcome?.finalPosition).toEqual({ x: 2, y: 0 });
    expect(outcome?.lethal).toBe(false);
  });

  it("reports a mid-slide collision id", () => {
    const { attackerPosition, target, grid, state, targetTypes } = setup(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      [PokemonType.Normal],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
      ],
      10,
      [{ id: "blocker", x: 4, y: 0 }],
    );
    const outcome = predictKnockbackOutcome({
      attackerPosition,
      target,
      distance: 1,
      grid,
      targetTypes,
      state,
    });
    expect(outcome?.collisionId).toBe("blocker");
  });
});
