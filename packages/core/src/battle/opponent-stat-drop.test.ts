import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import { MockBattle, MockPokemon } from "../testing";
import { applyOpponentStatDrop } from "./opponent-stat-drop";

function dropOn(attackStage: number) {
  const source = MockPokemon.fresh(MockPokemon.base, {
    id: "source",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
  });
  const target = MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    statStages: { ...MockPokemon.base.statStages, [StatName.Attack]: attackStage },
  });
  const state = MockBattle.stateFrom([source, target]);
  return {
    target,
    result: applyOpponentStatDrop({
      state,
      abilityRegistry: undefined,
      itemRegistry: undefined,
      target,
      source,
      stat: StatName.Attack,
      stages: -1,
    }),
  };
}

describe("applyOpponentStatDrop", () => {
  it("lowers the stat and emits StatChanged when nothing blocks it", () => {
    const { target, result } = dropOn(0);

    expect(result.actualChange).toBe(-1);
    expect(target.statStages[StatName.Attack]).toBe(-1);
    expect(result.events.map((event) => event.type)).toEqual([BattleEventType.StatChanged]);
  });

  it("changes nothing at the -6 floor", () => {
    const { target, result } = dropOn(-6);

    expect(result.actualChange).toBe(0);
    expect(target.statStages[StatName.Attack]).toBe(-6);
    expect(result.events).toEqual([]);
  });
});
