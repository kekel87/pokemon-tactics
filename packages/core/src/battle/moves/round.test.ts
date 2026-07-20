import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

describe("round", () => {
  it("deals damage to a target in range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["round"],
      currentPp: { round: 15 },
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
      moveId: "round",
      targetPosition: { x: 2, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["round"],
      currentPp: { round: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "round",
      targetPosition: { x: 4, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBe(0);
  });

  it("roughly doubles when the team's last action was round", () => {
    const normal = (() => {
      const a = MockPokemon.fresh(MockPokemon.base, {
        id: "a",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["round"],
        currentPp: { round: 15 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const d = MockPokemon.fresh(MockPokemon.base, {
        id: "d",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildMoveTestEngine([a, d], { random: () => 0.5 });
      return damageTo(
        engine.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: "a",
          moveId: "round",
          targetPosition: { x: 2, y: 0 },
        }).events,
        "d",
      );
    })();

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["round"],
      currentPp: { round: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    state.lastTeamActionMoveId = { [PlayerId.Player1]: "round" };

    const boosted = damageTo(
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "round",
        targetPosition: { x: 2, y: 0 },
      }).events,
      "defender",
    );

    expect(boosted).toBeGreaterThanOrEqual(normal * 1.8);
    expect(boosted).toBeLessThanOrEqual(normal * 2.2);
  });

  it("does not double when the team's last action was a different move", () => {
    const normal = (() => {
      const a = MockPokemon.fresh(MockPokemon.base, {
        id: "a",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["round"],
        currentPp: { round: 15 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const d = MockPokemon.fresh(MockPokemon.base, {
        id: "d",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildMoveTestEngine([a, d], { random: () => 0.5 });
      return damageTo(
        engine.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: "a",
          moveId: "round",
          targetPosition: { x: 2, y: 0 },
        }).events,
        "d",
      );
    })();

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["round"],
      currentPp: { round: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    state.lastTeamActionMoveId = { [PlayerId.Player1]: "tackle" };

    const unboosted = damageTo(
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "round",
        targetPosition: { x: 2, y: 0 },
      }).events,
      "defender",
    );

    expect(unboosted).toBeGreaterThanOrEqual(normal * 0.9);
    expect(unboosted).toBeLessThanOrEqual(normal * 1.1);
  });
});
