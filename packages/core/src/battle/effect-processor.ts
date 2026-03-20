import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import type { PokemonType } from "../enums/pokemon-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { Effect } from "../types/effect";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { calculateDamage } from "./damage-calculator";
import { clampStages, isMajorStatus } from "./stat-modifier";

type TypeChart = Record<PokemonType, Record<PokemonType, number>>;

interface ProcessContext {
  attacker: PokemonInstance;
  targets: PokemonInstance[];
  move: MoveDefinition;
  state: BattleState;
  typeChart: TypeChart;
  attackerTypes: PokemonType[];
  targetTypesMap: Map<string, PokemonType[]>;
}

export function processEffects(context: ProcessContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const effect of context.move.effects) {
    switch (effect.kind) {
      case EffectKind.Damage:
        events.push(...processDamage(context));
        break;
      case EffectKind.Status:
        events.push(...processStatus(context.targets, effect));
        break;
      case EffectKind.StatChange:
        events.push(...processStatChange(context.attacker, context.targets, effect));
        break;
      case EffectKind.Link:
        events.push(...processLink(context.attacker, context.targets, effect, context.state));
        break;
    }
  }
  return events;
}

function processDamage(context: ProcessContext): BattleEvent[] {
  const events: BattleEvent[] = [];

  if (context.move.category === Category.Status) {
    return events;
  }

  for (const target of context.targets) {
    const defenderTypes = context.targetTypesMap.get(target.id) ?? [];
    const damage = calculateDamage(
      context.attacker,
      target,
      context.move,
      context.typeChart,
      context.attackerTypes,
      defenderTypes,
    );

    const effectiveness = getEffectivenessForEvent(context.move.type, defenderTypes, context.typeChart);

    target.currentHp = Math.max(0, target.currentHp - damage);

    const damageEvent: BattleEvent = {
      type: BattleEventType.DamageDealt,
      targetId: target.id,
      amount: damage,
      effectiveness,
    };
    events.push(damageEvent);

    if (target.currentHp <= 0) {
      const koEvent: BattleEvent = {
        type: BattleEventType.PokemonKo,
        pokemonId: target.id,
        countdownStart: 0,
      };
      events.push(koEvent);
    }
  }

  return events;
}

function processStatus(
  targets: PokemonInstance[],
  effect: Extract<Effect, { kind: typeof EffectKind.Status }>,
): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const target of targets) {
    if (Math.random() * 100 >= effect.chance) {
      continue;
    }

    const targetHasMajor = target.statusEffects.some((s) => isMajorStatus(s.type));
    if (targetHasMajor && isMajorStatus(effect.status)) {
      continue;
    }

    const remainingTurns = getStatusDuration(effect.status);

    target.statusEffects.push({ type: effect.status, remainingTurns });

    const statusEvent: BattleEvent = {
      type: BattleEventType.StatusApplied,
      targetId: target.id,
      status: effect.status,
    };
    events.push(statusEvent);
  }

  return events;
}

function processStatChange(
  attacker: PokemonInstance,
  targets: PokemonInstance[],
  effect: Extract<Effect, { kind: typeof EffectKind.StatChange }>,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const affectedPokemon = effect.target === EffectTarget.Self ? [attacker] : targets;

  for (const pokemon of affectedPokemon) {
    const currentStage = pokemon.statStages[effect.stat];
    const newStage = clampStages(currentStage, effect.stages);
    const actualChange = newStage - currentStage;

    if (actualChange === 0) {
      continue;
    }

    pokemon.statStages[effect.stat] = newStage;

    const statEvent: BattleEvent = {
      type: BattleEventType.StatChanged,
      targetId: pokemon.id,
      stat: effect.stat,
      stages: actualChange,
    };
    events.push(statEvent);
  }

  return events;
}

function processLink(
  attacker: PokemonInstance,
  targets: PokemonInstance[],
  effect: Extract<Effect, { kind: typeof EffectKind.Link }>,
  state: BattleState,
): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const target of targets) {
    state.activeLinks.push({
      sourceId: attacker.id,
      targetId: target.id,
      linkType: effect.linkType,
      remainingTurns: effect.duration,
      maxRange: effect.maxRange,
      drainFraction: effect.drainFraction,
    });

    const linkEvent: BattleEvent = {
      type: BattleEventType.LinkCreated,
      sourceId: attacker.id,
      targetId: target.id,
      linkType: effect.linkType,
    };
    events.push(linkEvent);
  }

  return events;
}

function getStatusDuration(status: string): number | null {
  switch (status) {
    case "asleep":
      return Math.floor(Math.random() * 3) + 1;
    case "confused":
      return Math.floor(Math.random() * 4) + 1;
    default:
      return null;
  }
}

function getEffectivenessForEvent(
  moveType: PokemonType,
  defenderTypes: PokemonType[],
  typeChart: TypeChart,
): number {
  let multiplier = 1;
  const attackerRow = typeChart[moveType];
  if (!attackerRow) {
    return 1;
  }
  for (const defType of defenderTypes) {
    const value = attackerRow[defType];
    if (value !== undefined) {
      multiplier *= value;
    }
  }
  return multiplier;
}
