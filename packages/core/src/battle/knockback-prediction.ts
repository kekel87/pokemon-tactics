import { PokemonType } from "../enums/pokemon-type";
import { isTerrainPassable, TerrainType } from "../enums/terrain-type";
import type { Grid } from "../grid/Grid";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { isEffectivelyFlying } from "./effective-flying";
import { calculateFallDamage } from "./fall-damage";
import { isTerrainImmune } from "./terrain-effects";

/** Fall-damage tier used when an ice slide slams the slider into another Pokemon. */
export const ICE_SLIDE_COLLISION_HEIGHT = 2;

export interface KnockbackDirection {
  readonly dx: number;
  readonly dy: number;
}

/** Cardinal push direction: away from the attacker, snapped to the dominant axis. */
export function getKnockbackDirection(
  attackerPosition: Position,
  targetPosition: Position,
): KnockbackDirection {
  const dx = targetPosition.x - attackerPosition.x;
  const dy = targetPosition.y - attackerPosition.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx: dx >= 0 ? 1 : -1, dy: 0 };
  }
  return { dx: 0, dy: dy >= 0 ? 1 : -1 };
}

export type KnockbackBlockReason = "edge" | "occupied" | "terrain";

export interface KnockbackDestination {
  /** Where the pushed mon lands (a lethal tile is a valid destination), or null if it does not move. */
  readonly destination: Position | null;
  /** Why the push stopped short, or null if it ran the full distance onto passable ground. */
  readonly blockedReason: KnockbackBlockReason | null;
}

/**
 * Pure resolution of a knockback push (no mutation). Mirrors the step loop of `handle-knockback`:
 * accumulates the last passable tile, lands on a non-immune impassable tile (lethal), and reports why
 * the push stopped (edge / occupied / immune terrain). Shared by the handler and the AI predictor.
 */
export function resolveKnockbackDestination(params: {
  targetPosition: Position;
  direction: KnockbackDirection;
  distance: number;
  grid: Grid;
  targetTypes: PokemonType[];
  targetIsFlying: boolean;
}): KnockbackDestination {
  const { targetPosition, direction, distance, grid, targetTypes, targetIsFlying } = params;
  let destination: Position | null = null;

  for (let step = 1; step <= distance; step++) {
    const candidate: Position = {
      x: targetPosition.x + direction.dx * step,
      y: targetPosition.y + direction.dy * step,
    };

    if (!grid.isInBounds(candidate)) {
      return { destination, blockedReason: "edge" };
    }

    const candidateTile = grid.getTile(candidate);
    if (candidateTile && !isTerrainPassable(candidateTile.terrain)) {
      if (isTerrainImmune(candidateTile.terrain, targetTypes, targetIsFlying)) {
        return { destination, blockedReason: "terrain" };
      }
      return { destination: candidate, blockedReason: null };
    }

    if (grid.getOccupant(candidate) !== null) {
      return { destination, blockedReason: "occupied" };
    }

    destination = candidate;
  }

  return { destination, blockedReason: null };
}

export interface IceSlidePath {
  /** Final resting tile of the slide (equals slideStart when the slider is stopped immediately). */
  readonly slideEnd: Position;
  /** Height difference of an impassable wall the slide slammed into, or null if none. */
  readonly wallImpactHeightDiff: number | null;
  /** Id of a living mon the slide collided with, or null if none. */
  readonly collisionId: string | null;
}

/**
 * Pure resolution of an ice slide (no mutation). Mirrors `performIceSlide`: the slider keeps moving in
 * the push direction across ice until the map edge, an impassable wall (impact), a living occupant
 * (collision), or a non-ice tile. Shared by the handler and the AI predictor.
 */
export function resolveIceSlide(params: {
  slideStart: Position;
  direction: KnockbackDirection;
  grid: Grid;
  state: BattleState;
}): IceSlidePath {
  const { slideStart, direction, grid, state } = params;
  let current = slideStart;
  let slideEnd = slideStart;

  while (true) {
    const next: Position = { x: current.x + direction.dx, y: current.y + direction.dy };
    if (!grid.isInBounds(next)) {
      break;
    }
    const nextTile = grid.getTile(next);
    if (!nextTile) {
      break;
    }
    if (!isTerrainPassable(nextTile.terrain)) {
      const wallImpactHeightDiff = Math.max(
        0,
        nextTile.height - (grid.getTile(current)?.height ?? 0),
      );
      return { slideEnd, wallImpactHeightDiff, collisionId: null };
    }
    const occupantId = grid.getOccupant(next);
    if (occupantId !== null) {
      const collidee = state.pokemon.get(occupantId);
      if (collidee && collidee.currentHp > 0) {
        return { slideEnd, wallImpactHeightDiff: null, collisionId: occupantId };
      }
    }
    slideEnd = next;
    current = next;
    if (nextTile.terrain !== TerrainType.Ice) {
      break;
    }
  }

  return { slideEnd, wallImpactHeightDiff: null, collisionId: null };
}

export interface KnockbackOutcome {
  /** Final tile the target ends on. */
  readonly finalPosition: Position;
  /** Total damage the push inflicts on the target (fall + wall impact + slide collision). */
  readonly damage: number;
  /** True when the push KOs the target (lethal terrain, or accumulated damage ≥ current HP). */
  readonly lethal: boolean;
  /** Id of a mon the target collides with mid-slide, or null. */
  readonly collisionId: string | null;
}

/**
 * Read-only prediction of a knockback's full outcome for a single target (no mutation). Composes the
 * pure resolvers above with the fall-damage formula so the AI can value a push by its actual result
 * — chiefly the ring-out on « Le Mur »: pushing a foe off the ice plateau is a fall KO. Returns null
 * when the push does not move the target at all (blocked at step 1 with no partial displacement).
 */
export function predictKnockbackOutcome(params: {
  attackerPosition: Position;
  target: PokemonInstance;
  distance: number;
  grid: Grid;
  targetTypes: PokemonType[];
  state: BattleState;
}): KnockbackOutcome | null {
  const { attackerPosition, target, distance, grid, targetTypes, state } = params;
  const targetIsFlying = isEffectivelyFlying(target, targetTypes);
  const direction = getKnockbackDirection(attackerPosition, target.position);
  const { destination } = resolveKnockbackDestination({
    targetPosition: target.position,
    direction,
    distance,
    grid,
    targetTypes,
    targetIsFlying,
  });
  if (destination === null) {
    return null;
  }

  const destTile = grid.getTile(destination);
  if (destTile && !isTerrainPassable(destTile.terrain)) {
    return {
      finalPosition: destination,
      damage: target.currentHp,
      lethal: true,
      collisionId: null,
    };
  }

  let damage = 0;
  const fromHeight = grid.getTile(target.position)?.height ?? 0;
  const destHeight = destTile?.height ?? 0;
  if (fromHeight - destHeight > 0 && !targetIsFlying) {
    damage += calculateFallDamage(fromHeight - destHeight, target.maxHp);
  }

  let finalPosition = destination;
  let collisionId: string | null = null;
  const isIceImmune = targetTypes.includes(PokemonType.Ice) || targetIsFlying;
  if (destTile?.terrain === TerrainType.Ice && !isIceImmune) {
    const slide = resolveIceSlide({ slideStart: destination, direction, grid, state });
    finalPosition = slide.slideEnd;
    if (slide.wallImpactHeightDiff !== null) {
      damage += calculateFallDamage(slide.wallImpactHeightDiff, target.maxHp);
    }
    if (slide.collisionId !== null) {
      damage += calculateFallDamage(ICE_SLIDE_COLLISION_HEIGHT, target.maxHp);
      collisionId = slide.collisionId;
    }
    const slideStartHeight = grid.getTile(destination)?.height ?? 0;
    const slideEndHeight = grid.getTile(slide.slideEnd)?.height ?? 0;
    if (slideStartHeight - slideEndHeight > 0) {
      damage += calculateFallDamage(slideStartHeight - slideEndHeight, target.maxHp);
    }
  }

  return { finalPosition, damage, lethal: damage >= target.currentHp, collisionId };
}
