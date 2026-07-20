import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function fire(defenderX: number, attackerOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["acrobatics"],
    currentPp: { acrobatics: 15 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
    ...attackerOverrides,
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: defenderX, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "acrobatics",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("acrobatics", () => {
  it("deals damage to an adjacent target", () => {
    expect(damageTo(fire(1).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of melee range", () => {
    expect(damageTo(fire(5).events, "defender")).toBe(0);
  });

  it("roughly doubles when the user holds no item", () => {
    const holding = damageTo(fire(1, { heldItemId: HeldItemId.Leftovers }).events, "defender");
    const empty = damageTo(fire(1, { heldItemId: undefined }).events, "defender");
    expect(empty).toBeGreaterThanOrEqual(holding * 1.8);
    expect(empty).toBeLessThanOrEqual(holding * 2.2);
  });
});
