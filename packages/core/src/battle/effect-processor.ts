import { BattleEventType } from "../enums/battle-event-type";
import { EffectKind } from "../enums/effect-kind";
import type { PokemonType } from "../enums/pokemon-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { StatusRules } from "../types/status-rules";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { getTypeEffectiveness } from "./damage-calculator";
import type { EffectContext, SharedEffectState, TypeChart } from "./effect-handler-registry";
import { EffectHandlerRegistry } from "./effect-handler-registry";
import { handleDamage } from "./handlers/handle-damage";
import { handleDefensive } from "./handlers/handle-defensive";
import { handleHealSelf } from "./handlers/handle-heal-self";
import { handleKnockback } from "./handlers/handle-knockback";
import { handleRecoil } from "./handlers/handle-recoil";
import { handleStatChange } from "./handlers/handle-stat-change";
import { handleStatus } from "./handlers/handle-status";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";

interface ProcessContext {
  attacker: PokemonInstance;
  targets: PokemonInstance[];
  move: MoveDefinition;
  state: BattleState;
  typeChart: TypeChart;
  attackerTypes: PokemonType[];
  targetTypesMap: Map<string, PokemonType[]>;
  targetPosition: Position;
  random: RandomFn;
  heightModifier: number;
  terrainModifier: number;
  facingModifierMap: Map<string, number>;
  statusRules?: StatusRules;
  abilityRegistry?: AbilityHandlerRegistry;
  itemRegistry?: HeldItemHandlerRegistry;
}

export function createDefaultEffectRegistry(): EffectHandlerRegistry {
  const registry = new EffectHandlerRegistry();
  registry.register(EffectKind.Damage, handleDamage);
  registry.register(EffectKind.Status, handleStatus);
  registry.register(EffectKind.StatChange, handleStatChange);
  registry.register(EffectKind.Defensive, handleDefensive);
  registry.register(EffectKind.Knockback, handleKnockback);
  registry.register(EffectKind.HealSelf, handleHealSelf);
  registry.register(EffectKind.Recoil, handleRecoil);
  return registry;
}

export function processEffects(
  context: ProcessContext,
  registry?: EffectHandlerRegistry,
): BattleEvent[] {
  const effectRegistry = registry ?? createDefaultEffectRegistry();
  const events: BattleEvent[] = [];

  const nonImmuneTargets: PokemonInstance[] = [];
  for (const target of context.targets) {
    const defenderTypes = context.targetTypesMap.get(target.id) ?? [];

    const immunityResult = context.abilityRegistry?.getForPokemon(target)?.onTypeImmunity?.({
      self: target,
      moveType: context.move.type,
    });
    const abilityImmune = immunityResult?.blocked ?? false;
    if (immunityResult?.events) {
      events.push(...immunityResult.events);
    }

    const effectiveness = abilityImmune
      ? 0
      : getTypeEffectiveness(context.move.type, defenderTypes, context.typeChart);

    if (effectiveness === 0) {
      events.push({
        type: BattleEventType.DamageDealt,
        targetId: target.id,
        amount: 0,
        effectiveness: 0,
      });
    } else {
      nonImmuneTargets.push(target);
    }
  }

  const shared: SharedEffectState = { lastDamageDealt: 0 };

  const chanceGroupResults = new Map<number, boolean>();
  for (const effect of context.move.effects) {
    if (effect.kind === EffectKind.StatChange && effect.chanceGroup !== undefined) {
      if (!chanceGroupResults.has(effect.chanceGroup)) {
        const chance = effect.chance ?? 100;
        chanceGroupResults.set(effect.chanceGroup, context.random() * 100 < chance);
      }
    }
  }

  for (const effect of context.move.effects) {
    let processedEffect = effect;

    if (effect.kind === EffectKind.StatChange && effect.chanceGroup !== undefined) {
      if (!chanceGroupResults.get(effect.chanceGroup)) {
        continue;
      }
      processedEffect = {
        kind: effect.kind,
        stat: effect.stat,
        stages: effect.stages,
        target: effect.target,
      };
    }

    const effectContext: EffectContext = {
      ...context,
      targets: nonImmuneTargets,
      effect: processedEffect,
      abilityRegistry: context.abilityRegistry,
      itemRegistry: context.itemRegistry,
      shared,
    };
    events.push(...effectRegistry.process(effectContext));
  }

  return events;
}
