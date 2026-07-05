import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["fake-out", "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([attacker, defender]);
}

describe("fake-out", () => {
  it("is legal on the user's first action and flinches the target", () => {
    const { engine, state } = setup();
    const legalMoveIds = engine
      .getLegalActions(PlayerId.Player1)
      .filter((action) => action.kind === ActionKind.UseMove)
      .map((action) => (action.kind === ActionKind.UseMove ? action.moveId : ""));
    expect(legalMoveIds).toContain("fake-out");

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "fake-out",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Flinch }),
    );
  });

  it("is no longer legal after the user has acted once", () => {
    const { engine, state } = setup();
    const attacker = state.pokemon.get("attacker");
    if (attacker) {
      attacker.lastActedAtAction = 1;
    }
    const legalMoveIds = engine
      .getLegalActions(PlayerId.Player1)
      .filter((action) => action.kind === ActionKind.UseMove)
      .map((action) => (action.kind === ActionKind.UseMove ? action.moveId : ""));
    expect(legalMoveIds).not.toContain("fake-out");

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "fake-out",
      targetPosition: { x: 1, y: 0 },
    });
    expect(result.success).toBe(false);
  });
});
