import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("last-resort", () => {
  it("is not available when not all other moves have been used", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "scratch", "last-resort"],
      currentPp: { tackle: 35, scratch: 35, "last-resort": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      usedMoveIds: ["tackle"],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const actions = engine.getLegalActions(PlayerId.Player1);
    const lastResortActions = actions.filter(
      (a) => a.kind === ActionKind.UseMove && "moveId" in a && a.moveId === "last-resort",
    );

    expect(lastResortActions).toHaveLength(0);
  });

  it("is not available when no other moves have been used at all", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "scratch", "last-resort"],
      currentPp: { tackle: 35, scratch: 35, "last-resort": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const actions = engine.getLegalActions(PlayerId.Player1);
    const lastResortActions = actions.filter(
      (a) => a.kind === ActionKind.UseMove && "moveId" in a && a.moveId === "last-resort",
    );

    expect(lastResortActions).toHaveLength(0);
  });

  it("is available when all other moves have been used at least once", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "scratch", "last-resort"],
      currentPp: { tackle: 35, scratch: 35, "last-resort": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      usedMoveIds: ["tackle", "scratch"],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const actions = engine.getLegalActions(PlayerId.Player1);
    const lastResortActions = actions.filter(
      (a) => a.kind === ActionKind.UseMove && "moveId" in a && a.moveId === "last-resort",
    );

    expect(lastResortActions.length).toBeGreaterThan(0);
  });

  it("deals damage when used legally", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "last-resort"],
      currentPp: { tackle: 35, "last-resort": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      usedMoveIds: ["tackle"],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "last-resort",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
  });
});
