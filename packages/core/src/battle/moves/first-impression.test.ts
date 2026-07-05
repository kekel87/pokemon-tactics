import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["first-impression", "tackle"],
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

describe("first-impression", () => {
  it("damages on the first action without a flinch", () => {
    const { engine, state } = setup();
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "first-impression",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("defender")?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get("defender")?.volatileStatuses).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Flinch }),
    );
  });

  it("is not legal once the user has already acted", () => {
    const { engine, state } = setup();
    const attacker = state.pokemon.get("attacker");
    if (attacker) {
      attacker.lastActedAtAction = 2;
    }
    const legalMoveIds = engine
      .getLegalActions(PlayerId.Player1)
      .filter((action) => action.kind === ActionKind.UseMove)
      .map((action) => (action.kind === ActionKind.UseMove ? action.moveId : ""));
    expect(legalMoveIds).not.toContain("first-impression");
  });
});
