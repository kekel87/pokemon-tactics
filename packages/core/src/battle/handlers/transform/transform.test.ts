import { describe, expect, it } from "vitest";
import { PokemonGender } from "../../../enums/pokemon-gender";
import { PokemonType } from "../../../enums/pokemon-type";
import { StatName } from "../../../enums/stat-name";
import { MockPokemon } from "../../../testing/mock-pokemon";
import { effectiveAbilityId } from "../../effective-ability";
import { effectiveBaseSpeed } from "../../effective-base-speed";
import { effectiveCombatStats } from "../../effective-combat-stats";
import { isEffectivelyFlying, resolveBaseTypes } from "../../effective-flying";
import { effectiveGender } from "../../effective-gender";
import { effectiveMoveIds } from "../../effective-move-ids";
import { effectiveWeight } from "../../effective-weight";
import { applyTransform } from "./apply-transform";

const GYARADOS_TYPES = [PokemonType.Water, PokemonType.Flying];

const caster = () => MockPokemon.fresh(MockPokemon.base);
const target = () =>
  MockPokemon.fresh(MockPokemon.gyarados, {
    id: "target-1",
    playerId: MockPokemon.base.playerId,
    abilityId: "intimidate",
    statStages: { ...MockPokemon.base.statStages, [StatName.Attack]: 2 },
  });

describe("applyTransform — Morphing copy (plan 157)", () => {
  it("copies combat stats, base speed, types, ability, moves, weight, gender into transformState", () => {
    const morphed = caster();
    const gyarados = target();

    applyTransform(morphed, gyarados, GYARADOS_TYPES, "intimidate");

    expect(morphed.transformState).toBeDefined();
    expect(effectiveCombatStats(morphed)).toEqual(gyarados.combatStats);
    expect(effectiveBaseSpeed(morphed)).toBe(gyarados.baseStats.speed);
    expect(resolveBaseTypes(morphed, new Map())).toEqual(GYARADOS_TYPES);
    expect(effectiveAbilityId(morphed)).toBe("intimidate");
    expect(effectiveMoveIds(morphed)).toEqual(gyarados.moveIds);
    expect(effectiveWeight(morphed)).toBe(gyarados.weight);
    expect(effectiveGender(morphed)).toBe(PokemonGender.Female);
  });

  it("keeps the caster's own level and HP (#649)", () => {
    const morphed = caster();
    const originalHp = morphed.currentHp;
    const originalMaxHp = morphed.maxHp;
    const originalLevel = morphed.level;

    applyTransform(morphed, target(), GYARADOS_TYPES, "intimidate");

    expect(morphed.currentHp).toBe(originalHp);
    expect(morphed.maxHp).toBe(originalMaxHp);
    expect(morphed.level).toBe(originalLevel);
  });

  it("snapshots the target's stat stages, diverging afterwards (#650)", () => {
    const morphed = caster();
    const gyarados = target();

    applyTransform(morphed, gyarados, GYARADOS_TYPES, "intimidate");
    expect(morphed.statStages[StatName.Attack]).toBe(2);

    gyarados.statStages[StatName.Attack] = 6;
    expect(morphed.statStages[StatName.Attack]).toBe(2);
  });

  it("recomputes movement from the copied speed (#647)", () => {
    const morphed = caster();
    const fast = MockPokemon.fresh(MockPokemon.gyarados, {
      baseStats: { ...MockPokemon.gyarados.baseStats, speed: 200 },
    });
    const before = morphed.derivedStats.movement;

    applyTransform(morphed, fast, GYARADOS_TYPES, "intimidate");

    expect(effectiveBaseSpeed(morphed)).toBe(200);
    expect(morphed.derivedStats.movement).not.toBe(before);
  });

  it("purges the caster's pre-existing overrides so the morph is the active layer (#656)", () => {
    const morphed = MockPokemon.fresh(MockPokemon.base, {
      typeOverride: [PokemonType.Fire],
      abilityIdOverride: "blaze",
      speedStatOverride: 999,
    });
    const gyarados = target();

    applyTransform(morphed, gyarados, GYARADOS_TYPES, "intimidate");

    expect(morphed.typeOverride).toBeUndefined();
    expect(morphed.abilityIdOverride).toBeUndefined();
    expect(morphed.speedStatOverride).toBeUndefined();
    expect(resolveBaseTypes(morphed, new Map())).toEqual(GYARADOS_TYPES);
    expect(effectiveAbilityId(morphed)).toBe("intimidate");
    expect(effectiveBaseSpeed(morphed)).toBe(gyarados.baseStats.speed);
  });

  it("applies the copied Flying type to terrain — the morph levitates (#659)", () => {
    const morphed = caster();
    applyTransform(morphed, target(), GYARADOS_TYPES, "intimidate");

    const types = resolveBaseTypes(morphed, new Map());
    expect(types).toContain(PokemonType.Flying);
    expect(isEffectivelyFlying(morphed, types)).toBe(true);
  });

  it("handles a copied mon with no ability without falling back to the species ability", () => {
    const morphed = MockPokemon.fresh(MockPokemon.base, { abilityId: "overgrow" });

    applyTransform(morphed, target(), GYARADOS_TYPES, undefined);

    expect(effectiveAbilityId(morphed)).toBeUndefined();
  });
});

describe("effective* helpers — override precedence over transformState (#656)", () => {
  it("a specific override wins over the morph (manip écrase)", () => {
    const morphed = caster();
    applyTransform(morphed, target(), GYARADOS_TYPES, "intimidate");

    morphed.typeOverride = [PokemonType.Water];
    morphed.abilityIdOverride = "torrent";
    morphed.speedStatOverride = 42;

    expect(resolveBaseTypes(morphed, new Map())).toEqual([PokemonType.Water]);
    expect(effectiveAbilityId(morphed)).toBe("torrent");
    expect(effectiveBaseSpeed(morphed)).toBe(42);
  });

  it("falls back to species values when not transformed", () => {
    const mon = caster();
    expect(effectiveCombatStats(mon)).toBe(mon.combatStats);
    expect(effectiveMoveIds(mon)).toBe(mon.moveIds);
    expect(effectiveWeight(mon)).toBe(mon.weight);
    expect(effectiveGender(mon)).toBe(mon.gender);
  });
});
