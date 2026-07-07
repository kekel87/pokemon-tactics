import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function setup(defenderOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["storm-throw"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    currentHp: 300,
    maxHp: 300,
    combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
    ...defenderOverrides,
  });
  // random = 0.99 → far above every crit threshold; only a forced crit can fire.
  return buildMoveTestEngine([attacker, defender], { random: () => 0.99 });
}

function useStormThrow(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "storm-throw",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("storm-throw", () => {
  it("always crits even when the roll would never crit", () => {
    const { engine } = setup();

    const result = useStormThrow(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.CriticalHit);
  });

  it("is still blocked by a preventsCrit ability (Coque Armure)", () => {
    const { engine } = setup({ abilityId: "shell-armor" });

    const result = useStormThrow(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.CriticalHit);
  });
});
