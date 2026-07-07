import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["focus-energy", "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 3, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([attacker, foe]);
}

function useFocusEnergy(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "focus-energy",
    targetPosition: { x: 0, y: 0 },
  });
}

describe("focus-energy", () => {
  it("raises the caster's crit stage by 2", () => {
    const { engine, state } = setup();

    const result = useFocusEnergy(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.CritStageRaised);
    expect(state.pokemon.get("attacker")?.critStageBoost).toBe(2);
  });

  it("does not arm a guaranteed crit (distinct from Affilage)", () => {
    const { engine, state } = setup();

    useFocusEnergy(engine);

    expect(state.pokemon.get("attacker")?.guaranteedCritArmed).toBeUndefined();
  });
});
