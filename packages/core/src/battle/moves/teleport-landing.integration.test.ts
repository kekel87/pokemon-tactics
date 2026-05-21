import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { TerrainType } from "../../enums/terrain-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { createPrng } from "../../utils/prng";

function paintTile(
  state: ReturnType<typeof buildMoveTestEngine>["state"],
  pos: { x: number; y: number },
  terrain: TerrainType,
): void {
  const row = state.grid[pos.y];
  if (row) {
    const tile = row[pos.x];
    if (tile) {
      tile.terrain = terrain;
    }
  }
}

describe("teleport landing — terrain integration", () => {
  it("Given non-Flying / non-Fire caster lands on lava target, When TP resolves, Then LethalTerrainKo emitted", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["teleport"],
      currentPp: { teleport: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 7, y: 7 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    paintTile(state, { x: 3, y: 3 }, TerrainType.Lava);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "teleport",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.success).toBe(true);
    const lethal = result.events.find((e) => e.type === BattleEventType.LethalTerrainKo);
    expect(lethal).toBeDefined();
    const ko = result.events.find((e) => e.type === BattleEventType.PokemonKo);
    expect(ko).toBeDefined();
  });

  it("Given Flying caster lands on deep_water target, When TP resolves, Then no LethalTerrainKo", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["teleport"],
      currentPp: { teleport: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 7, y: 7 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    paintTile(state, { x: 3, y: 3 }, TerrainType.DeepWater);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "teleport",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.success).toBe(true);
    const lethal = result.events.find((e) => e.type === BattleEventType.LethalTerrainKo);
    expect(lethal).toBeUndefined();
  });
});
