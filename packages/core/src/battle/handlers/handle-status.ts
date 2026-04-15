import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { PokemonType } from "../../enums/pokemon-type";
import type { StatusType } from "../../enums/status-type";
import { StatusType as StatusTypeEnum } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { isMajorStatus } from "../stat-modifier";

const VOLATILE_STATUSES: ReadonlySet<StatusType> = new Set([
  StatusTypeEnum.Confused,
  StatusTypeEnum.Seeded,
  StatusTypeEnum.Trapped,
]);

const STATUS_TYPE_IMMUNITIES: Partial<Record<StatusType, readonly PokemonType[]>> = {
  [StatusTypeEnum.Poisoned]: [PokemonType.Poison, PokemonType.Steel],
  [StatusTypeEnum.BadlyPoisoned]: [PokemonType.Poison, PokemonType.Steel],
  [StatusTypeEnum.Paralyzed]: [PokemonType.Electric],
  [StatusTypeEnum.Burned]: [PokemonType.Fire],
  [StatusTypeEnum.Frozen]: [PokemonType.Ice],
};

export function isImmuneToStatusByType(
  targetTypes: readonly PokemonType[],
  status: StatusType,
): boolean {
  const immuneTypes = STATUS_TYPE_IMMUNITIES[status];
  if (!immuneTypes) {
    return false;
  }
  return targetTypes.some((type) => immuneTypes.includes(type));
}

export function handleStatus(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Status }>;
  const random = context.random;

  for (const target of context.targets) {
    if (random() * 100 >= effect.chance) {
      continue;
    }

    const targetTypes = context.targetTypesMap.get(target.id) ?? [];

    if (effect.status === StatusTypeEnum.Seeded) {
      if (targetTypes.includes(PokemonType.Grass)) {
        events.push({
          type: BattleEventType.StatusImmune,
          targetId: target.id,
          status: effect.status,
        });
        continue;
      }
    }

    if (isImmuneToStatusByType(targetTypes, effect.status)) {
      events.push({
        type: BattleEventType.StatusImmune,
        targetId: target.id,
        status: effect.status,
      });
      continue;
    }

    if (isVolatileStatus(effect.status)) {
      const alreadyHas =
        effect.status === StatusTypeEnum.Seeded
          ? target.volatileStatuses.some(
              (v) => v.type === effect.status && v.sourceId === context.attacker.id,
            )
          : target.volatileStatuses.some((v) => v.type === effect.status);
      if (alreadyHas) {
        continue;
      }
      const remainingTurns = getStatusDuration(effect.status, random) ?? 1;
      target.volatileStatuses.push({
        type: effect.status,
        remainingTurns,
        ...(effect.status === StatusTypeEnum.Seeded ? { sourceId: context.attacker.id } : {}),
        ...(effect.status === StatusTypeEnum.Trapped && effect.damagePerTurn !== undefined
          ? { damagePerTurn: effect.damagePerTurn }
          : {}),
      });
    } else {
      const targetHasMajor = target.statusEffects.some((s) => isMajorStatus(s.type));
      if (targetHasMajor && isMajorStatus(effect.status)) {
        continue;
      }
      const remainingTurns = getStatusDuration(effect.status, random);
      target.statusEffects.push({ type: effect.status, remainingTurns });
    }

    const statusEvent: BattleEvent = {
      type: BattleEventType.StatusApplied,
      targetId: target.id,
      status: effect.status,
    };
    events.push(statusEvent);
  }

  return events;
}

function isVolatileStatus(status: StatusType): boolean {
  return VOLATILE_STATUSES.has(status);
}

function getStatusDuration(status: StatusType, random: () => number): number | null {
  switch (status) {
    case StatusTypeEnum.Asleep:
      return Math.floor(random() * 3) + 1;
    case StatusTypeEnum.Confused:
      return Math.floor(random() * 4) + 1;
    case StatusTypeEnum.Seeded:
      return -1;
    case StatusTypeEnum.Trapped:
      return Math.floor(random() * 2) + 4;
    default:
      return null;
  }
}
