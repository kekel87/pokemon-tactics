import { ActionKind, TerrainType } from "@pokemon-tactic/core";
import { buildHeightTestEngine, MockBattle } from "@pokemon-tactic/core/testing";
import { describe, expect, it } from "vitest";

describe("scenario — Ghost traverses obstacles (plan 064)", () => {
  /*
    Given une map 5×5 avec un rocher 1×1×1 (obstacle height=1) en (2,3)
    And Ectoplasma (Ghost) en (1,3)
    When Ectoplasma planifie un chemin vers (3,3) via (2,3)
    Then le chemin réussit (traversée spectre)
  */
  it("gengar path passes through a 1-tile rock to reach the other side", () => {
    const heights = new Map<string, number>();
    const { engine, state } = buildHeightTestEngine({ x: 1, y: 3 }, heights, "gengar");
    MockBattle.setTile(state, 2, 3, { terrain: TerrainType.Obstacle, height: 1 });

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 2, y: 3 },
        { x: 3, y: 3 },
      ],
    });

    expect(result.success).toBe(true);
  });

  /*
    Given la même map
    When Ectoplasma tente de s'arrêter sur le rocher (2,3)
    Then le déplacement échoue (Ghost ne peut pas s'arrêter sur un obstacle)
  */
  it("gengar cannot stop on the obstacle tile", () => {
    const heights = new Map<string, number>();
    const { engine, state } = buildHeightTestEngine({ x: 1, y: 3 }, heights, "gengar");
    MockBattle.setTile(state, 2, 3, { terrain: TerrainType.Obstacle, height: 1 });

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 2, y: 3 }],
    });

    expect(result.success).toBe(false);
  });

  /*
    Given Ectoplasma avec un rocher qui bloque la route directe, et le sol libre derrière
    When on liste les reachable tiles
    Then la tile de l'obstacle n'apparaît PAS (cannot stop)
    And la tile derrière l'obstacle apparaît (phasing ouvre le chemin)
  */
  it("gengar reachable set excludes obstacle but includes ground beyond", () => {
    const heights = new Map<string, number>();
    const { engine, state } = buildHeightTestEngine({ x: 1, y: 3 }, heights, "gengar");
    MockBattle.setTile(state, 2, 3, { terrain: TerrainType.Obstacle, height: 2 });

    const reachable = engine.getReachableTilesForPokemon("mover");

    const onObstacle = reachable.filter((r) => r.x === 2 && r.y === 3);
    const beyond = reachable.filter((r) => r.x === 3 && r.y === 3);

    expect(onObstacle).toHaveLength(0);
    expect(beyond.length).toBeGreaterThan(0);
  });

  /*
    Given un arbre 1×1×3 (obstacle height=3) entre Gengar et sa cible
    When Gengar planifie un chemin à travers l'arbre
    Then le chemin réussit (règle unique: Ghost traverse tous les obstacles, même l'arbre)
  */
  it("gengar traverses a 3-tile-tall tree obstacle (règle unique ghost)", () => {
    const heights = new Map<string, number>();
    const { engine, state } = buildHeightTestEngine({ x: 1, y: 3 }, heights, "gengar");
    MockBattle.setTile(state, 2, 3, { terrain: TerrainType.Obstacle, height: 3 });

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 2, y: 3 },
        { x: 3, y: 3 },
      ],
    });

    expect(result.success).toBe(true);
  });

  /*
    Given Bulbasaur (Grass/Poison, ni Ghost ni Flying) face au même rocher
    When Bulbasaur tente de traverser
    Then le déplacement échoue (seul Ghost/Flying peut franchir)
  */
  it("bulbasaur (non-ghost, non-flying) cannot traverse the obstacle", () => {
    const heights = new Map<string, number>();
    const { engine, state } = buildHeightTestEngine({ x: 1, y: 3 }, heights, "bulbasaur");
    MockBattle.setTile(state, 2, 3, { terrain: TerrainType.Obstacle, height: 1 });

    const result = engine.submitAction("player-1", {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 2, y: 3 },
        { x: 3, y: 3 },
      ],
    });

    expect(result.success).toBe(false);
  });

  /*
    Given Pidgey (Flying) avec un rocher 2×2 (obstacle height=2) à côté
    When Pidgey atterrit sur l'une des 4 tiles supérieures du rocher
    Then le déplacement réussit (Flying perch = 4 slots émergents)
  */
  it("flying yields 4 emergent perch slots on a 2×2 obstacle", () => {
    const heights = new Map<string, number>();
    const { engine, state } = buildHeightTestEngine({ x: 0, y: 3 }, heights, "pidgey");
    MockBattle.setTile(state, 1, 3, { terrain: TerrainType.Obstacle, height: 2 });
    MockBattle.setTile(state, 2, 3, { terrain: TerrainType.Obstacle, height: 2 });
    MockBattle.setTile(state, 1, 4, { terrain: TerrainType.Obstacle, height: 2 });
    MockBattle.setTile(state, 2, 4, { terrain: TerrainType.Obstacle, height: 2 });

    const reachable = engine.getReachableTilesForPokemon("mover");
    const perchTiles = reachable.filter(
      (r) => (r.x === 1 || r.x === 2) && (r.y === 3 || r.y === 4),
    );

    expect(perchTiles).toHaveLength(4);
  });
});
