import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { EffectKind } from "../../enums/effect-kind";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { TerrainType } from "../../enums/terrain-type";
import { MockBattle, MockPokemon } from "../../testing";
import type { MoveDefinition } from "../../types/move-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { TypeChart } from "../../types/type-chart";
import type { EffectContext } from "../effect-handler-registry";
import { handleKnockback } from "./handle-knockback";

const BASE = MockPokemon.base;

function buildContext(
  targetTypes: PokemonType[],
  terrainPatches: Array<{ x: number; y: number; terrain: TerrainType; height?: number }>,
  gridWidth = 8,
  extraPokemon: PokemonInstance[] = [],
): {
  context: EffectContext;
  target: PokemonInstance;
  state: ReturnType<typeof MockBattle.stateFrom>;
} {
  const target = MockPokemon.fresh(BASE, {
    id: "target",
    position: { x: 1, y: 0 },
    playerId: PlayerId.Player2,
    currentHp: 100,
    maxHp: 100,
  });

  const allPokemon = [target, ...extraPokemon];
  const state = MockBattle.stateFrom(allPokemon, gridWidth, 3);

  for (const patch of terrainPatches) {
    MockBattle.setTile(state, patch.x, patch.y, {
      terrain: patch.terrain,
      ...(patch.height === undefined ? {} : { height: patch.height }),
    });
  }

  const targetTypesMap = new Map<string, PokemonType[]>([["target", targetTypes]]);
  for (const p of extraPokemon) {
    targetTypesMap.set(p.id, [PokemonType.Normal]);
  }

  const attacker = MockPokemon.fresh(BASE, {
    id: "attacker",
    position: { x: 0, y: 0 },
    playerId: PlayerId.Player1,
  });

  const context: EffectContext = {
    attacker,
    targets: [target],
    move: {} as unknown as MoveDefinition,
    effect: { kind: EffectKind.Knockback, distance: 1 },
    state,
    typeChart: {} as unknown as TypeChart,
    attackerTypes: [PokemonType.Normal],
    targetTypesMap,
    targetPosition: target.position,
    random: () => 0,
    heightModifier: 1,
    terrainModifier: 1,
  };

  return { context, target, state };
}

describe("handleKnockback — ice slide", () => {
  it("Given Normal Pokemon knocked onto ice, When knockback, Then slides until non-ice tile", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
        { x: 4, y: 0, terrain: TerrainType.Ice },
      ],
    );

    const events = handleKnockback(context);

    const slide = events.find((e) => e.type === BattleEventType.IceSlideApplied);
    expect(slide).toBeDefined();
    if (slide?.type === BattleEventType.IceSlideApplied) {
      expect(slide.from).toEqual({ x: 2, y: 0 });
      expect(slide.to).toEqual({ x: 5, y: 0 });
    }
    expect(target.position).toEqual({ x: 5, y: 0 });
  });

  it("Given slide hits elevated wall, When slide, Then WallImpactDealt emitted", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Obstacle, height: 2 },
      ],
    );

    const events = handleKnockback(context);

    const impact = events.find((e) => e.type === BattleEventType.WallImpactDealt);
    expect(impact).toBeDefined();
    if (impact?.type === BattleEventType.WallImpactDealt) {
      expect(impact.amount).toBe(33);
    }
    expect(target.position).toEqual({ x: 2, y: 0 });
  });

  it("Given slide hits a Pokemon, When collision, Then IceSlideCollision emitted with damage to both", () => {
    const dummy = MockPokemon.fresh(BASE, {
      id: "dummy",
      position: { x: 4, y: 0 },
      playerId: PlayerId.Player2,
      currentHp: 100,
      maxHp: 100,
    });

    const { context, target, state } = buildContext(
      [PokemonType.Normal],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
      ],
      8,
      [dummy],
    );

    const events = handleKnockback(context);

    const collision = events.find((e) => e.type === BattleEventType.IceSlideCollision);
    expect(collision).toBeDefined();
    if (collision?.type === BattleEventType.IceSlideCollision) {
      expect(collision.sliderId).toBe("target");
      expect(collision.targetId).toBe("dummy");
      expect(collision.damage).toBeGreaterThan(0);
    }
    const dummyState = state.pokemon.get("dummy");
    expect(dummyState?.currentHp).toBeLessThan(100);
    expect(target.currentHp).toBeLessThan(100);
    expect(target.position).toEqual({ x: 3, y: 0 });
  });

  it("Given Ice-type Pokemon knocked onto ice, When knockback, Then no slide", () => {
    const { context, target } = buildContext(
      [PokemonType.Ice],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
      ],
    );

    const events = handleKnockback(context);

    expect(events.some((e) => e.type === BattleEventType.IceSlideApplied)).toBe(false);
    expect(target.position).toEqual({ x: 2, y: 0 });
  });

  it("Given Flying-type Pokemon knocked onto ice, When knockback, Then no slide", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal, PokemonType.Flying],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
      ],
    );

    const events = handleKnockback(context);

    expect(events.some((e) => e.type === BattleEventType.IceSlideApplied)).toBe(false);
    expect(target.position).toEqual({ x: 2, y: 0 });
  });

  it("Given map edge after ice, When slide reaches edge, Then stops at edge without damage", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
      ],
      4,
    );

    const events = handleKnockback(context);

    const slide = events.find((e) => e.type === BattleEventType.IceSlideApplied);
    expect(slide).toBeDefined();
    if (slide?.type === BattleEventType.IceSlideApplied) {
      expect(slide.to).toEqual({ x: 3, y: 0 });
    }
    expect(events.some((e) => e.type === BattleEventType.WallImpactDealt)).toBe(false);
    expect(target.position).toEqual({ x: 3, y: 0 });
  });

  it("Given slide ends on lower tile, When height diff, Then FallDamageDealt emitted", () => {
    const { context } = buildContext(
      [PokemonType.Normal],
      [{ x: 2, y: 0, terrain: TerrainType.Ice, height: 2 }],
    );

    const events = handleKnockback(context);

    const fall = events.find((e) => e.type === BattleEventType.FallDamageDealt);
    expect(fall).toBeDefined();
    if (fall?.type === BattleEventType.FallDamageDealt) {
      expect(fall.heightDiff).toBe(2);
      expect(fall.amount).toBe(33);
    }
  });

  it("Given several consecutive ice tiles, When slide, Then Pokemon traverses all of them", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal],
      [
        { x: 2, y: 0, terrain: TerrainType.Ice },
        { x: 3, y: 0, terrain: TerrainType.Ice },
        { x: 4, y: 0, terrain: TerrainType.Ice },
        { x: 5, y: 0, terrain: TerrainType.Ice },
      ],
    );

    handleKnockback(context);

    expect(target.position).toEqual({ x: 6, y: 0 });
  });

  it("Given target knocked onto non-ice tile, When knockback, Then no slide", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal],
      [{ x: 3, y: 0, terrain: TerrainType.Ice }],
    );

    handleKnockback(context);

    expect(target.position).toEqual({ x: 2, y: 0 });
  });
});

describe("handleKnockback — lethal terrain KO", () => {
  it("Given Pokemon knocked onto lava, When knockback, Then LethalTerrainKo + PokemonKo", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal],
      [{ x: 2, y: 0, terrain: TerrainType.Lava }],
    );

    const events = handleKnockback(context);

    expect(target.currentHp).toBe(0);
    expect(target.position).toEqual({ x: 2, y: 0 });
    const lethal = events.find((e) => e.type === BattleEventType.LethalTerrainKo);
    expect(lethal).toBeDefined();
    if (lethal?.type === BattleEventType.LethalTerrainKo) {
      expect(lethal.terrain).toBe(TerrainType.Lava);
    }
    expect(events.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
  });

  it("Given Pokemon knocked onto deep_water, When knockback, Then LethalTerrainKo", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal],
      [{ x: 2, y: 0, terrain: TerrainType.DeepWater }],
    );

    const events = handleKnockback(context);

    expect(target.currentHp).toBe(0);
    expect(events.some((e) => e.type === BattleEventType.LethalTerrainKo)).toBe(true);
  });

  it("Given Water-type Pokemon knocked toward deep_water, When knockback, Then blocked (immune)", () => {
    const { context, target } = buildContext(
      [PokemonType.Water],
      [{ x: 2, y: 0, terrain: TerrainType.DeepWater }],
    );

    const events = handleKnockback(context);

    expect(target.currentHp).toBe(100);
    expect(events.some((e) => e.type === BattleEventType.LethalTerrainKo)).toBe(false);
    expect(events.some((e) => e.type === BattleEventType.KnockbackBlocked)).toBe(true);
  });

  it("Given Fire-type Pokemon knocked toward lava, When knockback, Then blocked (immune)", () => {
    const { context, target } = buildContext(
      [PokemonType.Fire],
      [{ x: 2, y: 0, terrain: TerrainType.Lava }],
    );

    const events = handleKnockback(context);

    expect(target.currentHp).toBe(100);
    expect(events.some((e) => e.type === BattleEventType.LethalTerrainKo)).toBe(false);
    expect(events.some((e) => e.type === BattleEventType.KnockbackBlocked)).toBe(true);
  });

  it("Given Flying-type Pokemon knocked toward lava, When knockback, Then blocked (immune)", () => {
    const { context, target } = buildContext(
      [PokemonType.Normal, PokemonType.Flying],
      [{ x: 2, y: 0, terrain: TerrainType.Lava }],
    );

    const events = handleKnockback(context);

    expect(target.currentHp).toBe(100);
    expect(events.some((e) => e.type === BattleEventType.LethalTerrainKo)).toBe(false);
  });
});
