import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

describe("echoed-voice", () => {
  it("deals damage to a target in range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["echoed-voice"],
      currentPp: { "echoed-voice": 15 },
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
      moveId: "echoed-voice",
      targetPosition: { x: 2, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["echoed-voice"],
      currentPp: { "echoed-voice": 15 },
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
      moveId: "echoed-voice",
      targetPosition: { x: 4, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBe(0);
  });

  it("deals more damage when team last used echoed-voice (echoStreak >= 2)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["echoed-voice"],
      currentPp: { "echoed-voice": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine: engineBase } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    const base = damageTo(
      engineBase.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "echoed-voice",
        targetPosition: { x: 2, y: 0 },
      }).events,
      "defender",
    );

    const attacker2 = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker2",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["echoed-voice"],
      currentPp: { "echoed-voice": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender2 = MockPokemon.fresh(MockPokemon.base, {
      id: "defender2",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: engineStreaked, state: state2 } = buildMoveTestEngine([attacker2, defender2], {
      random: () => 0.5,
    });
    state2.echoStreak = 2;
    state2.lastTeamActionMoveId = { [PlayerId.Player1]: "echoed-voice" };

    const streaked = damageTo(
      engineStreaked.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker2.id,
        moveId: "echoed-voice",
        targetPosition: { x: 2, y: 0 },
      }).events,
      "defender2",
    );

    expect(streaked).toBeGreaterThan(base);
  });

  it("resets to base power when a different move was used last", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["echoed-voice"],
      currentPp: { "echoed-voice": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    state.echoStreak = 4;
    state.lastTeamActionMoveId = { [PlayerId.Player1]: "tackle" };

    const base = (() => {
      const a2 = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker2",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["echoed-voice"],
        currentPp: { "echoed-voice": 15 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const d2 = MockPokemon.fresh(MockPokemon.base, {
        id: "defender2",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: e2 } = buildMoveTestEngine([a2, d2], { random: () => 0.5 });
      return damageTo(
        e2.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: "attacker2",
          moveId: "echoed-voice",
          targetPosition: { x: 2, y: 0 },
        }).events,
        "defender2",
      );
    })();

    const reset = damageTo(
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "echoed-voice",
        targetPosition: { x: 2, y: 0 },
      }).events,
      "defender",
    );

    expect(reset).toBeGreaterThanOrEqual(base * 0.9);
    expect(reset).toBeLessThanOrEqual(base * 1.1);
  });
});
