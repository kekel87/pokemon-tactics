import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { EntryHazardKind } from "../../enums/entry-hazard-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postEntryHazard } from "../entry-hazard-system";

function mover(definitionId = "test") {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "mover",
    definitionId,
    playerId: PlayerId.Player2,
    position: { x: 0, y: 0 },
    derivedStats: { movement: 5, jump: 1, initiative: 100 },
  });
}

function owner() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "owner",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
  });
}

describe("sticky-web", () => {
  it("drops Speed by one stage per trapped tile entered (cumulative)", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.StickyWeb, { x: 0, y: 1 });
    postEntryHazard(state, EntryHazardKind.StickyWeb, { x: 0, y: 2 });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    });

    expect(state.pokemon.get("mover")?.statStages[StatName.Speed]).toBe(-2);
  });

  it("does not slow a Flying-type", () => {
    const { engine, state } = buildMoveTestEngine([mover("pidgey"), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.StickyWeb, { x: 0, y: 1 });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    expect(state.pokemon.get("mover")?.statStages[StatName.Speed]).toBe(0);
  });
});
