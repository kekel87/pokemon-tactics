import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { TerrainType } from "../../enums/terrain-type";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";
import { decrementFieldTerrainsTimer, postFieldTerrain } from "../field-terrain-system";
import { resolveNaturePowerMoveId } from "../nature-power-system";

// Force Nature (nature-power) — full move swap by field terrain / map tile (#441)

function makeCaster(position = { x: 5, y: 5 }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position,
    moveIds: ["nature-power"],
    currentPp: { "nature-power": 20 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function makeFoe(position = { x: 5, y: 7 }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

describe("nature-power — move resolution", () => {
  it("defaults to Tri Attack off any terrain", () => {
    const caster = makeCaster();
    const { engine, state } = buildMoveTestEngine([caster, makeFoe()], { gridSize: 12 });
    expect(resolveNaturePowerMoveId(state, engine.getGrid(), caster)).toBe("tri-attack");
    expect(engine.getEffectiveMove(caster.id, "nature-power")?.id).toBe("tri-attack");
  });

  it("resolves §6-A field terrains (Grassy/Electric/Misty/Psychic)", () => {
    const cases: [FieldTerrain, string][] = [
      [FieldTerrain.Grassy, "energy-ball"],
      [FieldTerrain.Electric, "thunderbolt"],
      [FieldTerrain.Misty, "moonblast"],
      [FieldTerrain.Psychic, "psychic"],
    ];
    for (const [terrain, moveId] of cases) {
      const caster = makeCaster();
      const { engine, state } = buildMoveTestEngine([caster, makeFoe()], { gridSize: 12 });
      postFieldTerrain(state, caster, terrain);
      expect(resolveNaturePowerMoveId(state, engine.getGrid(), caster)).toBe(moveId);
    }
  });

  it("resolves §6-B map TerrainTypes", () => {
    const cases: [TerrainType, string][] = [
      [TerrainType.TallGrass, "energy-ball"],
      [TerrainType.Water, "hydro-pump"],
      [TerrainType.DeepWater, "hydro-pump"],
      [TerrainType.Magma, "lava-plume"],
      [TerrainType.Lava, "lava-plume"],
      [TerrainType.Ice, "ice-beam"],
      [TerrainType.Snow, "ice-beam"],
      [TerrainType.Sand, "earth-power"],
      [TerrainType.Swamp, "mud-bomb"],
      [TerrainType.Obstacle, "power-gem"],
      [TerrainType.Normal, "tri-attack"],
    ];
    for (const [terrain, moveId] of cases) {
      const caster = makeCaster();
      const { engine, state } = buildMoveTestEngine([caster, makeFoe()], { gridSize: 12 });
      MockBattle.setTile(state, caster.position.x, caster.position.y, { terrain });
      expect(resolveNaturePowerMoveId(state, engine.getGrid(), caster)).toBe(moveId);
    }
  });

  it("field terrain takes precedence over the map tile", () => {
    const caster = makeCaster();
    const { engine, state } = buildMoveTestEngine([caster, makeFoe()], { gridSize: 12 });
    MockBattle.setTile(state, caster.position.x, caster.position.y, { terrain: TerrainType.Water });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    // Field terrain (Psychic → psychic) wins over the Water tile (→ hydro-pump).
    expect(resolveNaturePowerMoveId(state, engine.getGrid(), caster)).toBe("psychic");
  });

  it("deals damage with the resolved move and logs the morph", () => {
    const caster = makeCaster();
    const foe = makeFoe();
    const { engine, state } = buildMoveTestEngine([caster, foe], {
      gridSize: 12,
      random: () => 0.5,
    });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);
    const before = foe.currentHp;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "nature-power",
      targetPosition: { x: 5, y: 7 },
    });
    expect(result.success).toBe(true);
    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(before);
    const moveStarted = result.events.find((e) => e.type === BattleEventType.MoveStarted);
    expect(moveStarted?.type === BattleEventType.MoveStarted && moveStarted.resolvedMoveId).toBe(
      "psychic",
    );
    // PP spent on nature-power, not the morphed move.
    expect(state.pokemon.get(caster.id)?.currentPp["nature-power"]).toBe(19);
  });

  it("re-resolves to Tri Attack at execution if the field terrain expired", () => {
    const caster = makeCaster();
    const { engine, state } = buildMoveTestEngine([caster, makeFoe()], { gridSize: 12 });
    const zone = postFieldTerrain(state, caster, FieldTerrain.Psychic);
    zone.remainingTurns = 1;
    expect(resolveNaturePowerMoveId(state, engine.getGrid(), caster)).toBe("psychic");
    // Field terrain decrements to 0 and is removed → Force Nature falls back to Tri Attack.
    decrementFieldTerrainsTimer(state);
    expect(resolveNaturePowerMoveId(state, engine.getGrid(), caster)).toBe("tri-attack");
  });
});
