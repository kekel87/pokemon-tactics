import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("teeter-dance", () => {
  it("applies confusion to foe within zone radius 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["teeter-dance"],
      currentPp: { "teeter-dance": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "teeter-dance",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusApplied);
    expect(state.pokemon.get(foe.id)?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
    vi.restoreAllMocks();
  });

  it("hits multiple targets in zone radius 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["teeter-dance"],
      currentPp: { "teeter-dance": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe2",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe1, foe2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "teeter-dance",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(foe1.id)?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
    expect(state.pokemon.get(foe2.id)?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
    vi.restoreAllMocks();
  });

  it("does not affect target outside radius 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["teeter-dance"],
      currentPp: { "teeter-dance": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "far-foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, farFoe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "teeter-dance",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get(farFoe.id)?.volatileStatuses).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
