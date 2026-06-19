import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { EntryHazardKind } from "../../enums/entry-hazard-kind";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
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
    moveIds: ["toxic-spikes"],
    currentPp: { "toxic-spikes": 10 },
  });
}

function hasStatus(pokemon: { statusEffects: { type: string }[] } | undefined, status: string) {
  return pokemon?.statusEffects.some((s) => s.type === status) ?? false;
}

describe("toxic-spikes", () => {
  it("poisons a grounded enemy on entry", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 0, y: 1 });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    expect(hasStatus(state.pokemon.get("mover"), StatusType.Poisoned)).toBe(true);
  });

  it("badly poisons at 2 layers", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 0, y: 1 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 0, y: 1 });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    expect(hasStatus(state.pokemon.get("mover"), StatusType.BadlyPoisoned)).toBe(true);
  });

  it("only applies the status once per traversal (idempotent)", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 0, y: 1 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 0, y: 2 });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    });

    const triggers = result.events.filter((e) => e.type === BattleEventType.EntryHazardTriggered);
    expect(triggers).toHaveLength(1);
  });

  it("is absorbed (dissolved) by a grounded Poison-type", () => {
    const { engine, state } = buildMoveTestEngine([mover("grimer"), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 0, y: 1 });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    expect(result.events.some((e) => e.type === BattleEventType.EntryHazardAbsorbed)).toBe(true);
    expect(state.entryHazards).toHaveLength(0);
    expect(hasStatus(state.pokemon.get("mover"), StatusType.Poisoned)).toBe(false);
  });

  it("does not affect a Flying-type", () => {
    const { engine, state } = buildMoveTestEngine([mover("pidgey"), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 0, y: 1 });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    expect(hasStatus(state.pokemon.get("mover"), StatusType.Poisoned)).toBe(false);
  });
});
