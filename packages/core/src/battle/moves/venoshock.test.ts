import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function fire(defenderX: number, defenderOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["venoshock"],
    currentPp: { venoshock: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: defenderX, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
    ...defenderOverrides,
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "venoshock",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("venoshock", () => {
  it("deals damage to a target in range", () => {
    expect(damageTo(fire(2).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    expect(damageTo(fire(5).events, "defender")).toBe(0);
  });

  it("roughly doubles against a poisoned target", () => {
    const base = damageTo(fire(2).events, "defender");
    const poisoned = damageTo(
      fire(2, { statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }] }).events,
      "defender",
    );
    expect(poisoned).toBeGreaterThanOrEqual(base * 1.8);
    expect(poisoned).toBeLessThanOrEqual(base * 2.2);
  });

  it("stays at base power against a burned (non-poison) target", () => {
    const base = damageTo(fire(2).events, "defender");
    const burned = damageTo(
      fire(2, { statusEffects: [{ type: StatusType.Burned, remainingTurns: null }] }).events,
      "defender",
    );
    expect(burned).toBe(base);
  });
});
