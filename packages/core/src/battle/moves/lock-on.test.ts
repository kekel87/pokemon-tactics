import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("lock-on", () => {
  it("applies LockedOn volatile status on the user", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["lock-on"],
      currentPp: { "lock-on": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "lock-on",
      targetPosition: { x: 2, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(state.pokemon.get(user.id)?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.LockedOn }),
    );
  });

  it("emits StatusApplied for LockedOn on the user, not the target", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["lock-on"],
      currentPp: { "lock-on": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "lock-on",
      targetPosition: { x: 2, y: 0 },
    });

    vi.restoreAllMocks();

    const statusEvent = result.events.find(
      (e): e is Extract<typeof e, { type: "status_applied" }> =>
        e.type === BattleEventType.StatusApplied,
    );
    expect(statusEvent).toBeDefined();
    expect(statusEvent?.targetId).toBe(user.id);
    expect(state.pokemon.get(foe.id)?.volatileStatuses).toHaveLength(0);
    expect(state.pokemon.get(foe.id)?.statusEffects).toHaveLength(0);
  });

  it("LockedOn is consumed on the next move, bypassing accuracy check", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["lock-on", "thunder-wave"],
      currentPp: { "lock-on": 5, "thunder-wave": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "lock-on",
      targetPosition: { x: 2, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.East,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: foe.id,
      direction: Direction.West,
    });

    vi.restoreAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "thunder-wave",
      targetPosition: { x: 2, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.MoveMissed);
    expect(state.pokemon.get(foe.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Paralyzed }),
    );
    expect(state.pokemon.get(user.id)?.volatileStatuses).not.toContainEqual(
      expect.objectContaining({ type: StatusType.LockedOn }),
    );
  });

  it("cannot hit beyond max range 4", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["lock-on"],
      currentPp: { "lock-on": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "lock-on",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
