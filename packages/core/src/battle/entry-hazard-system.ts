import { EntryHazardKind } from "../enums/entry-hazard-kind";
import { PokemonType } from "../enums/pokemon-type";
import type { BattleState } from "../types/battle-state";
import type { EntryHazardCell } from "../types/entry-hazard-cell";
import type { Position } from "../types/position";

/** Manhattan radius around the user cleared by a remover (Tour Rapide / Anti-Brume). */
export const HAZARD_REMOVAL_RADIUS = 2;
/** HP fraction divisor for Picots, per layer: 1 → maxHp/8, 2 → maxHp/6, 3 → maxHp/4. */
export const SPIKES_DAMAGE_DIVISOR_BY_LAYER: Readonly<Record<number, number>> = {
  1: 8,
  2: 6,
  3: 4,
};
/** HP fraction divisor for Pièges de Roc (before type effectiveness). */
export const STEALTH_ROCK_DAMAGE_DIVISOR = 8;

/** Maximum layers a hazard kind can stack to. */
export function maxLayersFor(kind: EntryHazardKind): number {
  switch (kind) {
    case EntryHazardKind.Spikes:
      return 3;
    case EntryHazardKind.ToxicSpikes:
      return 2;
    default:
      return 1;
  }
}

/** Picots / Pics Toxik / Toile Gluante affect grounded mons only; Pièges de Roc hits everyone. */
export function isGroundedOnlyHazard(kind: EntryHazardKind): boolean {
  return kind !== EntryHazardKind.StealthRock;
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Place a hazard on a single tile. Re-casting the SAME kind on the SAME tile adds a layer (capped per
 * kind; no-op at cap). A different kind coexists on the same tile. Team-agnostic. Returns the affected
 * cell (or null if it was a no-op at cap).
 */
export function postEntryHazard(
  state: BattleState,
  kind: EntryHazardKind,
  tile: Position,
): EntryHazardCell | null {
  const existing = state.entryHazards.find(
    (cell) => cell.kind === kind && cell.tile.x === tile.x && cell.tile.y === tile.y,
  );
  if (existing) {
    const cap = maxLayersFor(kind);
    if (existing.layers >= cap) {
      return null;
    }
    existing.layers += 1;
    return existing;
  }
  const cell: EntryHazardCell = {
    kind,
    tile: { x: tile.x, y: tile.y },
    layers: 1,
  };
  state.entryHazards.push(cell);
  return cell;
}

/** All hazard cells covering `position` (several kinds may share a tile). */
export function getEntryHazardsAt(state: BattleState, position: Position): EntryHazardCell[] {
  return state.entryHazards.filter(
    (cell) => cell.tile.x === position.x && cell.tile.y === position.y,
  );
}

/** Remove (and return) every hazard cell within `radius` Manhattan of `position`. */
export function removeEntryHazardsNear(
  state: BattleState,
  position: Position,
  radius: number,
): EntryHazardCell[] {
  const removed: EntryHazardCell[] = [];
  for (let i = state.entryHazards.length - 1; i >= 0; i--) {
    const cell = state.entryHazards[i];
    if (cell && manhattan(cell.tile, position) <= radius) {
      removed.unshift(cell);
      state.entryHazards.splice(i, 1);
    }
  }
  return removed;
}

/** Remove a specific hazard cell (Pics Toxik absorbed by a grounded Poison-type). */
export function removeEntryHazardCell(state: BattleState, target: EntryHazardCell): void {
  const index = state.entryHazards.indexOf(target);
  if (index >= 0) {
    state.entryHazards.splice(index, 1);
  }
}

/** Picots damage for the given layer count and max HP (at least 1). */
export function spikesDamage(maxHp: number, layers: number): number {
  const divisor = SPIKES_DAMAGE_DIVISOR_BY_LAYER[layers] ?? SPIKES_DAMAGE_DIVISOR_BY_LAYER[1] ?? 8;
  return Math.max(1, Math.floor(maxHp / divisor));
}

/** Pièges de Roc damage = floor(maxHp/8) × Rock type effectiveness (≥1 unless immune). */
export function stealthRockDamage(maxHp: number, typeMultiplier: number): number {
  const base = Math.floor(maxHp / STEALTH_ROCK_DAMAGE_DIVISOR);
  const amount = Math.floor(base * typeMultiplier);
  return typeMultiplier > 0 ? Math.max(1, amount) : 0;
}

/** A grounded Poison-type entering a Pics Toxik tile absorbs (dissolves) it. */
export function absorbsToxicSpikes(
  kind: EntryHazardKind,
  pokemonTypes: readonly PokemonType[],
): boolean {
  return kind === EntryHazardKind.ToxicSpikes && pokemonTypes.includes(PokemonType.Poison);
}
