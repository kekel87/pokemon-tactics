import { describe, expect, it } from "vitest";
import { Direction } from "../enums/direction";
import { PlacementMode } from "../enums/placement-mode";
import { PlayerController } from "../enums/player-controller";
import { PlayerId } from "../enums/player-id";
import { MockMap } from "../testing/mock-map";
import type { MapFormat } from "../types/map-format";
import type { PlacementTeam } from "../types/placement-team";
import { PlacementError, PlacementPhase } from "./PlacementPhase";

const { map6x6: testMap, format2v2: testFormat, team1, team2, gridCenter6x6: gridCenter } = MockMap;

describe("PlacementPhase", () => {
  describe("serpentine alternation", () => {
    it("alternates in serpentine order: P1, P2, P2, P1", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );

      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player1 });
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player2 });
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);

      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player2 });
      phase.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West);

      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player1 });
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(phase.isComplete()).toBe(true);
      expect(phase.getNextToPlace()).toBeNull();
    });

    it("allows free choice of which Pokemon to place on your turn", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );

      const result = phase.submitPlacement("poke-b", { x: 0, y: 0 }, Direction.East);
      expect(result.success).toBe(true);

      phase.submitPlacement("poke-d", { x: 4, y: 4 }, Direction.West);
      phase.submitPlacement("poke-c", { x: 5, y: 4 }, Direction.West);
      phase.submitPlacement("poke-a", { x: 1, y: 0 }, Direction.East);

      expect(phase.isComplete()).toBe(true);
    });
  });

  describe("getUnplacedPokemonIds", () => {
    it("returns unplaced Pokemon for a player", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      expect(phase.getUnplacedPokemonIds(PlayerId.Player1)).toEqual(["poke-a", "poke-b"]);

      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      expect(phase.getUnplacedPokemonIds(PlayerId.Player1)).toEqual(["poke-b"]);
    });
  });

  describe("validation", () => {
    it("rejects position outside spawn zone", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      const result = phase.submitPlacement("poke-a", { x: 3, y: 3 }, Direction.East);
      expect(result.success).toBe(false);
      expect(result.error).toBe(PlacementError.PositionOutOfZone);
    });

    it("rejects position already occupied", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      const result = phase.submitPlacement("poke-d", { x: 4, y: 4 }, Direction.West);
      expect(result.success).toBe(false);
      expect(result.error).toBe(PlacementError.PositionOccupied);
    });

    it("rejects Pokemon from wrong player", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      const result = phase.submitPlacement("poke-c", { x: 0, y: 0 }, Direction.East);
      expect(result.success).toBe(false);
      expect(result.error).toBe(PlacementError.WrongPlayer);
    });

    it("rejects placement after completion", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      phase.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West);
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      const result = phase.submitPlacement("poke-a", { x: 0, y: 1 }, Direction.East);
      expect(result.success).toBe(false);
      expect(result.error).toBe(PlacementError.PlacementComplete);
    });
  });

  describe("undo", () => {
    it("undoes the last placement only", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);

      expect(phase.undoLastPlacement()).toBe(true);
      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player2 });

      const result = phase.submitPlacement("poke-c", { x: 5, y: 5 }, Direction.West);
      expect(result.success).toBe(true);
    });

    it("frees the position after undo", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.undoLastPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      expect(phase.getPlacements()).toHaveLength(1);
    });

    it("returns false when nothing to undo", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      expect(phase.undoLastPlacement()).toBe(false);
    });
  });

  describe("autoPlaceAll", () => {
    it("fills all positions without duplicates", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Random,
        42,
      );
      const placements = phase.autoPlaceAll(gridCenter);

      expect(placements).toHaveLength(4);
      expect(phase.isComplete()).toBe(true);

      const positionKeys = new Set(placements.map((p) => `${p.position.x},${p.position.y}`));
      expect(positionKeys.size).toBe(4);

      const pokemonIds = new Set(placements.map((p) => p.pokemonId));
      expect(pokemonIds.size).toBe(4);
    });

    it("is deterministic with the same seed", () => {
      const phase1 = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Random,
        123,
      );
      const placements1 = phase1.autoPlaceAll(gridCenter);

      const phase2 = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Random,
        123,
      );
      const placements2 = phase2.autoPlaceAll(gridCenter);

      expect(placements1).toEqual(placements2);
    });

    it("produces different results with different seeds", () => {
      const phase1 = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Random,
        1,
      );
      const placements1 = phase1.autoPlaceAll(gridCenter);

      const phase2 = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Random,
        999,
      );
      const placements2 = phase2.autoPlaceAll(gridCenter);

      const samePositions = placements1.every((p1, i) => {
        const p2 = placements2[i];
        return p2 && p1.position.x === p2.position.x && p1.position.y === p2.position.y;
      });
      expect(samePositions).toBe(false);
    });
  });

  describe("autoPlaceForPlayer", () => {
    it("only places Pokemon for the specified player", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Random,
        42,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      const placed = phase.autoPlaceForPlayer(PlayerId.Player2, gridCenter);
      expect(placed).toHaveLength(2);

      expect(phase.isComplete()).toBe(false);
      expect(phase.getNextToPlace()?.playerId).toBe(PlayerId.Player1);
    });
  });

  describe("uneven teams", () => {
    it("handles teams of different sizes", () => {
      const smallTeam: PlacementTeam = {
        playerId: PlayerId.Player1,
        pokemonIds: ["poke-a"],
        controller: PlayerController.Human,
      };

      const formatSmall: MapFormat = {
        teamCount: 2,
        maxPokemonPerTeam: 2,
        spawnZones: testFormat.spawnZones,
      };

      const phase = new PlacementPhase(
        testMap,
        [smallTeam, team2],
        formatSmall,
        PlacementMode.Alternating,
      );

      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player1 });
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player2 });
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);

      expect(phase.getNextToPlace()).toEqual({ playerId: PlayerId.Player2 });
      phase.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West);

      expect(phase.isComplete()).toBe(true);
    });
  });

  describe("getPlacements and getPlacedPositions", () => {
    it("returns correct data after placements", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);

      expect(phase.getPlacements()).toHaveLength(2);
      expect(phase.getPlacedPositions()).toEqual([
        { x: 0, y: 0 },
        { x: 4, y: 4 },
      ]);
    });

    it("returns copies, not references", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      const placements = phase.getPlacements();
      placements.pop();
      expect(phase.getPlacements()).toHaveLength(1);
    });
  });
});
