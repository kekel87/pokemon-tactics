/**
 * Ground aura rings (plan 182): turns the three heterogeneous aura sources of a
 * battle state into one flat list of ring specs the renderer can draw without
 * knowing anything about auras.
 *
 * The three sources have nothing in common structurally — team auras live in
 * `state.auras` keyed by `AuraKind`, Requiem lives on `pokemon.perishAura` with its
 * own radius, and Brouhaha is inferred from a lock-in move id — so this module is
 * where they are normalised. Every aura is anchored on its caster's LIVE position:
 * they all move when the caster moves, there is no "static aura" case.
 */

import {
  AURA_RADIUS,
  type BattleState,
  isUproarLocked,
  type PokemonInstance,
  type Position,
  UPROAR_AURA_RADIUS,
} from "@pokemon-tactic/core";
import type { AuraRingKind, AuraRingSpec } from "@pokemon-tactic/render-ports";
import { AURA_RING_COLOR_BY_KIND } from "./constants";

/** Tile lookup for an aura zone — `Grid.getTilesInRange` clips to the map for us. */
export type AuraZoneTiles = (center: Position, radius: number) => readonly Position[];

/** An aura before its stack height is known: sorting decides that. */
interface PendingRing {
  readonly kind: AuraRingKind;
  readonly caster: PokemonInstance;
  readonly radius: number;
  /** `actionCounter` at post time for team auras; undefined for Requiem / Brouhaha. */
  readonly postedAtAction: number | undefined;
}

/**
 * Order within one caster's stack. Team auras come first, by post time, so the stack grows
 * as auras are cast; Requiem and Brouhaha carry no post time and fall in behind them.
 *
 * The `kind` tie-break is load-bearing, not decoration: one action can post two auras, and
 * without it equal post times would fall back to `Array#sort` stability over `state.auras`
 * insertion order — an invariant nothing pins. Never a `Map` iteration order either, which
 * would let the stack reshuffle between frames.
 */
function compareRings(a: PendingRing, b: PendingRing): number {
  if (a.postedAtAction !== undefined && b.postedAtAction !== undefined) {
    return a.postedAtAction - b.postedAtAction || a.kind.localeCompare(b.kind);
  }
  if (a.postedAtAction !== undefined) {
    return -1;
  }
  if (b.postedAtAction !== undefined) {
    return 1;
  }
  return a.kind.localeCompare(b.kind);
}

/** Every aura ring to draw for the current state, stacked per caster. */
export function buildAuraRingSpecs(
  state: BattleState,
  zoneTiles: AuraZoneTiles,
): readonly AuraRingSpec[] {
  const pending: PendingRing[] = [];

  for (const aura of state.auras) {
    const caster = state.pokemon.get(aura.casterPokemonId);
    if (!caster || caster.currentHp <= 0) {
      continue;
    }
    pending.push({
      kind: aura.kind,
      caster,
      radius: AURA_RADIUS,
      postedAtAction: aura.postedAtAction,
    });
  }

  for (const pokemon of state.pokemon.values()) {
    if (pokemon.currentHp <= 0) {
      continue;
    }
    // Requiem carries its own radius — the only aura whose radius is not a constant.
    if (pokemon.perishAura !== undefined) {
      pending.push({
        kind: "perish-aura",
        caster: pokemon,
        radius: pokemon.perishAura.radius,
        postedAtAction: undefined,
      });
    }
    if (isUproarLocked(pokemon)) {
      pending.push({
        kind: "uproar",
        caster: pokemon,
        radius: UPROAR_AURA_RADIUS,
        postedAtAction: undefined,
      });
    }
  }

  const byCaster = new Map<string, PendingRing[]>();
  for (const ring of pending) {
    const bucket = byCaster.get(ring.caster.id);
    if (bucket) {
      bucket.push(ring);
    } else {
      byCaster.set(ring.caster.id, [ring]);
    }
  }

  const specs: AuraRingSpec[] = [];
  // Casters are visited in a sorted order too: the renderer rebuilds meshes from this
  // list, so a stable order keeps mesh names stable across frames.
  const sortedCasters = [...byCaster].sort(([left], [right]) => left.localeCompare(right));
  for (const [casterId, casterRings] of sortedCasters) {
    for (const [index, ring] of casterRings.slice().sort(compareRings).entries()) {
      specs.push({
        id: `${ring.kind}:${casterId}`,
        kind: ring.kind,
        casterPokemonId: casterId,
        tiles: zoneTiles(ring.caster.position, ring.radius),
        color: AURA_RING_COLOR_BY_KIND[ring.kind],
        stackIndex: index,
      });
    }
  }
  return specs;
}
