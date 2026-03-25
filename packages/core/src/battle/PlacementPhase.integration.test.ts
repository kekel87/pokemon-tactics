import { pocArena } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { PlacementMode } from "../enums/placement-mode";
import { PlayerController } from "../enums/player-controller";
import { PlayerId } from "../enums/player-id";
import { buildTestEngineFromPlacements } from "../testing/build-test-engine";
import type { PlacementTeam } from "../types/placement-team";
import { PlacementPhase } from "./PlacementPhase";

const teams: PlacementTeam[] = [
  {
    playerId: PlayerId.Player1,
    pokemonIds: ["p1-bulbasaur", "p1-squirtle"],
    controller: PlayerController.Human,
  },
  {
    playerId: PlayerId.Player2,
    pokemonIds: ["p2-charmander", "p2-pidgey"],
    controller: PlayerController.Human,
  },
];

describe("PlacementPhase -> BattleEngine integration", () => {
  it("creates a working BattleEngine from placement results", () => {
    const map = pocArena;
    const format = map.formats[0];
    if (!format) {
      throw new Error("Missing format");
    }

    const gridCenter = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };

    const phase = new PlacementPhase(map, teams, format, PlacementMode.Random, 42);
    const placements = phase.autoPlaceAll(gridCenter);

    expect(placements).toHaveLength(4);
    expect(phase.isComplete()).toBe(true);

    const { engine, state } = buildTestEngineFromPlacements(placements, teams);

    expect(state.pokemon.size).toBe(4);

    for (const placement of placements) {
      const pokemon = state.pokemon.get(placement.pokemonId);
      expect(pokemon).toBeDefined();
      expect(pokemon?.position).toEqual(placement.position);
      expect(pokemon?.orientation).toBe(placement.direction);

      const row = state.grid[placement.position.y];
      const tile = row?.[placement.position.x];
      expect(tile?.occupantId).toBe(placement.pokemonId);
    }

    const firstTurnId = state.turnOrder[0];
    if (!firstTurnId) {
      throw new Error("No turn order");
    }
    const activePlayerId = state.pokemon.get(firstTurnId)?.playerId;
    if (!activePlayerId) {
      throw new Error("No active player");
    }
    const actions = engine.getLegalActions(activePlayerId);
    expect(actions.length).toBeGreaterThan(0);

    const endTurnActions = actions.filter((action) => action.kind === ActionKind.EndTurn);
    expect(endTurnActions).toHaveLength(4);
  });

  it("manual placement produces a valid engine", () => {
    const map = pocArena;
    const format = map.formats[0];
    if (!format) {
      throw new Error("Missing format");
    }

    const phase = new PlacementPhase(map, teams, format, PlacementMode.Alternating);

    phase.submitPlacement("p1-bulbasaur", { x: 1, y: 10 }, Direction.North);
    phase.submitPlacement("p2-charmander", { x: 10, y: 1 }, Direction.South);
    phase.submitPlacement("p2-pidgey", { x: 9, y: 0 }, Direction.South);
    phase.submitPlacement("p1-squirtle", { x: 2, y: 11 }, Direction.North);

    const placements = phase.getPlacements();
    const { engine, state } = buildTestEngineFromPlacements(placements, teams);

    expect(state.pokemon.size).toBe(4);
    const bulbasaur = state.pokemon.get("p1-bulbasaur");
    expect(bulbasaur?.position).toEqual({ x: 1, y: 10 });
    expect(bulbasaur?.orientation).toBe(Direction.North);

    const firstTurnId = state.turnOrder[0];
    if (!firstTurnId) {
      throw new Error("No turn order");
    }
    const activePlayerId = state.pokemon.get(firstTurnId)?.playerId;
    if (!activePlayerId) {
      throw new Error("No active player");
    }
    const actions = engine.getLegalActions(activePlayerId);
    expect(actions.length).toBeGreaterThan(0);
  });
});
