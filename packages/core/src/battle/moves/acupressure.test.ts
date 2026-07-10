import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

const BATTLE_STATS = [
  StatName.Attack,
  StatName.Defense,
  StatName.SpAttack,
  StatName.SpDefense,
  StatName.Speed,
] as const;

function sumBattleStages(stages: Record<string, number>): number {
  return BATTLE_STATS.reduce((total, stat) => total + stages[stat], 0);
}

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["acupressure"],
    currentPp: { acupressure: 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 4, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("acupressure", () => {
  it("raises a random battle stat of the caster by 2", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "acupressure",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    const statEvent = result.events.find((event) => event.type === BattleEventType.StatChanged);
    expect(statEvent).toBeDefined();
    const caster = state.pokemon.get("caster");
    expect(caster && sumBattleStages(caster.statStages)).toBe(2);
  });
});
