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
    moveIds: ["sucker-punch", "tackle"],
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

function useSuckerPunch(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "sucker-punch",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("sucker-punch", () => {
  it("hits when the target's last action was offensive", () => {
    const { engine, state } = setup({ lastActedAtAction: 5, lastOffensiveActionAtAction: 5 });
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = useSuckerPunch(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBeLessThan(hpBefore);
  });

  it("fizzles when the target attacked earlier but its last action was not offensive", () => {
    const { engine, state } = setup({ lastActedAtAction: 8, lastOffensiveActionAtAction: 3 });
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = useSuckerPunch(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBe(hpBefore);
  });

  it("fizzles when the target has never acted", () => {
    const { engine, state } = setup();
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = useSuckerPunch(engine);

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(state.pokemon.get("defender")?.currentHp).toBe(hpBefore);
  });
});
