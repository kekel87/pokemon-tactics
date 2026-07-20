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
    moveIds: ["hex"],
    currentPp: { hex: 10 },
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
    moveId: "hex",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("hex", () => {
  it("deals damage to a target in range", () => {
    expect(damageTo(fire(2).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    expect(damageTo(fire(5).events, "defender")).toBe(0);
  });

  it("roughly doubles when the target has a major status", () => {
    const base = damageTo(fire(2).events, "defender");
    const onStatus = damageTo(
      fire(2, { statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }] }).events,
      "defender",
    );
    expect(onStatus).toBeGreaterThanOrEqual(base * 1.8);
    expect(onStatus).toBeLessThanOrEqual(base * 2.2);
  });
});
