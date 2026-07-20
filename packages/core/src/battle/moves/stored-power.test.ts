import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function fire(defenderX: number, attackerOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["stored-power"],
    currentPp: { "stored-power": 10 },
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
    moveId: "stored-power",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("stored-power", () => {
  it("deals damage to a target in range", () => {
    expect(damageTo(fire(2).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    expect(damageTo(fire(5).events, "defender")).toBe(0);
  });

  it("hits harder with positive stat stages than from neutral", () => {
    const boostedStages = { ...MockPokemon.base.statStages };
    boostedStages[StatName.Defense] = 3;
    boostedStages[StatName.Speed] = 3;
    const base = damageTo(fire(2).events, "defender");
    const boosted = damageTo(fire(2, { statStages: boostedStages }).events, "defender");
    expect(boosted).toBeGreaterThan(base);
  });
});
