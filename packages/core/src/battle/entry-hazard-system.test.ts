import { describe, expect, it } from "vitest";
import { EntryHazardKind } from "../enums/entry-hazard-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import {
  absorbsToxicSpikes,
  getEntryHazardsAt,
  isGroundedOnlyHazard,
  maxLayersFor,
  postEntryHazard,
  removeEntryHazardCell,
  removeEntryHazardsNear,
  spikesDamage,
  stealthRockDamage,
} from "./entry-hazard-system";

function freshState() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 9, y: 9 },
  });
  return buildMoveTestEngine([caster, foe], { gridSize: 12 });
}

describe("maxLayersFor", () => {
  it("caps Picots at 3, Pics Toxik at 2, others at 1", () => {
    expect(maxLayersFor(EntryHazardKind.Spikes)).toBe(3);
    expect(maxLayersFor(EntryHazardKind.ToxicSpikes)).toBe(2);
    expect(maxLayersFor(EntryHazardKind.StealthRock)).toBe(1);
    expect(maxLayersFor(EntryHazardKind.StickyWeb)).toBe(1);
  });
});

describe("isGroundedOnlyHazard", () => {
  it("is true for every hazard except Pièges de Roc", () => {
    expect(isGroundedOnlyHazard(EntryHazardKind.Spikes)).toBe(true);
    expect(isGroundedOnlyHazard(EntryHazardKind.ToxicSpikes)).toBe(true);
    expect(isGroundedOnlyHazard(EntryHazardKind.StickyWeb)).toBe(true);
    expect(isGroundedOnlyHazard(EntryHazardKind.StealthRock)).toBe(false);
  });
});

describe("postEntryHazard", () => {
  it("creates a single-layer cell on the aimed tile", () => {
    const { state } = freshState();
    const cell = postEntryHazard(state, EntryHazardKind.Spikes, { x: 3, y: 3 });
    expect(cell?.layers).toBe(1);
    expect(state.entryHazards).toHaveLength(1);
  });

  it("stacks a layer when re-cast on the same kind and tile", () => {
    const { state } = freshState();
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 3, y: 3 });
    const second = postEntryHazard(state, EntryHazardKind.Spikes, { x: 3, y: 3 });
    expect(second?.layers).toBe(2);
    expect(state.entryHazards).toHaveLength(1);
  });

  it("returns null (no-op) once the layer cap is reached", () => {
    const { state } = freshState();
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 3, y: 3 });
    postEntryHazard(state, EntryHazardKind.ToxicSpikes, { x: 3, y: 3 });
    const third = postEntryHazard(state, EntryHazardKind.ToxicSpikes, {
      x: 3,
      y: 3,
    });
    expect(third).toBeNull();
    expect(state.entryHazards[0]?.layers).toBe(2);
  });

  it("lets different kinds coexist on the same tile", () => {
    const { state } = freshState();
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 3, y: 3 });
    postEntryHazard(state, EntryHazardKind.StealthRock, { x: 3, y: 3 });
    expect(getEntryHazardsAt(state, { x: 3, y: 3 })).toHaveLength(2);
  });

  it("stacks rather than duplicating when the same kind is re-cast on a tile", () => {
    const { state } = freshState();
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 3, y: 3 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 3, y: 3 });
    expect(getEntryHazardsAt(state, { x: 3, y: 3 })).toHaveLength(1);
    expect(state.entryHazards[0]?.layers).toBe(2);
  });
});

describe("removeEntryHazardsNear", () => {
  it("removes cells within Manhattan radius and keeps the rest", () => {
    const { state } = freshState();
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 5, y: 5 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 6, y: 6 });
    postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 0 });
    const removed = removeEntryHazardsNear(state, { x: 5, y: 5 }, 2);
    expect(removed).toHaveLength(2);
    expect(state.entryHazards).toHaveLength(1);
    expect(state.entryHazards[0]?.tile).toEqual({ x: 0, y: 0 });
  });
});

describe("removeEntryHazardCell", () => {
  it("removes a specific cell instance", () => {
    const { state } = freshState();
    const cell = postEntryHazard(state, EntryHazardKind.ToxicSpikes, {
      x: 4,
      y: 4,
    });
    removeEntryHazardCell(state, cell ?? state.entryHazards[0]!);
    expect(state.entryHazards).toHaveLength(0);
  });
});

describe("spikesDamage", () => {
  it("scales the HP fraction by layer (1/8, 1/6, 1/4)", () => {
    expect(spikesDamage(400, 1)).toBe(50);
    expect(spikesDamage(400, 2)).toBe(66);
    expect(spikesDamage(400, 3)).toBe(100);
  });
});

describe("stealthRockDamage", () => {
  it("applies the Rock type multiplier to maxHp/8", () => {
    expect(stealthRockDamage(400, 1)).toBe(50);
    expect(stealthRockDamage(400, 2)).toBe(100);
    expect(stealthRockDamage(400, 0.5)).toBe(25);
    expect(stealthRockDamage(400, 4)).toBe(200);
  });

  it("deals zero on type immunity", () => {
    expect(stealthRockDamage(400, 0)).toBe(0);
  });
});

describe("absorbsToxicSpikes", () => {
  it("is true only for a Poison-type entering Pics Toxik", () => {
    expect(absorbsToxicSpikes(EntryHazardKind.ToxicSpikes, [PokemonType.Poison])).toBe(true);
    expect(absorbsToxicSpikes(EntryHazardKind.ToxicSpikes, [PokemonType.Water])).toBe(false);
    expect(absorbsToxicSpikes(EntryHazardKind.Spikes, [PokemonType.Poison])).toBe(false);
  });
});
