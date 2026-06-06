import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("snore", () => {
  it("is not available as a legal action when the user is awake", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["snore"],
      currentPp: { snore: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const actions = engine.getLegalActions(PlayerId.Player1);
    const snoreActions = actions.filter(
      (a) => a.kind === ActionKind.UseMove && "moveId" in a && a.moveId === "snore",
    );

    expect(snoreActions).toHaveLength(0);
  });

  it("is available as a legal action when the user is asleep", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["snore"],
      currentPp: { snore: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 2 }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const actions = engine.getLegalActions(PlayerId.Player1);
    const snoreActions = actions.filter(
      (a) => a.kind === ActionKind.UseMove && "moveId" in a && a.moveId === "snore",
    );

    expect(snoreActions.length).toBeGreaterThan(0);
  });

  it("deals damage when the user is asleep", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["snore"],
      currentPp: { snore: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 2 }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "snore",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
  });

  it("applies flinch when the random proc triggers", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["snore"],
      currentPp: { snore: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 2 }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe], { random: () => 0 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "snore",
      targetPosition: { x: 2, y: 0 },
    });

    const foeState = state.pokemon.get("foe")!;
    expect(foeState.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Flinch }),
    );
  });

  it("does not apply flinch when the proc does not trigger", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["snore"],
      currentPp: { snore: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 2 }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "snore",
      targetPosition: { x: 2, y: 0 },
    });

    const foeState = state.pokemon.get("foe")!;
    expect(foeState.volatileStatuses.some((v) => v.type === StatusType.Flinch)).toBe(false);
  });
});
