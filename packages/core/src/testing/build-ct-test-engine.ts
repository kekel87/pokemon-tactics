import { BattleEngine } from "../battle/BattleEngine";
import { TurnSystemKind } from "../enums/turn-system-kind";
import type { BattleState } from "../types/battle-state";
import { MockBattle } from "./mock-battle";
import { MockMove } from "./mock-move";

export interface CtTestEngineOptions {
  fastSpeed: number;
  slowSpeed: number;
  fastHp?: number;
  slowHp?: number;
}

export function buildCtTestEngine(options: CtTestEngineOptions): {
  engine: BattleEngine;
  state: BattleState;
} {
  const fast = {
    ...MockBattle.player1Fast,
    id: "fast",
    ...(options.fastHp === undefined ? {} : { currentHp: options.fastHp }),
    baseStats: { ...MockBattle.player1Fast.baseStats, speed: options.fastSpeed },
    combatStats: { ...MockBattle.player1Fast.combatStats, speed: options.fastSpeed },
    position: { x: 0, y: 0 },
  };
  const slow = {
    ...MockBattle.player2Slow,
    id: "slow",
    ...(options.slowHp === undefined ? {} : { currentHp: options.slowHp }),
    baseStats: { ...MockBattle.player2Slow.baseStats, speed: options.slowSpeed },
    combatStats: { ...MockBattle.player2Slow.combatStats, speed: options.slowSpeed },
    position: { x: 4, y: 4 },
  };
  const state = MockBattle.stateFrom([fast, slow]);
  const moveRegistry = new Map([[MockMove.physical.id, MockMove.physical]]);
  const engine = new BattleEngine(
    state,
    moveRegistry,
    undefined,
    undefined,
    undefined,
    undefined,
    0,
    TurnSystemKind.ChargeTime,
  );
  return { engine, state };
}
