import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postFieldTerrain } from "../field-terrain-system";

// Explo-Brume (misty-explosion) — Zone r2 self-KO; ×1.5 when the caster is on Misty Terrain

function makeCaster(position = { x: 5, y: 5 }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position,
    moveIds: ["misty-explosion"],
    currentPp: { "misty-explosion": 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function makeFoe(id: string, position: { x: number; y: number }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id,
    playerId: PlayerId.Player2,
    position,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

describe("misty-explosion — self-KO AoE", () => {
  it("hits foes in radius 2 around the caster and KOes the caster", () => {
    const caster = makeCaster();
    const near = makeFoe("near", { x: 5, y: 6 });
    const far = makeFoe("far", { x: 9, y: 9 });
    const { engine, state } = buildMoveTestEngine([caster, near, far], {
      gridSize: 10,
      random: () => 0.5,
    });
    const nearBefore = near.currentHp;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "misty-explosion",
      targetPosition: { x: 5, y: 5 },
    });
    expect(result.success).toBe(true);
    expect(state.pokemon.get(near.id)?.currentHp).toBeLessThan(nearBefore);
    // Self-destruct model: the caster faints from Recoil 999.
    expect(state.pokemon.get(caster.id)?.currentHp).toBe(0);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.PokemonKo);
  });

  it("deals ~1.5x more to a foe when the caster stands on Misty Terrain", () => {
    const run = (onMisty: boolean): number => {
      const caster = makeCaster();
      const foe = makeFoe("foe", { x: 5, y: 6 });
      const { engine, state } = buildMoveTestEngine([caster, foe], {
        gridSize: 10,
        random: () => 0.5,
      });
      if (onMisty) {
        postFieldTerrain(state, caster, FieldTerrain.Misty);
      }
      const before = foe.currentHp;
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: caster.id,
        moveId: "misty-explosion",
        targetPosition: { x: 5, y: 5 },
      });
      return before - (state.pokemon.get(foe.id)?.currentHp ?? 0);
    };
    const base = run(false);
    const boosted = run(true);
    expect(boosted).toBeGreaterThan(base * 1.3);
  });
});
