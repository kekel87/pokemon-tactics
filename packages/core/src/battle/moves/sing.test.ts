import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("sing", () => {
  it("applies sleep to target in cone when accuracy hits", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["sing"],
      currentPp: { sing: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sing",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const statusEvents = result.events.filter((e) => e.type === BattleEventType.StatusApplied);
    expect(statusEvents).toHaveLength(1);
    expect(state.pokemon.get(foe.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Asleep }),
    );
    vi.restoreAllMocks();
  });

  it("applies sleep to all targets in cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["sing"],
      currentPp: { sing: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-2",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foe1, foe2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sing",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const statusEvents = result.events.filter((e) => e.type === BattleEventType.StatusApplied);
    expect(statusEvents).toHaveLength(2);
    expect(state.pokemon.get(foe1.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Asleep }),
    );
    expect(state.pokemon.get(foe2.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Asleep }),
    );
    vi.restoreAllMocks();
  });

  it("does not affect target outside cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["sing"],
      currentPp: { sing: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeOutside = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-outside",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foeInside = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-inside",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foeOutside, foeInside]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sing",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foeOutside.id)?.statusEffects).toHaveLength(0);
    expect(state.pokemon.get(foeInside.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Asleep }),
    );
    vi.restoreAllMocks();
  });

  it("misses when accuracy check fails", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["sing"],
      currentPp: { sing: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sing",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foe.id)?.statusEffects).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
