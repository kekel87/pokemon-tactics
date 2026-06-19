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
    moveIds: ["stealth-rock"],
    currentPp: { "stealth-rock": 10 },
  });
}

describe("stealth-rock", () => {
  it("posts a trap on the aimed tile", () => {
    const { engine, state } = buildMoveTestEngine([owner(), mover()], { gridSize: 8 });
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "owner",
      moveId: "stealth-rock",
      targetPosition: { x: 5, y: 7 },
    });
    expect(result.success).toBe(true);
    expect(state.entryHazards[0]?.kind).toBe(EntryHazardKind.StealthRock);
  });

  it("damages a grounded enemy on entry", () => {
    const { engine, state } = buildMoveTestEngine([mover(), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.StealthRock, { x: 0, y: 1 });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    const triggered = result.events.find((e) => e.type === BattleEventType.EntryHazardTriggered);
    expect(
      triggered?.type === BattleEventType.EntryHazardTriggered && triggered.damage,
    ).toBeGreaterThan(0);
    expect(state.pokemon.get("mover")?.currentHp).toBeLessThan(100);
  });

  it("also damages a Flying-type (hits everyone, unlike Picots)", () => {
    const { engine, state } = buildMoveTestEngine([mover("pidgey"), owner()], { gridSize: 8 });
    postEntryHazard(state, EntryHazardKind.StealthRock, { x: 0, y: 1 });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 0, y: 1 }],
    });

    expect(state.pokemon.get("mover")?.currentHp).toBeLessThan(100);
  });
});
