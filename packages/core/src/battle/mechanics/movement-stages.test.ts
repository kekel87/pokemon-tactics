import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("movement recalculation after speed stage changes", () => {
  it("Agility increases movement from 4 to 5 for Growlithe", () => {
    const growlithe = MockPokemon.fresh(MockPokemon.base, {
      id: "growlithe",
      definitionId: "growlithe",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      baseStats: { hp: 55, attack: 70, defense: 45, spAttack: 70, spDefense: 50, speed: 60 },
      moveIds: ["agility"],
      currentPp: { agility: 30 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([growlithe, foe]);

    expect(state.pokemon.get("growlithe")!.derivedStats.movement).toBe(4);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "growlithe",
      moveId: "agility",
      targetPosition: growlithe.position,
    });

    const updated = state.pokemon.get("growlithe")!;
    expect(updated.statStages[StatName.Speed]).toBe(2);
    expect(updated.derivedStats.movement).toBe(5);
  });

  it("Agility pushes Pikachu from movement 5 to 6", () => {
    const pikachu = MockPokemon.fresh(MockPokemon.base, {
      id: "pikachu",
      definitionId: "pikachu",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      baseStats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
      moveIds: ["agility"],
      currentPp: { agility: 30 },
      derivedStats: { movement: 5, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([pikachu, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "pikachu",
      moveId: "agility",
      targetPosition: pikachu.position,
    });

    const updated = state.pokemon.get("pikachu")!;
    expect(updated.statStages[StatName.Speed]).toBe(2);
    expect(updated.derivedStats.movement).toBe(6);
  });
});
