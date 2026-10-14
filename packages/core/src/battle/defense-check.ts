import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { DefensiveKind } from "../enums/defensive-kind";
import { TargetingKind } from "../enums/targeting-kind";
import type { Grid } from "../grid/Grid";
import { hasLineOfSight } from "../grid/line-of-sight";
import type { BattleEvent } from "../types/battle-event";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { directionFromTo } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";

export interface DefenseResult {
  blocked: boolean;
  reflectDamage: number;
  endureAtOne: boolean;
  events: BattleEvent[];
  consumeDefense: boolean;
}

const AOE_TARGETING_KINDS: ReadonlySet<string> = new Set([
  TargetingKind.Zone,
  TargetingKind.Cross,
  TargetingKind.Cone,
  TargetingKind.Slash,
  TargetingKind.Blast,
]);

function isAttackFromFront(attackOrigin: Position, defender: PokemonInstance): boolean {
  const attackDirection = directionFromTo(attackOrigin, defender.position);
  const facingDirection = defender.orientation;
  return attackDirection !== facingDirection;
}

export function getAttackOrigin(
  attacker: PokemonInstance,
  move: MoveDefinition,
  targetPosition: Position,
): Position {
  if (move.targeting.kind === TargetingKind.Blast) {
    return targetPosition;
  }
  return attacker.position;
}

function wideGuardBlock(defender: PokemonInstance): DefenseResult {
  return {
    blocked: true,
    reflectDamage: 0,
    endureAtOne: false,
    events: [
      {
        type: BattleEventType.DefenseTriggered,
        defenderId: defender.id,
        defenseKind: DefensiveKind.WideGuard,
        blocked: true,
      },
    ],
    consumeDefense: false,
  };
}

/** Wide Guard (Garde Large) also covers allies standing within this many tiles of the caster. */
export const WIDE_GUARD_ALLY_RADIUS = 2;

/**
 * Garde Large: an AoE move hitting `defender` is blocked when a living ally (not `defender` itself,
 * whose own defense goes through `checkDefense`) holds an active Wide Guard within its radius.
 * Like Abri, it only stops hits that do not come from behind the protected mon (its own facing).
 * The cover does not reach through terrain: a wall (height difference) between the caster and the
 * ally breaks it, using the same height-aware line of sight as single-target moves.
 */
export function checkWideGuardCover(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  targetPosition: Position,
  candidates: Iterable<PokemonInstance>,
  grid: Grid,
): DefenseResult | null {
  if (move.targetsAlly === true || move.targetsAllyOrSelf === true || move.bypassProtect) {
    return null;
  }
  if (!AOE_TARGETING_KINDS.has(move.targeting.kind)) {
    return null;
  }
  for (const ally of candidates) {
    if (
      ally.id !== defender.id &&
      ally.playerId === defender.playerId &&
      ally.currentHp > 0 &&
      ally.activeDefense?.kind === DefensiveKind.WideGuard &&
      manhattanDistance(ally.position, defender.position) <= WIDE_GUARD_ALLY_RADIUS &&
      hasLineOfSight(
        grid,
        ally.position,
        defender.position,
        Math.min(
          grid.getTile(ally.position)?.height ?? 0,
          grid.getTile(defender.position)?.height ?? 0,
        ),
      )
    ) {
      const attackOrigin = getAttackOrigin(attacker, move, targetPosition);
      return isAttackFromFront(attackOrigin, defender) ? wideGuardBlock(defender) : null;
    }
  }
  return null;
}

export function checkDefense(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  damage: number,
  targetPosition: Position,
): DefenseResult {
  const noEffect: DefenseResult = {
    blocked: false,
    reflectDamage: 0,
    endureAtOne: false,
    events: [],
    consumeDefense: false,
  };

  if (!defender.activeDefense) {
    return noEffect;
  }

  if (move.targetsAlly === true || move.targetsAllyOrSelf === true) {
    return noEffect;
  }

  const defense = defender.activeDefense;
  const attackOrigin = getAttackOrigin(attacker, move, targetPosition);

  switch (defense.kind) {
    case DefensiveKind.Protect:
    case DefensiveKind.Detect: {
      if (move.bypassProtect) {
        return noEffect;
      }
      if (!isAttackFromFront(attackOrigin, defender)) {
        return noEffect;
      }
      return {
        blocked: true,
        reflectDamage: 0,
        endureAtOne: false,
        events: [
          {
            type: BattleEventType.DefenseTriggered,
            defenderId: defender.id,
            defenseKind: defense.kind,
            blocked: true,
          },
        ],
        consumeDefense: false,
      };
    }

    case DefensiveKind.WideGuard: {
      const isAoe = AOE_TARGETING_KINDS.has(move.targeting.kind);
      if (!isAoe || !isAttackFromFront(attackOrigin, defender)) {
        return noEffect;
      }
      return wideGuardBlock(defender);
    }

    case DefensiveKind.QuickGuard: {
      return {
        blocked: true,
        reflectDamage: 0,
        endureAtOne: false,
        events: [
          {
            type: BattleEventType.DefenseTriggered,
            defenderId: defender.id,
            defenseKind: defense.kind,
            blocked: true,
          },
        ],
        consumeDefense: true,
      };
    }

    case DefensiveKind.Counter: {
      if (move.category !== Category.Physical) {
        return noEffect;
      }
      const distance = manhattanDistance(attacker.position, defender.position);
      if (distance > 1) {
        return noEffect;
      }
      return {
        blocked: false,
        reflectDamage: damage * 2,
        endureAtOne: false,
        events: [
          {
            type: BattleEventType.DefenseTriggered,
            defenderId: defender.id,
            defenseKind: defense.kind,
            blocked: false,
          },
        ],
        consumeDefense: false,
      };
    }

    case DefensiveKind.MirrorCoat: {
      if (move.category !== Category.Special) {
        return noEffect;
      }
      return {
        blocked: false,
        reflectDamage: damage * 2,
        endureAtOne: false,
        events: [
          {
            type: BattleEventType.DefenseTriggered,
            defenderId: defender.id,
            defenseKind: defense.kind,
            blocked: false,
          },
        ],
        consumeDefense: false,
      };
    }

    case DefensiveKind.MetalBurst: {
      if (move.category === Category.Status) {
        return noEffect;
      }
      return {
        blocked: false,
        reflectDamage: Math.floor(damage * 1.5),
        endureAtOne: false,
        events: [
          {
            type: BattleEventType.DefenseTriggered,
            defenderId: defender.id,
            defenseKind: defense.kind,
            blocked: false,
          },
        ],
        consumeDefense: false,
      };
    }

    case DefensiveKind.Endure: {
      if (defender.currentHp - damage > 0) {
        return noEffect;
      }
      return {
        blocked: false,
        reflectDamage: 0,
        endureAtOne: true,
        events: [
          {
            type: BattleEventType.DefenseTriggered,
            defenderId: defender.id,
            defenseKind: defense.kind,
            blocked: false,
          },
        ],
        consumeDefense: false,
      };
    }

    default:
      return noEffect;
  }
}
