import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postFieldTerrain } from "../field-terrain-system";

// Champlification (terrain-pulse) — Normal 50; morphs type + ×2 (100) by the caster's field terrain

function setup(terrain: FieldTerrain | null) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: ["terrain-pulse"],
    currentPp: { "terrain-pulse": 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const target = MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    playerId: PlayerId.Player2,
    position: { x: 5, y: 7 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([caster, target], {
    gridSize: 12,
    random: () => 0.5,
  });
  if (terrain !== null) {
    postFieldTerrain(state, caster, terrain);
  }
  return { engine, state, caster, target };
}

function fire(engine: ReturnType<typeof setup>["engine"], casterId: string) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: casterId,
    moveId: "terrain-pulse",
    targetPosition: { x: 5, y: 7 },
  });
}

describe("terrain-pulse — type morph + ×2", () => {
  it("stays Normal 50 off any field terrain", () => {
    const { engine, state, caster, target } = setup(null);
    const before = target.currentHp;
    const result = fire(engine, caster.id);
    expect(result.success).toBe(true);
    const moveStarted = result.events.find((e) => e.type === BattleEventType.MoveStarted);
    expect(moveStarted?.type === BattleEventType.MoveStarted && moveStarted.resolvedType).toBe(
      undefined,
    );
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(before);
  });

  it("morphs to Grass and doubles power on Grassy Terrain", () => {
    const off = setup(null);
    const offBefore = off.target.currentHp;
    fire(off.engine, off.caster.id);
    const offDamage = offBefore - (off.state.pokemon.get(off.target.id)?.currentHp ?? 0);

    const on = setup(FieldTerrain.Grassy);
    const onBefore = on.target.currentHp;
    const result = fire(on.engine, on.caster.id);
    const onDamage = onBefore - (on.state.pokemon.get(on.target.id)?.currentHp ?? 0);

    const moveStarted = result.events.find((e) => e.type === BattleEventType.MoveStarted);
    expect(moveStarted?.type === BattleEventType.MoveStarted && moveStarted.resolvedType).toBe(
      PokemonType.Grass,
    );
    expect(onDamage).toBeGreaterThan(offDamage * 1.6);
  });

  it("morphs type per terrain (Electric / Misty / Psychic)", () => {
    const cases: [FieldTerrain, PokemonType][] = [
      [FieldTerrain.Electric, PokemonType.Electric],
      [FieldTerrain.Misty, PokemonType.Fairy],
      [FieldTerrain.Psychic, PokemonType.Psychic],
    ];
    for (const [terrain, type] of cases) {
      const { engine, caster } = setup(terrain);
      const result = fire(engine, caster.id);
      const moveStarted = result.events.find((e) => e.type === BattleEventType.MoveStarted);
      expect(moveStarted?.type === BattleEventType.MoveStarted && moveStarted.resolvedType).toBe(
        type,
      );
    }
  });
});
