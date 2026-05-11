import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { EffectTarget } from "../../enums/effect-target";
import { PokemonType } from "../../enums/pokemon-type";
import type { StatusType } from "../../enums/status-type";
import { StatusType as StatusTypeEnum } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import { DEFAULT_STATUS_RULES, type StatusRules } from "../../types/status-rules";
import type { EffectContext } from "../effect-handler-registry";
import { isMajorStatus } from "../stat-modifier";

const VOLATILE_STATUSES: ReadonlySet<StatusType> = new Set([
  StatusTypeEnum.Confused,
  StatusTypeEnum.Seeded,
  StatusTypeEnum.Trapped,
  StatusTypeEnum.Intimidated,
  StatusTypeEnum.Infatuated,
  StatusTypeEnum.LockedOn,
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
  const statusRules = context.statusRules ?? DEFAULT_STATUS_RULES;

  const resolvedTargets =
    effect.target === EffectTarget.Self ? [context.attacker] : context.targets;

  for (const target of resolvedTargets) {
    if (random() * 100 >= effect.chance) {
      continue;
    }

    const status: StatusType =
      "statuses" in effect
        ? (effect.statuses[Math.floor(random() * effect.statuses.length)] ?? effect.statuses[0]!)
        : effect.status;

    const targetTypes = context.targetTypesMap.get(target.id) ?? [];
    const targetAbility = context.abilityRegistry?.getForPokemon(target);

    if (status === StatusTypeEnum.Seeded) {
      if (targetTypes.includes(PokemonType.Grass)) {
        events.push({
          type: BattleEventType.StatusImmune,
          targetId: target.id,
          status,
        });
        continue;
      }
    }

    if (isImmuneToStatusByType(targetTypes, status)) {
      events.push({
        type: BattleEventType.StatusImmune,
        targetId: target.id,
        status,
      });
      continue;
    }

    const statusBlockResult = targetAbility?.onStatusBlocked?.({
      self: target,
      status,
      source: context.attacker,
    });
    if (statusBlockResult?.blocked) {
      events.push(...statusBlockResult.events);
      events.push({
        type: BattleEventType.StatusImmune,
        targetId: target.id,
        status,
      });
      continue;
    }

    if (isVolatileStatus(status)) {
      const alreadyHas =
        status === StatusTypeEnum.Seeded
          ? target.volatileStatuses.some(
              (v) => v.type === status && v.sourceId === context.attacker.id,
            )
          : target.volatileStatuses.some((v) => v.type === status);
      if (alreadyHas) {
        continue;
      }
      const baseDuration = getStatusDuration(status, random, statusRules) ?? 1;
      let remainingTurns = baseDuration;
      if (targetAbility?.onStatusDurationModify) {
        const result = targetAbility.onStatusDurationModify({
          self: target,
          status,
          duration: baseDuration,
        });
        remainingTurns = result.duration;
        events.push(...result.events);
      }
      target.volatileStatuses.push({
        type: status,
        remainingTurns,
        ...(status === StatusTypeEnum.Seeded ? { sourceId: context.attacker.id } : {}),
        ...("damagePerTurn" in effect && status === StatusTypeEnum.Trapped && effect.damagePerTurn !== undefined
          ? { damagePerTurn: effect.damagePerTurn }
          : {}),
      });
    } else {
      const targetHasMajor = target.statusEffects.some((s) => isMajorStatus(s.type));
      if (targetHasMajor && isMajorStatus(status)) {
        continue;
      }
      const baseDuration = getStatusDuration(status, random, statusRules);
      let remainingTurns: number | null = baseDuration;
      let shortenedByAbilityId: string | undefined;
      if (baseDuration !== null && targetAbility?.onStatusDurationModify) {
        const result = targetAbility.onStatusDurationModify({
          self: target,
          status,
          duration: baseDuration,
        });
        if (result.duration < baseDuration) {
          shortenedByAbilityId = targetAbility.id;
        }
        remainingTurns = result.duration;
      }
      target.statusEffects.push({
        type: status,
        remainingTurns,
        ...(shortenedByAbilityId ? { shortenedByAbilityId } : {}),
      });
    }

    const statusEvent: BattleEvent = {
      type: BattleEventType.StatusApplied,
      targetId: target.id,
      status,
    };
    events.push(statusEvent);

    if (isMajorStatus(status) && targetAbility?.onAfterStatusReceived) {
      const abilityEvents = targetAbility.onAfterStatusReceived({
        self: target,
        source: context.attacker,
        status,
        state: context.state,
        selfTypes: targetTypes,
        sourceTypes: context.attackerTypes,
        random,
      });
      events.push(...abilityEvents);
    }
  }

  return events;
}

function isVolatileStatus(status: StatusType): boolean {
  return VOLATILE_STATUSES.has(status);
}

function getStatusDuration(
  status: StatusType,
  random: () => number,
  rules: StatusRules = DEFAULT_STATUS_RULES,
): number | null {
  switch (status) {
    case StatusTypeEnum.Asleep: {
      const samples = rules.sleep.sampleTurns;
      const index = Math.floor(random() * samples.length);
      return samples[index] ?? samples[0] ?? 1;
    }
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
