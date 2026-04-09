import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { buildHeightTestEngine } from "../testing/build-height-test-engine";

describe("height traversal — movement integration", () => {
  // Given a Pokemon at h0 next to a tile at h0.5 (half-tile)
  // When it moves to the half-tile
  // Then the move succeeds
  it("can climb a half-tile (h0 → h0.5)", () => {
    const heights = new Map([
      ["3,3", 0],
      ["4,3", 0.5],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 4, y: 3 }],
    });

    expect(result.success).toBe(true);
  });

  // Given a ramp: h0 → h0.5 → h1.0
  // When the Pokemon walks the full ramp
  // Then the move succeeds (2 movement points)
  it("can climb a full tile via ramp (h0 → h0.5 → h1)", () => {
    const heights = new Map([
      ["3,3", 0],
      ["4,3", 0.5],
      ["5,3", 1],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 4, y: 3 },
        { x: 5, y: 3 },
      ],
    });

    expect(result.success).toBe(true);
  });

  // Given a Pokemon at h0 next to a tile at h1 (no ramp)
  // When it tries to move there
  // Then the move fails (climb > 0.5)
  it("cannot climb a full tile directly (h0 → h1)", () => {
    const heights = new Map([
      ["3,3", 0],
      ["4,3", 1],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 4, y: 3 }],
    });

    expect(result.success).toBe(false);
  });

  // Given a Pokemon at h1 next to a tile at h0
  // When it moves down
  // Then the move succeeds (descent is always free)
  it("can descend a full tile (h1 → h0)", () => {
    const heights = new Map([
      ["3,3", 1],
      ["4,3", 0],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 4, y: 3 }],
    });

    expect(result.success).toBe(true);
  });

  // Given a Pokemon at h3 next to a tile at h0
  // When it moves down 3 levels voluntarily
  // Then the move is blocked (descent limited to 1 tile)
  it("cannot descend more than 1 tile (h3 → h0 is blocked)", () => {
    const heights = new Map([
      ["3,3", 3],
      ["4,3", 0],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 4, y: 3 }],
    });

    expect(result.success).toBe(false);
  });

  // Given a Pokemon at h1 next to a tile at h0
  // When it moves down exactly 1 tile
  // Then the move succeeds (1-tile descent allowed)
  it("can descend exactly 1 tile (h1 → h0)", () => {
    const heights = new Map([
      ["3,3", 1],
      ["4,3", 0],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 4, y: 3 }],
    });

    expect(result.success).toBe(true);
  });

  // Given a Flying Pokemon at h0 next to a tile at h3
  // When it moves there
  // Then the move succeeds (Flying ignores height)
  it("flying Pokemon can climb any height", () => {
    const heights = new Map([
      ["3,3", 0],
      ["4,3", 3],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "pidgey");

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 4, y: 3 }],
    });

    expect(result.success).toBe(true);
  });

  // Given tiles: h0, h0.5, h1, h1.5, h2
  // When a non-flying Pokemon tries to reach h2
  // Then it needs to follow the ramp (4 steps)
  it("ramp traversal: h0 → h0.5 → h1 → h1.5 → h2", () => {
    const heights = new Map([
      ["2,3", 0],
      ["3,3", 0.5],
      ["4,3", 1],
      ["5,3", 1.5],
      ["6,3", 2],
    ]);
    const { engine } = buildHeightTestEngine({ x: 2, y: 3 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 3 },
        { x: 6, y: 3 },
      ],
    });

    expect(result.success).toBe(true);
  });

  // Given a blocked climb, the tile should NOT appear in reachable tiles
  it("h1 tile is not reachable from h0 without ramp", () => {
    const heights = new Map([
      ["3,3", 0],
      ["4,3", 1],
      ["2,3", 1],
      ["3,2", 1],
      ["3,4", 1],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const reachable = engine.getReachableTilesForPokemon("mover");
    expect(reachable).toHaveLength(0);
  });

  // Given a Pokemon on a h1 tile, surrounded by h0 tiles
  // Verify that a 1-tile descent opens reachable tiles
  it("descent opens reachable tiles", () => {
    const heights = new Map([
      ["3,3", 1],
      ["4,3", 0],
      ["2,3", 0],
      ["3,2", 0],
      ["3,4", 0],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const reachable = engine.getReachableTilesForPokemon("mover");
    expect(reachable.length).toBeGreaterThan(0);
  });

  // Given a Pokemon on a h2 tile, surrounded by h0 tiles
  // Verify that a 2-tile descent is blocked (descent limit)
  it("blocks reachable tiles when descent exceeds 1", () => {
    const heights = new Map([
      ["3,3", 2],
      ["4,3", 0],
      ["2,3", 0],
      ["3,2", 0],
      ["3,4", 0],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    const reachable = engine.getReachableTilesForPokemon("mover");
    expect(reachable).toHaveLength(0);
  });

  it("end turn with direction after movement", () => {
    const heights = new Map([
      ["3,3", 0],
      ["4,3", 0.5],
    ]);
    const { engine } = buildHeightTestEngine({ x: 3, y: 3 }, heights);

    engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 4, y: 3 }],
    });

    const endResult = engine.submitAction("player-1", {
      kind: ActionKind.EndTurn,
      pokemonId: "mover",
      direction: Direction.North,
    });

    expect(endResult.success).toBe(true);
  });
});
