import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

describe("retaliate", () => {
  it("deals damage to an adjacent target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["retaliate"],
      currentPp: { retaliate: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "retaliate",
      targetPosition: { x: 1, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["retaliate"],
      currentPp: { retaliate: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "retaliate",
      targetPosition: { x: 2, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBe(0);
  });

  it("roughly doubles when an ally fainted since last action", () => {
    const normal = (() => {
      const a = MockPokemon.fresh(MockPokemon.base, {
        id: "a",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["retaliate"],
        currentPp: { retaliate: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const d = MockPokemon.fresh(MockPokemon.base, {
        id: "d",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildMoveTestEngine([a, d], { random: () => 0.5 });
      return damageTo(
        engine.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: "a",
          moveId: "retaliate",
          targetPosition: { x: 1, y: 0 },
        }).events,
        "d",
      );
    })();

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["retaliate"],
      currentPp: { retaliate: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      lastActedAtAction: 1,
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    state.lastAllyFaintAtAction = { [PlayerId.Player1]: 5 };
    state.actionCounter = 6;

    const boosted = damageTo(
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "retaliate",
        targetPosition: { x: 1, y: 0 },
      }).events,
      "defender",
    );

    expect(boosted).toBeGreaterThanOrEqual(normal * 1.8);
    expect(boosted).toBeLessThanOrEqual(normal * 2.2);
  });

  it("does not double when no ally fainted since last action", () => {
    const normal = (() => {
      const a = MockPokemon.fresh(MockPokemon.base, {
        id: "a",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["retaliate"],
        currentPp: { retaliate: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const d = MockPokemon.fresh(MockPokemon.base, {
        id: "d",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildMoveTestEngine([a, d], { random: () => 0.5 });
      return damageTo(
        engine.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: "a",
          moveId: "retaliate",
          targetPosition: { x: 1, y: 0 },
        }).events,
        "d",
      );
    })();

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["retaliate"],
      currentPp: { retaliate: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      lastActedAtAction: 5,
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    state.lastAllyFaintAtAction = { [PlayerId.Player1]: 3 };
    state.actionCounter = 6;

    const unboosted = damageTo(
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "retaliate",
        targetPosition: { x: 1, y: 0 },
      }).events,
      "defender",
    );

    expect(unboosted).toBeGreaterThanOrEqual(normal * 0.9);
    expect(unboosted).toBeLessThanOrEqual(normal * 1.1);
  });
});
