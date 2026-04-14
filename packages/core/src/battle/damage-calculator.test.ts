import { describe, expect, it } from "vitest";
import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle } from "../testing/mock-battle";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import {
  calculateDamage,
  estimateDamage,
  getStab,
  getTypeEffectiveness,
} from "./damage-calculator";

const baseMove: MoveDefinition = {
  id: "test-move",
  name: "Test Move",
  type: PokemonType.Normal,
  category: Category.Physical,
  power: 50,
  accuracy: 100,
  pp: 20,
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [{ kind: EffectKind.Damage }],
};

const simpleChart: Record<PokemonType, Record<PokemonType, number>> = {
  [PokemonType.Normal]: {
    [PokemonType.Normal]: 1,
    [PokemonType.Fire]: 1,
    [PokemonType.Water]: 1,
    [PokemonType.Rock]: 0.5,
    [PokemonType.Ghost]: 0,
  } as Record<PokemonType, number>,
  [PokemonType.Fire]: {
    [PokemonType.Grass]: 2,
    [PokemonType.Water]: 0.5,
    [PokemonType.Fire]: 0.5,
  } as Record<PokemonType, number>,
  [PokemonType.Water]: { [PokemonType.Fire]: 2, [PokemonType.Grass]: 0.5 } as Record<
    PokemonType,
    number
  >,
  [PokemonType.Grass]: { [PokemonType.Water]: 2, [PokemonType.Fire]: 0.5 } as Record<
    PokemonType,
    number
  >,
} as Record<PokemonType, Record<PokemonType, number>>;

function attacker(overrides?: Partial<PokemonInstance>): PokemonInstance {
  return {
    ...MockBattle.player1Fast,
    ...overrides,
    position: { ...MockBattle.player1Fast.position, ...overrides?.position },
    baseStats: { ...MockBattle.player1Fast.baseStats, ...overrides?.baseStats },
    statStages: { ...MockBattle.player1Fast.statStages, ...overrides?.statStages },
    statusEffects: overrides?.statusEffects ?? [],
  };
}

function defender(overrides?: Partial<PokemonInstance>): PokemonInstance {
  return {
    ...MockBattle.player2Slow,
    ...overrides,
    position: { ...MockBattle.player2Slow.position, ...overrides?.position },
    baseStats: { ...MockBattle.player2Slow.baseStats, ...overrides?.baseStats },
    statStages: { ...MockBattle.player2Slow.statStages, ...overrides?.statStages },
    statusEffects: overrides?.statusEffects ?? [],
  };
}

describe("calculateDamage", () => {
  it("calculates neutral damage", () => {
    const damage = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    expect(damage).toBeGreaterThan(0);
  });

  it("returns 0 for status moves", () => {
    const statusMove = { ...baseMove, category: Category.Status, power: 0 };
    const damage = calculateDamage(
      attacker(),
      defender(),
      statusMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    expect(damage).toBe(0);
  });

  it("returns 0 for immune type matchups", () => {
    const damage = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Ghost],
    );
    expect(damage).toBe(0);
  });

  it("deals more damage with super effective", () => {
    const fireMove = { ...baseMove, type: PokemonType.Fire };
    const neutral = calculateDamage(
      attacker(),
      defender(),
      fireMove,
      simpleChart,
      [PokemonType.Fire],
      [PokemonType.Fire],
    );
    const superEffective = calculateDamage(
      attacker(),
      defender(),
      fireMove,
      simpleChart,
      [PokemonType.Fire],
      [PokemonType.Grass],
    );
    expect(superEffective).toBeGreaterThan(neutral);
  });

  it("applies STAB bonus", () => {
    const withStab = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    const withoutStab = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Fire],
      [PokemonType.Normal],
    );
    expect(withStab).toBeGreaterThan(withoutStab);
  });

  it("halves physical damage when attacker is burned", () => {
    const burned = attacker({ statusEffects: [{ type: StatusType.Burned, remainingTurns: null }] });
    const normal = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    const burnedDamage = calculateDamage(
      burned,
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    expect(burnedDamage).toBeLessThan(normal);
  });

  it("applies stat stage modifiers", () => {
    const boosted = attacker({ statStages: { ...MockBattle.player1Fast.statStages, attack: 2 } });
    const normal = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    const boostedDamage = calculateDamage(
      boosted,
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    expect(boostedDamage).toBeGreaterThan(normal);
  });
});

describe("getTypeEffectiveness", () => {
  it("returns 1 for neutral", () => {
    expect(getTypeEffectiveness(PokemonType.Normal, [PokemonType.Normal], simpleChart)).toBe(1);
  });

  it("returns 2 for super effective", () => {
    expect(getTypeEffectiveness(PokemonType.Fire, [PokemonType.Grass], simpleChart)).toBe(2);
  });

  it("returns 0.5 for not very effective", () => {
    expect(getTypeEffectiveness(PokemonType.Fire, [PokemonType.Water], simpleChart)).toBe(0.5);
  });

  it("returns 0 for immune", () => {
    expect(getTypeEffectiveness(PokemonType.Normal, [PokemonType.Ghost], simpleChart)).toBe(0);
  });
});

describe("getStab", () => {
  it("returns 1.5 when move type matches attacker type", () => {
    expect(getStab(PokemonType.Fire, [PokemonType.Fire])).toBe(1.5);
  });

  it("returns 1 when no match", () => {
    expect(getStab(PokemonType.Fire, [PokemonType.Water])).toBe(1);
  });
});

describe("rollFactor", () => {
  it("applies minimum roll (0.85) when specified", () => {
    const minDamage = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      0.85,
    );
    const maxDamage = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
    );
    expect(minDamage).toBeLessThanOrEqual(maxDamage);
    expect(minDamage).toBeGreaterThan(0);
  });

  it("produces deterministic results with explicit rollFactor", () => {
    const first = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      0.9,
    );
    const second = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      0.9,
    );
    expect(first).toBe(second);
  });

  it("returns 0 for status moves regardless of rollFactor", () => {
    const statusMove = { ...baseMove, category: Category.Status, power: 0 };
    const damage = calculateDamage(
      attacker(),
      defender(),
      statusMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
    );
    expect(damage).toBe(0);
  });
});

describe("estimateDamage", () => {
  it("returns min <= max for a normal attack", () => {
    const estimate = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    expect(estimate.min).toBeGreaterThan(0);
    expect(estimate.max).toBeGreaterThanOrEqual(estimate.min);
    expect(estimate.effectiveness).toBe(1);
  });

  it("returns min=0, max=0 for immune matchup", () => {
    const estimate = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Ghost],
    );
    expect(estimate.min).toBe(0);
    expect(estimate.max).toBe(0);
    expect(estimate.effectiveness).toBe(0);
  });

  it("returns min=0, max=0 for status moves", () => {
    const statusMove = { ...baseMove, category: Category.Status, power: 0 };
    const estimate = estimateDamage(
      attacker(),
      defender(),
      statusMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    expect(estimate.min).toBe(0);
    expect(estimate.max).toBe(0);
  });

  it("returns effectiveness=2 for super effective", () => {
    const fireMove = { ...baseMove, type: PokemonType.Fire };
    const estimate = estimateDamage(
      attacker(),
      defender(),
      fireMove,
      simpleChart,
      [PokemonType.Fire],
      [PokemonType.Grass],
    );
    expect(estimate.effectiveness).toBe(2);
    expect(estimate.min).toBeGreaterThan(0);
  });

  it("returns effectiveness=0.5 for not very effective", () => {
    const fireMove = { ...baseMove, type: PokemonType.Fire };
    const estimate = estimateDamage(
      attacker(),
      defender(),
      fireMove,
      simpleChart,
      [PokemonType.Fire],
      [PokemonType.Water],
    );
    expect(estimate.effectiveness).toBe(0.5);
  });

  it("includes STAB in damage range", () => {
    const withStab = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
    );
    const withoutStab = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Fire],
      [PokemonType.Normal],
    );
    expect(withStab.max).toBeGreaterThan(withoutStab.max);
  });
});

describe("terrain modifier", () => {
  it("terrain bonus +15% applies when terrainModifier=1.15", () => {
    const base = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      undefined,
      1.0,
      1.0,
    );
    const withTerrain = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      undefined,
      1.0,
      1.15,
    );
    expect(withTerrain).toBeGreaterThan(base);
    expect(withTerrain).toBe(Math.max(1, Math.floor(base * 1.15)));
  });

  it("estimateDamage propagates terrainModifier", () => {
    const base = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      1.0,
    );
    const withTerrain = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      1.15,
    );
    expect(withTerrain.max).toBeGreaterThan(base.max);
  });
});

describe("facing modifier", () => {
  it("back attack (+15%) increases damage", () => {
    const base = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      undefined,
      1.0,
      1.0,
      1.0,
    );
    const backAttack = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      undefined,
      1.0,
      1.0,
      1.15,
    );
    expect(backAttack).toBeGreaterThan(base);
    expect(backAttack).toBe(Math.max(1, Math.floor(base * 1.15)));
  });

  it("front attack (-15%) reduces damage", () => {
    const base = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      undefined,
      1.0,
      1.0,
      1.0,
    );
    const frontAttack = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      undefined,
      1.0,
      1.0,
      0.85,
    );
    expect(frontAttack).toBeLessThan(base);
  });

  it("flank (1.0) does not change damage vs default", () => {
    const withoutFacing = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
    );
    const withFlank = calculateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      undefined,
      1.0,
      1.0,
      1.0,
    );
    expect(withFlank).toBe(withoutFacing);
  });

  it("estimateDamage propagates facingModifier and includes it in result", () => {
    const base = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      1.0,
      1.0,
    );
    const backAttack = estimateDamage(
      attacker(),
      defender(),
      baseMove,
      simpleChart,
      [PokemonType.Normal],
      [PokemonType.Normal],
      1.0,
      1.0,
      1.15,
    );
    expect(backAttack.max).toBeGreaterThan(base.max);
    expect(backAttack.facingModifier).toBe(1.15);
    expect(base.facingModifier).toBe(1.0);
  });
});
