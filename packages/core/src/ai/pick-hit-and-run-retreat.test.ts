import { describe, expect, it } from "vitest";
import { Grid } from "../grid/Grid";
import { MockPokemon } from "../testing";
import { createPrng } from "../utils/prng";
import { pickAiHitAndRunRetreat } from "./pick-hit-and-run-retreat";

function makeGrid(): Grid {
  return Grid.createFlat(10, 10);
}

describe("pickAiHitAndRunRetreat", () => {
  it("returns null when no candidate tile available", () => {
    const grid = makeGrid();
    grid.setOccupant({ x: 4, y: 5 }, "n");
    grid.setOccupant({ x: 6, y: 5 }, "e");
    grid.setOccupant({ x: 5, y: 4 }, "s");
    grid.setOccupant({ x: 5, y: 6 }, "w");
    const result = pickAiHitAndRunRetreat(
      { x: 5, y: 5 },
      { min: 1, max: 1 },
      grid,
      [],
      createPrng(0),
    );
    expect(result).toBeNull();
  });

  it("picks tile farthest from nearest enemy", () => {
    const grid = makeGrid();
    const enemy = { ...MockPokemon.base, id: "enemy1", position: { x: 0, y: 5 } };
    const result = pickAiHitAndRunRetreat(
      { x: 5, y: 5 },
      { min: 1, max: 4 },
      grid,
      [enemy],
      createPrng(0),
    );
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }
    const distanceToEnemy =
      Math.abs(result.x - enemy.position.x) + Math.abs(result.y - enemy.position.y);
    expect(distanceToEnemy).toBe(9);
  });

  it("tie-breaks deterministically via PRNG", () => {
    const grid = makeGrid();
    const enemy = { ...MockPokemon.base, id: "enemy1", position: { x: 5, y: 5 } };
    const r1 = pickAiHitAndRunRetreat(
      { x: 5, y: 5 },
      { min: 1, max: 1 },
      grid,
      [enemy],
      createPrng(42),
    );
    const r2 = pickAiHitAndRunRetreat(
      { x: 5, y: 5 },
      { min: 1, max: 1 },
      grid,
      [enemy],
      createPrng(42),
    );
    expect(r1).toEqual(r2);
  });

  it("returns random candidate when no enemies", () => {
    const grid = makeGrid();
    const result = pickAiHitAndRunRetreat(
      { x: 5, y: 5 },
      { min: 1, max: 1 },
      grid,
      [],
      createPrng(0),
    );
    expect(result).not.toBeNull();
  });
});
