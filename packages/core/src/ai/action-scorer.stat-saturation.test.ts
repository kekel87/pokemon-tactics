import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import { TargetingKind } from "../enums/targeting-kind";
import { buildMoveRegistry } from "../testing/build-move-registry";
import { buildMoveTestEngine } from "../testing/build-move-test-engine";
import { MockMove } from "../testing/mock-move";
import { MockPokemon, ZERO_STAT_STAGES } from "../testing/mock-pokemon";
import type { MoveDefinition } from "../types/move-definition";
import { scoreAction } from "./action-scorer";
import { HARD_PROFILE } from "./ai-profiles";

const IRON_DEFENSE = MockMove.fresh(MockMove.status, {
  id: "iron-defense",
  effects: [
    { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 2, target: EffectTarget.Self },
  ],
});

const HARDEN = MockMove.fresh(MockMove.status, {
  id: "harden",
  effects: [
    { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
  ],
});

const AURORA_BEAM = MockMove.fresh(MockMove.physical, {
  id: "aurora-beam",
  effects: [
    {
      kind: EffectKind.StatChange,
      stat: StatName.Attack,
      stages: -1,
      target: EffectTarget.Targets,
    },
  ],
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 4 } },
});

function registryWith(...moves: MoveDefinition[]): Map<string, MoveDefinition> {
  const registry = buildMoveRegistry();
  for (const move of moves) {
    registry.set(move.id, move);
  }
  return registry;
}

function scoreSelfBuff(move: MoveDefinition, casterStage: number): number {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: [move.id],
    statStages: { ...ZERO_STAT_STAGES, [StatName.Defense]: casterStage },
  });
  const enemy = MockPokemon.fresh(MockPokemon.base, {
    id: "enemy",
    playerId: PlayerId.Player2,
    position: { x: 4, y: 4 },
  });
  const { engine, state } = buildMoveTestEngine([caster, enemy], { activePokemonId: caster.id });
  const registry = registryWith(move);

  return scoreAction(
    {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: move.id,
      targetPosition: caster.position,
    },
    state,
    registry,
    engine,
    HARD_PROFILE,
  );
}

function scoreEnemyDebuff(targetStage: number): number {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: [AURORA_BEAM.id],
  });
  const target = MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    playerId: PlayerId.Player2,
    position: { x: 0, y: 2 },
    statStages: { ...ZERO_STAT_STAGES, [StatName.Attack]: targetStage },
  });
  const { engine, state } = buildMoveTestEngine([caster, target], { activePokemonId: caster.id });
  const registry = registryWith(AURORA_BEAM);

  return scoreAction(
    {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: AURORA_BEAM.id,
      targetPosition: target.position,
    },
    state,
    registry,
    engine,
    HARD_PROFILE,
  );
}

describe("self-buff scoring saturates toward the cap", () => {
  it("is worth something on a neutral stat", () => {
    expect(scoreSelfBuff(IRON_DEFENSE, 0)).toBeGreaterThan(0);
  });

  it("is discarded outright at the cap, not merely devalued", () => {
    expect(scoreSelfBuff(IRON_DEFENSE, 6)).toBeLessThan(0);
  });

  it("halves a two-stage boost when only one stage remains", () => {
    expect(scoreSelfBuff(IRON_DEFENSE, 5)).toBeCloseTo(scoreSelfBuff(IRON_DEFENSE, 0) / 2, 5);
  });

  it("keeps a one-stage boost at full price until the last reachable stage", () => {
    expect(scoreSelfBuff(HARDEN, 5)).toBe(scoreSelfBuff(HARDEN, 0));
    expect(scoreSelfBuff(HARDEN, 6)).toBeLessThan(0);
  });
});

describe("enemy-debuff scoring saturates toward the floor", () => {
  it("is worth more against a neutral target than against a floored one", () => {
    expect(scoreEnemyDebuff(-6)).toBeLessThan(scoreEnemyDebuff(0));
  });

  it("keeps a one-stage drop at full price until the last reachable stage", () => {
    expect(scoreEnemyDebuff(-5)).toBe(scoreEnemyDebuff(0));
  });
});
