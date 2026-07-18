import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function setup(defenderOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["venom-drench"],
    currentPp: { "venom-drench": 20 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
    ...defenderOverrides,
  });
  return buildMoveTestEngine([attacker, defender]);
}

function useVenomDrench(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "venom-drench",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("venom-drench", () => {
  it("lowers Attack, Sp. Atk and Speed of a poisoned target", () => {
    const { engine, state } = setup({
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: 5 }],
    });

    const result = useVenomDrench(engine);

    expect(result.success).toBe(true);
    const defender = state.pokemon.get("defender");
    expect(defender?.statStages[StatName.Attack]).toBe(-1);
    expect(defender?.statStages[StatName.SpAttack]).toBe(-1);
    expect(defender?.statStages[StatName.Speed]).toBe(-1);
  });

  it("fails against a non-poisoned target", () => {
    const { engine, state } = setup();

    const result = useVenomDrench(engine);

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(state.pokemon.get("defender")?.statStages[StatName.Attack]).toBe(0);
  });
});
