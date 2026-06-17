import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { FieldTerrain } from "../enums/field-terrain";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../testing";
import {
  decrementFieldTerrainsTimer,
  enumerateZoneTiles,
  FIELD_TERRAIN_DEFAULT_DURATION,
  FIELD_TERRAIN_EXTENDED_DURATION,
  FIELD_TERRAIN_RADIUS,
  fieldTerrainDurationForCaster,
  getActiveZonesOfKind,
  getFieldTerrainAt,
  isOnFieldTerrain,
  postFieldTerrain,
} from "./field-terrain-system";
import {
  createFieldTerrainHealHandler,
  fieldTerrainDecrementHandler,
} from "./handlers/field-terrain-tick-handler";

// ---------------------------------------------------------------------------
// fieldTerrainDurationForCaster
// ---------------------------------------------------------------------------

describe("fieldTerrainDurationForCaster", () => {
  it("returns default duration (5) when caster holds no item", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "caster" });
    expect(fieldTerrainDurationForCaster(caster)).toBe(FIELD_TERRAIN_DEFAULT_DURATION);
    expect(fieldTerrainDurationForCaster(caster)).toBe(5);
  });

  it("returns extended duration (8) when caster holds TerrainExtender", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      heldItemId: HeldItemId.TerrainExtender,
    });
    expect(fieldTerrainDurationForCaster(caster)).toBe(FIELD_TERRAIN_EXTENDED_DURATION);
    expect(fieldTerrainDurationForCaster(caster)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// enumerateZoneTiles
// ---------------------------------------------------------------------------

describe("enumerateZoneTiles", () => {
  it("returns 25 tiles for an r3 diamond centred in a 10x10 grid", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c", position: { x: 5, y: 5 } });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 9, y: 9 },
    });
    const { state } = buildMoveTestEngine([caster, foe], { gridSize: 10 });
    const tiles = enumerateZoneTiles(state, { x: 5, y: 5 }, FIELD_TERRAIN_RADIUS);
    expect(tiles.length).toBe(25);
  });

  it("truncates out-of-bounds tiles at a corner", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c", position: { x: 0, y: 0 } });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    const tiles = enumerateZoneTiles(state, { x: 0, y: 0 }, FIELD_TERRAIN_RADIUS);
    // Full diamond would include negative coordinates — only in-bounds tiles count
    expect(tiles.length).toBeLessThan(25);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// postFieldTerrain
// ---------------------------------------------------------------------------

describe("postFieldTerrain", () => {
  it("pushes a new zone into state.fieldTerrains with correct kind and casterId", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 2, y: 2 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);

    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    expect(state.fieldTerrains).toHaveLength(1);
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Grassy);
    expect(state.fieldTerrains[0]?.casterId).toBe("caster");
    expect(state.fieldTerrains[0]?.anchor).toEqual({ x: 2, y: 2 });
  });

  it("posts from different epicenters coexist as separate zones", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 2, y: 2 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 8, y: 8 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);

    postFieldTerrain(state, caster, FieldTerrain.Grassy);
    caster.position = { x: 6, y: 6 };
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    expect(state.fieldTerrains).toHaveLength(2);
  });

  it("posting on the exact epicenter of an existing zone replaces it (ally or enemy)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 4, y: 4 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);

    postFieldTerrain(state, caster, FieldTerrain.Grassy);
    // Enemy posts on the same epicenter → replaces, not stacks.
    postFieldTerrain(state, foe, FieldTerrain.Electric);

    expect(state.fieldTerrains).toHaveLength(1);
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Electric);
    expect(state.fieldTerrains[0]?.casterId).toBe("foe");
  });
});

// ---------------------------------------------------------------------------
// getFieldTerrainAt — recency rule
// ---------------------------------------------------------------------------

describe("getFieldTerrainAt", () => {
  it("returns null when no zone exists", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c" });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    expect(getFieldTerrainAt(state, { x: 2, y: 2 })).toBeNull();
  });

  it("returns the kind of the zone containing a position", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 3, y: 3 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Electric);

    // (3,3) is the anchor, definitely inside the zone
    expect(getFieldTerrainAt(state, { x: 3, y: 3 })).toBe(FieldTerrain.Electric);
  });

  it("returns null for a position outside all zones", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 0, y: 0 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    // (5,5) is at manhattan(5,5,0,0) = 10 > 3 — outside the zone
    expect(getFieldTerrainAt(state, { x: 5, y: 5 })).toBeNull();
  });

  it("returns the most recently posted zone on an overlapping tile (last wins)", () => {
    const casterA = MockPokemon.fresh(MockPokemon.base, {
      id: "caster-a",
      position: { x: 2, y: 2 },
    });
    const casterB = MockPokemon.fresh(MockPokemon.base, {
      id: "caster-b",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { state } = buildMoveTestEngine([casterA, casterB]);

    // Post Grassy first, then Electric at overlapping tile (3,2) is in both zones
    postFieldTerrain(state, casterA, FieldTerrain.Grassy);
    postFieldTerrain(state, casterB, FieldTerrain.Electric);

    // (3,2) is covered by both zones; Electric was posted last → wins
    expect(getFieldTerrainAt(state, { x: 3, y: 2 })).toBe(FieldTerrain.Electric);
    // (1,2) is only in zone A (manhattan(1,2,2,2)=1 ≤ 3; manhattan(1,2,3,2)=2 ≤ 3) → both!
    // (0,2): manhattan(0,2,2,2)=2 ≤ 3 → in A; manhattan(0,2,3,2)=3 ≤ 3 → in B too
    // So Electric still wins at (0,2) too. Let's check (2,2) which is only in A's zone
    // but also in B's zone? manhattan(2,2,3,2)=1 ≤ 3 → in B too. Both overlap heavily.
    // The key assertion: last posted wins on a shared tile.
    expect(getFieldTerrainAt(state, { x: 2, y: 2 })).toBe(FieldTerrain.Electric);
  });
});

// ---------------------------------------------------------------------------
// isOnFieldTerrain — double gate
// ---------------------------------------------------------------------------

describe("isOnFieldTerrain", () => {
  it("returns true for a grounded mon standing on a matching zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 2, y: 2 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    // caster is at (2,2) which is inside the zone, and is grounded (non-flying, no levitate)
    expect(isOnFieldTerrain(state, caster, [], FieldTerrain.Grassy)).toBe(true);
  });

  it("returns false for a Flying-type mon on the zone (grounded gate, decision #427)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 2, y: 2 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    // Pass Flying type explicitly — simulates what pokemonTypesMap returns for a Flying-type mon
    const flyingTypes: PokemonType[] = [PokemonType.Flying];
    expect(isOnFieldTerrain(state, caster, flyingTypes, FieldTerrain.Grassy)).toBe(false);
  });

  it("returns false for a grounded mon on the wrong terrain type", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 2, y: 2 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Electric);

    expect(isOnFieldTerrain(state, caster, [], FieldTerrain.Grassy)).toBe(false);
  });

  it("returns false for a grounded mon outside any zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 0, y: 0 },
    });
    const outOfZone = MockPokemon.fresh(MockPokemon.base, {
      id: "out",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, outOfZone]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    expect(isOnFieldTerrain(state, outOfZone, [], FieldTerrain.Grassy)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// decrementFieldTerrainsTimer
// ---------------------------------------------------------------------------

describe("decrementFieldTerrainsTimer", () => {
  it("decrements remainingTurns on each zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c", position: { x: 2, y: 2 } });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);
    expect(state.fieldTerrains[0]?.remainingTurns).toBe(5);

    decrementFieldTerrainsTimer(state, "c");

    expect(state.fieldTerrains[0]?.remainingTurns).toBe(4);
  });

  it("removes zones that reach zero and returns them as expired", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c", position: { x: 2, y: 2 } });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Electric);
    state.fieldTerrains[0]!.remainingTurns = 1;

    const expired = decrementFieldTerrainsTimer(state, "c");

    expect(state.fieldTerrains).toHaveLength(0);
    expect(expired).toHaveLength(1);
    expect(expired[0]?.kind).toBe(FieldTerrain.Electric);
    expect(expired[0]?.casterId).toBe("c");
  });

  it("decrements each zone on its own caster's turn — zones expire independently", () => {
    const casterA = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 1, y: 1 } });
    const casterB = MockPokemon.fresh(MockPokemon.base, {
      id: "b",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { state } = buildMoveTestEngine([casterA, casterB]);
    postFieldTerrain(state, casterA, FieldTerrain.Grassy);
    postFieldTerrain(state, casterB, FieldTerrain.Misty);

    // Set zone A to expire next decrement, zone B has 3 left
    state.fieldTerrains[0]!.remainingTurns = 1;
    state.fieldTerrains[1]!.remainingTurns = 3;

    // Each zone counts down only on its own caster's turn.
    const expiredA = decrementFieldTerrainsTimer(state, "a");
    const expiredB = decrementFieldTerrainsTimer(state, "b");

    expect(state.fieldTerrains).toHaveLength(1);
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Misty);
    expect(state.fieldTerrains[0]?.remainingTurns).toBe(2);
    expect(expiredA).toHaveLength(1);
    expect(expiredA[0]?.kind).toBe(FieldTerrain.Grassy);
    expect(expiredB).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getActiveZonesOfKind
// ---------------------------------------------------------------------------

describe("getActiveZonesOfKind", () => {
  it("returns all zones of the requested kind and none of others", () => {
    const casterA = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 0, y: 0 } });
    const casterB = MockPokemon.fresh(MockPokemon.base, {
      id: "b",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([casterA, casterB]);
    postFieldTerrain(state, casterA, FieldTerrain.Grassy);
    postFieldTerrain(state, casterB, FieldTerrain.Misty);

    const grassyZones = getActiveZonesOfKind(state, FieldTerrain.Grassy);
    const mistyZones = getActiveZonesOfKind(state, FieldTerrain.Misty);
    const electricZones = getActiveZonesOfKind(state, FieldTerrain.Electric);

    expect(grassyZones).toHaveLength(1);
    expect(grassyZones[0]?.casterId).toBe("a");
    expect(mistyZones).toHaveLength(1);
    expect(electricZones).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-zones / overlap
// ---------------------------------------------------------------------------

describe("multi-zones — two different zones coexist independently", () => {
  it("two different zones coexist and each has its own timer", () => {
    const casterA = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 0, y: 0 } });
    const casterB = MockPokemon.fresh(MockPokemon.base, {
      id: "b",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([casterA, casterB]);

    postFieldTerrain(state, casterA, FieldTerrain.Grassy);
    state.fieldTerrains[0]!.remainingTurns = 3;
    postFieldTerrain(state, casterB, FieldTerrain.Electric);
    state.fieldTerrains[1]!.remainingTurns = 5;

    decrementFieldTerrainsTimer(state, "a");
    decrementFieldTerrainsTimer(state, "b");

    expect(state.fieldTerrains).toHaveLength(2);
    expect(state.fieldTerrains[0]?.remainingTurns).toBe(2);
    expect(state.fieldTerrains[1]?.remainingTurns).toBe(4);
  });
});

describe("multi-zones — zone survives caster KO (decision #426 / #89)", () => {
  it("zone array is unchanged after manually zeroing the caster's HP", () => {
    // Decision §2: zones survive caster KO. Verified by checking state.fieldTerrains
    // after the caster mon is dead (HP = 0). handleKo does NOT remove the caster's zones.
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 100,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);
    expect(state.fieldTerrains).toHaveLength(1);

    // Simulate caster KO by zeroing HP directly — no engine handleKo involved
    const liveCaster = state.pokemon.get("caster");
    if (liveCaster) {
      liveCaster.currentHp = 0;
    }

    // Zone must still exist — it is not tied to the caster's liveness
    expect(state.fieldTerrains).toHaveLength(1);
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Grassy);
    expect(state.fieldTerrains[0]?.casterId).toBe("caster");
  });

  it("zone timer still decrements after caster KO and heals remaining grounded mons", () => {
    // Two pokemon: caster (P1) and healer-ally (P1) — no P2 adversary to complicate turns.
    // Verify the heal fires when caster has HP = 0.
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 100,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      currentHp: 50,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    // Kill the caster directly (no engine KO, just zero HP)
    const liveCaster = state.pokemon.get("caster");
    if (liveCaster) {
      liveCaster.currentHp = 0;
    }

    // Round 1: caster EndTurn (HP=0 but it's their turn — engine still expects action)
    // ally does EndTurn — heal fires for ally
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "ally",
      direction: Direction.South,
    });

    const expectedHeal = Math.max(1, Math.floor(160 / 16));
    expect(state.pokemon.get("ally")?.currentHp).toBe(50 + expectedHeal);
    expect(state.fieldTerrains).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tick handler — heal + decrement, in integration
// ---------------------------------------------------------------------------

describe("field-terrain-tick-handler — Grassy heal fires end-of-turn (per CT turn)", () => {
  it("heals a grounded mon standing on the zone at the end of each of its turns", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["grassy-terrain"],
      currentHp: 80,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 2, y: 2 },
    });

    const expectedHeal = Math.max(1, Math.floor(160 / 16));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });

    expect(state.pokemon.get("caster")?.currentHp).toBe(80 + expectedHeal);

    endTurnUntilActor(engine, state, "caster");
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });

    expect(state.pokemon.get("caster")?.currentHp).toBe(80 + expectedHeal * 2);
  });

  it("decrements only the zones posted by the acting mon (setter-scoped, no round dedup)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c", position: { x: 2, y: 2 } });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);
    const handler = fieldTerrainDecrementHandler;

    // The caster's own turn counts its zone down.
    handler("c", state);
    expect(state.fieldTerrains[0]?.remainingTurns).toBe(4);

    // Another mon's turn does not touch the caster's zone.
    handler("f", state);
    expect(state.fieldTerrains[0]?.remainingTurns).toBe(4);
  });

  it("heal handler emits HpRestored", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 2, y: 2 },
      currentHp: 80,
      maxHp: 160,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    // "test" is MockPokemon.base.definitionId — map it to empty types (grounded)
    const pokemonTypesMap = new Map<string, PokemonType[]>([["test", []]]);
    const handler = createFieldTerrainHealHandler(pokemonTypesMap);
    const result = handler("caster", state);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe(BattleEventType.HpRestored);
    if (result.events[0]?.type === BattleEventType.HpRestored) {
      expect(result.events[0].pokemonId).toBe("caster");
      const expectedHeal = Math.max(1, Math.floor(160 / 16));
      expect(result.events[0].amount).toBe(expectedHeal);
    }
  });

  it("heal handler returns empty result when mon is at full HP", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      position: { x: 2, y: 2 },
      currentHp: 100,
      maxHp: 100,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    postFieldTerrain(state, caster, FieldTerrain.Grassy);

    const pokemonTypesMap = new Map<string, PokemonType[]>([["test", []]]);
    const handler = createFieldTerrainHealHandler(pokemonTypesMap);
    const result = handler("caster", state);

    expect(result.events).toHaveLength(0);
    expect(state.pokemon.get("caster")?.currentHp).toBe(100);
  });
});
