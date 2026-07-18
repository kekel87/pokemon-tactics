import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function setup(
  stockpileCount: number | undefined,
  currentHp: number,
  extra: Partial<PokemonInstance> = {},
) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["swallow"],
    currentPp: { swallow: 10 },
    stockpileCount,
    currentHp,
    maxHp: 100,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
    ...extra,
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 4, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

function useSwallow(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "caster",
    moveId: "swallow",
    targetPosition: { x: 0, y: 0 },
  });
}

describe("swallow", () => {
  it("fully heals with 3 layers then empties the stockpile", () => {
    const { engine, state } = setup(3, 20);

    const result = useSwallow(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.HpRestored);
    expect(state.pokemon.get("caster")?.currentHp).toBe(100);
    expect(state.pokemon.get("caster")?.stockpileCount).toBe(0);
  });

  it("heals half of max HP with 2 layers", () => {
    const { engine, state } = setup(2, 20);

    useSwallow(engine);

    expect(state.pokemon.get("caster")?.currentHp).toBe(70);
  });

  it("fizzles with no stockpile layer", () => {
    const { engine, state } = setup(undefined, 20);

    const result = useSwallow(engine);

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(state.pokemon.get("caster")?.currentHp).toBe(20);
  });

  it("undoes only the actual stockpile boost, never below it", () => {
    const { engine, state } = setup(2, 20, {
      statStages: { defense: 6, spDefense: 6 },
      stockpileDefBoost: 0,
      stockpileSpDefBoost: 0,
    });

    useSwallow(engine);

    const caster = state.pokemon.get("caster");
    expect(caster?.statStages[StatName.Defense]).toBe(6);
    expect(caster?.statStages[StatName.SpDefense]).toBe(6);
  });
});
