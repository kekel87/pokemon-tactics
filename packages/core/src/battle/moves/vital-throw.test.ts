import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("vital-throw", () => {
  it("never misses, even against a maximally evasive target", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["vital-throw"],
      currentPp: { "vital-throw": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 100,
      maxHp: 100,
      statStages: { ...caster.statStages, [StatName.Evasion]: 6 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], {
      random: () => 0.99,
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "vital-throw",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(100);
  });
});
