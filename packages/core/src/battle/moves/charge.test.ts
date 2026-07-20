import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

describe("charge", () => {
  it("raises the user SpDefense by 1 stage", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["charge"],
      currentPp: { charge: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0.5 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "charge",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get(user.id)?.statStages[StatName.SpDefense]).toBe(1);
  });

  it("applies the Charged volatile to the user", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["charge"],
      currentPp: { charge: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0.5 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "charge",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get(user.id)?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Charged }),
    );
  });

  it("roughly doubles the next Electric move when the Charged volatile is present", () => {
    const foe1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe1",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attackerNoCharge = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-no-charge",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["spark"],
      currentPp: { spark: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine: engineNormal } = buildMoveTestEngine([attackerNoCharge, foe1], {
      random: () => 0.5,
    });
    const normal = damageTo(
      engineNormal.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attackerNoCharge.id,
        moveId: "spark",
        targetPosition: { x: 1, y: 0 },
      }).events,
      "foe1",
    );

    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe2",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attackerCharged = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-charged",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["spark"],
      currentPp: { spark: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Charged, remainingTurns: 1 }],
    });
    const { engine: engineCharged } = buildMoveTestEngine([attackerCharged, foe2], {
      random: () => 0.5,
    });
    const charged = damageTo(
      engineCharged.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attackerCharged.id,
        moveId: "spark",
        targetPosition: { x: 1, y: 0 },
      }).events,
      "foe2",
    );

    expect(charged).toBeGreaterThanOrEqual(normal * 1.8);
    expect(charged).toBeLessThanOrEqual(normal * 2.2);
  });

  it("removes the Charged volatile after using an Electric move", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["spark"],
      currentPp: { spark: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Charged, remainingTurns: 1 }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0.5 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "spark",
      targetPosition: { x: 1, y: 0 },
    });

    const userState = state.pokemon.get(user.id)!;
    expect(userState.volatileStatuses.some((v) => v.type === StatusType.Charged)).toBe(false);
  });

  it("does not consume the Charged volatile when a non-Electric move is used", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Charged, remainingTurns: 1 }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0.5 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    const userState = state.pokemon.get(user.id)!;
    expect(userState.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Charged }),
    );
  });
});
