import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveRegistry, buildMoveTestEngine, MockPokemon } from "../../testing";
import { isMetronomeCallable } from "../move-copy/callable-moves";

describe("metronome", () => {
  const pool = [...buildMoveRegistry().values()].filter(isMetronomeCallable);
  const indexOf = (id: string) => pool.findIndex((move) => move.id === id);
  const rollOf = (id: string) => (indexOf(id) + 0.5) / pool.length;

  it("rolls a callable move with its identity hidden (reveal=false)", () => {
    const user = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["metronome"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { engine } = buildMoveTestEngine([user, foe], { random: () => rollOf("tackle") });

    const result = engine.prepareCalledMove(user.id, "metronome");

    expect("failed" in result).toBe(false);
    if ("failed" in result) {
      return;
    }
    expect(result.reveal).toBe(false);
    expect(result.calledMoveId).toBe("tackle");
  });

  it("locks the rolled move across re-selection (no reroll on the same turn)", () => {
    const user = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["metronome"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    let calls = 0;
    const random = () => {
      calls += 1;
      return calls === 1 ? rollOf("tackle") : rollOf("ember");
    };
    const { engine } = buildMoveTestEngine([user, foe], { random });

    const first = engine.prepareCalledMove(user.id, "metronome");
    const second = engine.prepareCalledMove(user.id, "metronome");

    expect("failed" in first || "failed" in second).toBe(false);
    if ("failed" in first || "failed" in second) {
      return;
    }
    expect(second.calledMoveId).toBe(first.calledMoveId);
    expect(first.calledMoveId).toBe("tackle");
  });

  it("executes the rolled move and records it as the global last move", () => {
    const user = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["metronome"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => rollOf("tackle") });

    engine.prepareCalledMove(user.id, "metronome");
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "metronome",
      targetPosition: { x: 2, y: 1 },
    });

    expect(result.success).toBe(true);
    expect(
      result.events.some(
        (event) => event.type === BattleEventType.MoveStarted && event.resolvedMoveId === "tackle",
      ),
    ).toBe(true);
    expect(state.pokemon.get("foe-1")?.currentHp).toBeLessThan(foe.maxHp);
    expect(state.pokemon.get(user.id)?.lastUsedMoveId).toBe("metronome");
    expect(state.lastMoveUsedGlobally).toBe("tackle");
  });
});
