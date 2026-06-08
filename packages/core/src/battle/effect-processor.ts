import { BattleEventType } from "../enums/battle-event-type";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import type { PokemonType } from "../enums/pokemon-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { Effect } from "../types/effect";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { StatusRules } from "../types/status-rules";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { getTypeEffectiveness } from "./damage-calculator";
import type { EffectContext, SharedEffectState, TypeChart } from "./effect-handler-registry";
import { EffectHandlerRegistry } from "./effect-handler-registry";
import { handleCureTeamStatus } from "./handlers/handle-cure-team-status";
import { handleDamage } from "./handlers/handle-damage";
import { handleDefensive } from "./handlers/handle-defensive";
import { handleDisable } from "./handlers/handle-disable";
import { handleDrain } from "./handlers/handle-drain";
import { handleEncore } from "./handlers/handle-encore";
import { handleHealByTargetStat } from "./handlers/handle-heal-by-target-stat";
import { handleHealSelf } from "./handlers/handle-heal-self";
import { handleHealTarget } from "./handlers/handle-heal-target";
import { handleKnockback } from "./handlers/handle-knockback";
import { handlePostAura } from "./handlers/handle-post-aura";
import { handlePostFieldTerrain } from "./handlers/handle-post-field-terrain";
import { handlePostHealOverTime } from "./handlers/handle-post-heal-over-time";
import { handlePostSubstitute } from "./handlers/handle-post-substitute";
import { handlePostWish } from "./handlers/handle-post-wish";
import { handleRecoil } from "./handlers/handle-recoil";
import { handleSetWeather } from "./handlers/handle-set-weather";
import { handleStatChange } from "./handlers/handle-stat-change";
import { handleStatus } from "./handlers/handle-status";
import { handleTransferStatStages } from "./handlers/handle-transfer-stat-stages";
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
  registry.register(EffectKind.Drain, handleDrain);
  registry.register(EffectKind.SetWeather, handleSetWeather);
  registry.register(EffectKind.TransferStatStages, handleTransferStatStages);
  registry.register(EffectKind.PostAura, handlePostAura);
  registry.register(EffectKind.PostSubstitute, handlePostSubstitute);
  registry.register(EffectKind.Disable, handleDisable);
  registry.register(EffectKind.Encore, handleEncore);
  registry.register(EffectKind.HealTarget, handleHealTarget);
  registry.register(EffectKind.CureTeamStatus, handleCureTeamStatus);
  registry.register(EffectKind.HealByTargetStat, handleHealByTargetStat);
  registry.register(EffectKind.PostHealOverTime, handlePostHealOverTime);
  registry.register(EffectKind.PostWish, handlePostWish);
  registry.register(EffectKind.PostFieldTerrain, handlePostFieldTerrain);
  return registry;
}

export function processEffects(
  context: ProcessContext,
  registry?: EffectHandlerRegistry,
): BattleEvent[] {
  const effectRegistry = registry ?? createDefaultEffectRegistry();
  const events: BattleEvent[] = [];

  const moveHasDamage = context.move.effects.some(
    (e) => e.kind === EffectKind.Damage || e.kind === EffectKind.Drain,
  );

  // Move-type immunity (Normal vs Ghost, ability absorbs, …) only excludes targets of a DAMAGING
  // move. Status / heal moves (heal-pulse, wish, aromatherapy) ignore type effectiveness, so a
  // Ghost ally can still receive a Normal-type Wish.
  let nonImmuneTargets: PokemonInstance[];
  if (moveHasDamage) {
    nonImmuneTargets = [];
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
  } else {
    nonImmuneTargets = [...context.targets];
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

    const effectTargets = filterShieldDustTargets(
      processedEffect,
      moveHasDamage,
      nonImmuneTargets,
      context.abilityRegistry,
      events,
    );

    const effectContext: EffectContext = {
      ...context,
      targets: effectTargets,
      effect: processedEffect,
      abilityRegistry: context.abilityRegistry,
      itemRegistry: context.itemRegistry,
      shared,
    };
    events.push(...effectRegistry.process(effectContext));
  }

  if (shared.loweredPokemonIds && context.itemRegistry) {
    for (const pokemonId of shared.loweredPokemonIds) {
      const pokemon = context.state.pokemon.get(pokemonId);
      if (!pokemon || pokemon.currentHp <= 0) {
        continue;
      }
      const itemHandler = context.itemRegistry.getForPokemon(pokemon);
      if (!itemHandler?.onStatLowered) {
        continue;
      }
      let chosenStat: keyof typeof pokemon.statStages | undefined;
      let chosenStages = 0;
      for (const [statName, stageValue] of Object.entries(pokemon.statStages) as [
        keyof typeof pokemon.statStages,
        number,
      ][]) {
        if (stageValue < chosenStages) {
          chosenStat = statName;
          chosenStages = stageValue;
        }
      }
      if (chosenStat === undefined) {
        continue;
      }
      const result = itemHandler.onStatLowered({
        pokemon,
        stat: chosenStat,
        stages: chosenStages,
      });
      events.push(...result.events);
      if (result.consumeItem) {
        pokemon.heldItemId = undefined;
      }
    }
  }

  return events;
}

function isSecondaryEffect(effect: Effect, moveHasDamage: boolean): boolean {
  if (!moveHasDamage) {
    return false;
  }
  if (effect.kind === EffectKind.Status) {
    if ("target" in effect && effect.target === EffectTarget.Self) {
      return false;
    }
    return effect.chance < 100;
  }
  if (effect.kind === EffectKind.StatChange) {
    if (effect.target === EffectTarget.Self) {
      return false;
    }
    return (effect.chance ?? 100) < 100;
  }
  return false;
}

function filterShieldDustTargets(
  effect: Effect,
  moveHasDamage: boolean,
  targets: PokemonInstance[],
  abilityRegistry: AbilityHandlerRegistry | undefined,
  events: BattleEvent[],
): PokemonInstance[] {
  if (!abilityRegistry || !isSecondaryEffect(effect, moveHasDamage)) {
    return targets;
  }
  const filtered: PokemonInstance[] = [];
  for (const target of targets) {
    const ability = abilityRegistry.getForPokemon(target);
    if (ability?.id === "shield-dust") {
      events.push({
        type: BattleEventType.AbilityActivated,
        pokemonId: target.id,
        abilityId: "shield-dust",
        targetIds: [target.id],
      });
      continue;
    }
    filtered.push(target);
  }
  return filtered;
}
