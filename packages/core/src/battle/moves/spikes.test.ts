import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { EntryHazardKind } from "../../enums/entry-hazard-kind";
import { PlayerId } from "../../enums/player-id";
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
    moveIds: ["spikes"],
    currentPp: { spikes: 10 },
  });
}

const triggers = (events: { type: string }[]) =>
  events.filter((e) => e.type === BattleEventType.EntryHazardTriggered);

describe("spikes — posting", () => {
  it("places a single-layer trap on the aimed tile via GroundTarget", () => {
    const { engine, state } = buildMoveTestEngine([owner(), mover()], { gridSize: 8 });
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "owner",
      moveId: "spikes",
      targetPosition: { x: 5, y: 7 },
    });
    expect(result.success).toBe(true);
    const posted = result.events.find((e) => e.type === BattleEventType.EntryHazardPosted);
    expect(posted?.type === BattleEventType.EntryHazardPosted && posted.kind).toBe(
      EntryHazardKind.Spikes,
    );
    expect(state.entryHazards).toHaveLength(1);
    expect(state.entryHazards[0]?.kind).toBe(EntryHazardKind.Spikes);
  });
});

describe("spikes — triggering on entry", () => {
  it("damages an enemy per trapped tile entered (cumulative)", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 1 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 2 });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ],
    });

    expect(result.success).toBe(true);
    expect(triggers(result.events)).toHaveLength(2);
    expect(state.pokemon.get("mover")?.currentHp).toBe(100 - 2 * 12);
  });

  it("deals more per tile as the layer count rises", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 1 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 1 });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    });

    expect(state.pokemon.get("mover")?.currentHp).toBe(100 - 16);
  });

  it("does not trigger on the start tile (entry only)", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 0 });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 1, y: 0 }],
    });

    expect(triggers(result.events)).toHaveLength(0);
    expect(state.pokemon.get("mover")?.currentHp).toBe(100);
  });

  it("triggers on a same-team mon too (team-agnostic)", () => {
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "mover",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 5, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([ally, owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 1 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    });

    expect(triggers(result.events)).toHaveLength(1);
    expect(state.pokemon.get("mover")?.currentHp).toBe(100 - 12);
  });

  it("does not damage a Flying-type (grounded only)", () => {
    const { engine, state } = buildMoveTestEngine([mover("pidgey"), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 1 });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    });

    expect(triggers(result.events)).toHaveLength(0);
    expect(state.pokemon.get("mover")?.currentHp).toBe(100);
  });
});
