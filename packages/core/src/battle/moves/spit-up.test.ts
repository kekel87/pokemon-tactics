import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup(stockpileCount?: number) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["spit-up"],
    currentPp: { "spit-up": 10 },
    stockpileCount,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

function useSpitUp(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "caster",
    moveId: "spit-up",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("spit-up", () => {
  it("deals damage scaled to stockpile layers then empties the stockpile", () => {
    const { engine, state } = setup(2);
    const hpBefore = state.pokemon.get("foe")?.currentHp ?? 0;

    const result = useSpitUp(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.StockpileReleased);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get("caster")?.stockpileCount).toBe(0);
  });

  it("fizzles with no stockpile layer", () => {
    const { engine, state } = setup();
    const hpBefore = state.pokemon.get("foe")?.currentHp ?? 0;

    const result = useSpitUp(engine);

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("foe")?.currentHp).toBe(hpBefore);
  });
});
