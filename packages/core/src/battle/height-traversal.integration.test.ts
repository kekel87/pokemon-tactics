import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { TerrainType } from "../enums/terrain-type";
import { buildHeightTestEngine } from "../testing/build-height-test-engine";
import { MockBattle } from "../testing/mock-battle";

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

  describe("ghost traversal", () => {
    // Given Gengar (Ghost/Poison) at (3,3) with a rock obstacle at (4,3) height=1
    // And open ground at (5,3)
    // When Gengar plans a path through the rock to (5,3)
    // Then the path succeeds (Ghost phases through the obstacle)
    it("ghost Pokemon can traverse a 1-tile-high obstacle", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "gengar");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 1 });

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

    // Given Gengar at (3,3) next to a 3-tile-tall tree obstacle at (4,3)
    // When Gengar tries to traverse the tree
    // Then it succeeds (Ghost ignores height entirely when phasing)
    it("ghost Pokemon can traverse a 3-tile-high obstacle (tree)", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "gengar");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 3 });

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

    // Given Gengar next to an obstacle
    // When Gengar tries to END its move on the obstacle tile
    // Then the move fails (Ghost cannot stop inside an obstacle)
    it("ghost Pokemon cannot stop on an obstacle", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "gengar");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 1 });

      const result = engine.submitAction("player-1", {
        kind: ActionKind.Move,
        pokemonId: "mover",
        path: [{ x: 4, y: 3 }],
      });

      expect(result.success).toBe(false);
    });

    // Given Gengar surrounded by obstacles (should still be able to reach non-obstacle neighbors)
    // When listing reachable tiles
    // Then obstacle tiles NEVER appear as reachable stops, only normal ground beyond
    it("ghost reachable tiles exclude obstacles (cannot stop inside)", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "gengar");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 1 });

      const reachable = engine.getReachableTilesForPokemon("mover");
      const onObstacle = reachable.filter((r) => r.x === 4 && r.y === 3);
      expect(onObstacle).toHaveLength(0);
    });

    // Given Gengar with an obstacle blocking a path, and open ground beyond
    // When listing reachable tiles
    // Then tiles beyond the obstacle ARE reachable (phasing opens paths)
    it("ghost reachable tiles include ground beyond an obstacle", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "gengar");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 2 });

      const reachable = engine.getReachableTilesForPokemon("mover");
      const beyond = reachable.filter((r) => r.x === 5 && r.y === 3);
      expect(beyond.length).toBeGreaterThan(0);
    });

    // Given a non-ghost Pokemon (Bulbasaur) and an obstacle
    // When trying to traverse the obstacle
    // Then the move fails (normal Pokemon cannot phase)
    it("non-ghost non-flying Pokemon cannot traverse an obstacle", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "bulbasaur");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 1 });

      const result = engine.submitAction("player-1", {
        kind: ActionKind.Move,
        pokemonId: "mover",
        path: [
          { x: 4, y: 3 },
          { x: 5, y: 3 },
        ],
      });

      expect(result.success).toBe(false);
    });
  });

  describe("flying perch on obstacle", () => {
    // Given Pidgey (Flying) at (3,3) with a 2-tile rock obstacle at (4,3)
    // When Pidgey ends its move on top of the rock
    // Then the move succeeds (Flying perches on obstacle)
    it("flying Pokemon can perch on a 2-tile-high obstacle", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "pidgey");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 2 });

      const result = engine.submitAction("player-1", {
        kind: ActionKind.Move,
        pokemonId: "mover",
        path: [{ x: 4, y: 3 }],
      });

      expect(result.success).toBe(true);
    });

    // Given Pidgey with a 2×2 obstacle block
    // When listing reachable tiles
    // Then each of the 4 obstacle tiles is reachable (4 perch slots)
    it("flying reachable tiles include 4 perch slots on a 2×2 obstacle block", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 1, y: 3 }, heights, "pidgey");
      MockBattle.setTile(state, 3, 3, { terrain: TerrainType.Obstacle, height: 2 });
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 2 });
      MockBattle.setTile(state, 3, 4, { terrain: TerrainType.Obstacle, height: 2 });
      MockBattle.setTile(state, 4, 4, { terrain: TerrainType.Obstacle, height: 2 });

      const reachable = engine.getReachableTilesForPokemon("mover");
      const perchPositions = reachable.filter(
        (r) => (r.x === 3 || r.x === 4) && (r.y === 3 || r.y === 4),
      );
      expect(perchPositions).toHaveLength(4);
    });

    // Given non-flying non-ghost Pokemon
    // When trying to perch on an obstacle
    // Then the move fails
    it("non-flying non-ghost Pokemon cannot perch on an obstacle", () => {
      const heights = new Map<string, number>();
      const { engine, state } = buildHeightTestEngine({ x: 3, y: 3 }, heights, "bulbasaur");
      MockBattle.setTile(state, 4, 3, { terrain: TerrainType.Obstacle, height: 1 });

      const result = engine.submitAction("player-1", {
        kind: ActionKind.Move,
        pokemonId: "mover",
        path: [{ x: 4, y: 3 }],
      });

      expect(result.success).toBe(false);
    });
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
