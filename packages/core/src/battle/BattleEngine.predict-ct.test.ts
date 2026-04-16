import { describe, expect, it } from "vitest";
import { TurnSystemKind } from "../enums/turn-system-kind";
import { buildCtTestEngine } from "../testing/build-ct-test-engine";
import { MockBattle } from "../testing/mock-battle";
import { MockMove } from "../testing/mock-move";
import { BattleEngine } from "./BattleEngine";

const TACKLE_ID = MockMove.physical.id;

describe("BattleEngine.predictCtTimeline", () => {
  it("returns [] if not in CT mode", () => {
    const state = MockBattle.stateFrom([MockBattle.player1Fast, MockBattle.player2Slow]);
    const moveRegistry = new Map([[TACKLE_ID, MockMove.physical]]);
    const engine = new BattleEngine(
      state,
      moveRegistry,
      undefined,
      undefined,
      undefined,
      undefined,
      0,
      TurnSystemKind.RoundRobin,
    );
    expect(engine.predictCtTimeline(3, TACKLE_ID)).toEqual([]);
  });

  it("returns [] if count is 0", () => {
    const { engine } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });
    expect(engine.predictCtTimeline(0, TACKLE_ID)).toEqual([]);
  });

  it("returns exactly count entries", () => {
    const { engine } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });
    const result = engine.predictCtTimeline(4, TACKLE_ID);
    expect(result).toHaveLength(4);
    for (const entry of result) {
      expect(entry).toHaveProperty("pokemonId");
      expect(entry).toHaveProperty("ct");
    }
  });

  it("KO'd pokemon do not appear in prediction", () => {
    const { engine } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20, slowHp: 0 });
    const result = engine.predictCtTimeline(6, TACKLE_ID);
    const ids = result.map((e) => e.pokemonId);
    expect(ids).not.toContain("slow");
    expect(ids.every((id) => id === "fast")).toBe(true);
  });

  it("expensive move makes active pokemon appear later than a cheap move", () => {
    const expensiveMove = MockMove.fresh(MockMove.physical, {
      id: "hyper-beam",
      pp: 5,
      power: 150,
    });
    const pokemon1 = {
      ...MockBattle.player1Fast,
      id: "a",
      baseStats: { ...MockBattle.player1Fast.baseStats, speed: 90 },
      combatStats: { ...MockBattle.player1Fast.combatStats, speed: 90 },
      position: { x: 0, y: 0 },
    };
    const pokemon2 = {
      ...MockBattle.player2Slow,
      id: "b",
      baseStats: { ...MockBattle.player2Slow.baseStats, speed: 90 },
      combatStats: { ...MockBattle.player2Slow.combatStats, speed: 90 },
      position: { x: 4, y: 4 },
    };

    const stateForCheap = MockBattle.stateFrom([pokemon1, pokemon2]);
    const cheapEngine = new BattleEngine(
      stateForCheap,
      new Map([[TACKLE_ID, MockMove.physical]]),
      undefined,
      undefined,
      undefined,
      undefined,
      0,
      TurnSystemKind.ChargeTime,
    );

    const stateForExpensive = MockBattle.stateFrom([pokemon1, pokemon2]);
    const expensiveEngine = new BattleEngine(
      stateForExpensive,
      new Map([[expensiveMove.id, expensiveMove]]),
      undefined,
      undefined,
      undefined,
      undefined,
      0,
      TurnSystemKind.ChargeTime,
    );

    const activeIdCheap = stateForCheap.turnOrder[0] ?? "";
    const activeIdExpensive = stateForExpensive.turnOrder[0] ?? "";

    const cheapTimeline = cheapEngine.predictCtTimeline(6, TACKLE_ID);
    const expensiveTimeline = expensiveEngine.predictCtTimeline(6, expensiveMove.id);

    const cheapFirstIndex = cheapTimeline.findIndex((e) => e.pokemonId === activeIdCheap);
    const expensiveFirstIndex = expensiveTimeline.findIndex(
      (e) => e.pokemonId === activeIdExpensive,
    );

    expect(expensiveFirstIndex).toBeGreaterThan(cheapFirstIndex);
  });

  it("returns valid entries without moveId (end-turn simulation)", () => {
    const { engine } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });
    const result = engine.predictCtTimeline(6);
    expect(result).toHaveLength(6);
    const validIds = new Set(["fast", "slow"]);
    for (const entry of result) {
      expect(validIds).toContain(entry.pokemonId);
    }
  });

  it("all pokemon ids in prediction are valid pokemon ids", () => {
    const { engine } = buildCtTestEngine({ fastSpeed: 90, slowSpeed: 20 });
    const result = engine.predictCtTimeline(6, TACKLE_ID);
    const validIds = new Set(["fast", "slow"]);
    for (const entry of result) {
      expect(validIds).toContain(entry.pokemonId);
    }
  });
});
