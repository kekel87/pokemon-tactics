import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { DefensiveKind } from "../enums/defensive-kind";
import { TargetingKind } from "../enums/targeting-kind";
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

function getAttackOrigin(
  attacker: PokemonInstance,
  move: MoveDefinition,
  targetPosition: Position,
): Position {
  if (move.targeting.kind === TargetingKind.Blast) {
    return targetPosition;
  }
  return attacker.position;
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

  const defense = defender.activeDefense;
  const attackOrigin = getAttackOrigin(attacker, move, targetPosition);

  switch (defense.kind) {
    case DefensiveKind.Protect:
    case DefensiveKind.Detect: {
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
      if (!isAoe) {
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
