import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function fire(defenderX: number, attackerOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["facade"],
    currentPp: { facade: 20 },
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
  const result = engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "facade",
    targetPosition: { x: defenderX, y: 0 },
  });
  return result;
}

describe("facade", () => {
  it("deals damage to an adjacent target", () => {
    const result = fire(1);
    expect(result.success).toBe(true);
    expect(damageTo(result.events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of melee range", () => {
    const result = fire(5);
    expect(damageTo(result.events, "defender")).toBe(0);
  });

  it("roughly doubles its power when the user has a major status, ignoring burn attack drop", () => {
    const base = damageTo(fire(1).events, "defender");
    const burned = damageTo(
      fire(1, { statusEffects: [{ type: StatusType.Burned, remainingTurns: null }] }).events,
      "defender",
    );
    expect(burned).toBeGreaterThanOrEqual(base * 1.8);
    expect(burned).toBeLessThanOrEqual(base * 2.2);
  });
});
