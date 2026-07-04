import { BattleEventType } from "../enums/battle-event-type";
import { EffectKind } from "../enums/effect-kind";
import { FieldGlobalKind } from "../enums/field-global-kind";
import type { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { Effect } from "../types/effect";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { StatusRules } from "../types/status-rules";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { resolveDefensiveAbility } from "./ability-suppression";
import { getTypeEffectiveness } from "./damage-calculator";
import type { EffectContext, SharedEffectState, TypeChart } from "./effect-handler-registry";
import { EffectHandlerRegistry } from "./effect-handler-registry";
import { isInFieldGlobalZone } from "./field-global-system";
import { enumerateZoneTiles } from "./field-terrain-system";
import { handleBurnTargetItem } from "./handlers/handle-burn-target-item";
import { handleCureTeamStatus } from "./handlers/handle-cure-team-status";
import { handleDamage } from "./handlers/handle-damage";
import { handleDefensive } from "./handlers/handle-defensive";
import { handleDisable } from "./handlers/handle-disable";
import { handleDrain } from "./handlers/handle-drain";
import { handleEatTargetBerry } from "./handlers/handle-eat-target-berry";
import { handleEncore } from "./handlers/handle-encore";
import { handleEndeavor } from "./handlers/handle-endeavor";
import { handleFinalGambit } from "./handlers/handle-final-gambit";
import { handleFlingItem } from "./handlers/handle-fling-item";
import { handleHealByTargetStat } from "./handlers/handle-heal-by-target-stat";
import { handleHealSelf } from "./handlers/handle-heal-self";
import { handleHealTarget } from "./handlers/handle-heal-target";
import { handleHelpingHand } from "./handlers/handle-helping-hand";
import { handleKnockback } from "./handlers/handle-knockback";
import { handlePainSplit } from "./handlers/handle-pain-split";
import { handlePerishSong } from "./handlers/handle-perish-song";
import { handlePhaze } from "./handlers/handle-phaze";
import { handlePostAura } from "./handlers/handle-post-aura";
import { handlePostDestinyBond } from "./handlers/handle-post-destiny-bond";
import { handlePostDistortion } from "./handlers/handle-post-distortion";
import { handlePostEntryHazard } from "./handlers/handle-post-entry-hazard";
import { handlePostFieldGlobal } from "./handlers/handle-post-field-global";
import { handlePostFieldTerrain } from "./handlers/handle-post-field-terrain";
import { handlePostFutureSight } from "./handlers/handle-post-future-sight";
import { handlePostGrudge } from "./handlers/handle-post-grudge";
import { handlePostHealOverTime } from "./handlers/handle-post-heal-over-time";
import { handlePostImprison } from "./handlers/handle-post-imprison";
import { handlePostSubstitute } from "./handlers/handle-post-substitute";
import { handlePostWish } from "./handlers/handle-post-wish";
import { handleRecoil } from "./handlers/handle-recoil";
import { handleRecycleItem } from "./handlers/handle-recycle-item";
import { handleRemoveEntryHazards } from "./handlers/handle-remove-entry-hazards";
import { handleRemoveItem } from "./handlers/handle-remove-item";
import { handleReviveOrHeal } from "./handlers/handle-revive-or-heal";
import { handleSetTailwind } from "./handlers/handle-set-tailwind";
import { handleSetWeather } from "./handlers/handle-set-weather";
import { handleSpiteCtTax } from "./handlers/handle-spite-ct-tax";
import { handleStatChange } from "./handlers/handle-stat-change";
import { handleStatus } from "./handlers/handle-status";
import { handleStealItem } from "./handlers/handle-steal-item";
import { handleSwapItems } from "./handlers/handle-swap-items";
import { handleTransferStatStages } from "./handlers/handle-transfer-stat-stages";
import { handleCopyMoveToSlot } from "./handlers/move-copy/handle-copy-move-to-slot";
import { handleCopyStatStages } from "./handlers/stat-manip/handle-copy-stat-stages";
import { handleInvertStatStages } from "./handlers/stat-manip/handle-invert-stat-stages";
import { handleResetStatStages } from "./handlers/stat-manip/handle-reset-stat-stages";
import { handleSwapRawSpeed } from "./handlers/stat-manip/handle-swap-raw-speed";
import { handleSwapStatStages } from "./handlers/stat-manip/handle-swap-stat-stages";
import { handleConvertResistType } from "./handlers/type-change/handle-convert-resist-type";
import { handleConvertSelfType } from "./handlers/type-change/handle-convert-self-type";
import { handleCopyTargetType } from "./handlers/type-change/handle-copy-target-type";
import { handleRemoveType } from "./handlers/type-change/handle-remove-type";
import { handleSoakType } from "./handlers/type-change/handle-soak-type";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";
import { consumeHeldItem } from "./held-item-transfer";
import { isSecondaryEffect } from "./secondary-effect";

interface ProcessContext {
  attacker: PokemonInstance;
  targets: PokemonInstance[];
  move: MoveDefinition;
  state: BattleState;
  typeChart: TypeChart;
  attackerTypes: PokemonType[];
  targetTypesMap: Map<string, PokemonType[]>;
  moveTypeOf: (moveId: string) => PokemonType | undefined;
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
  registry.register(EffectKind.PostDistortion, handlePostDistortion);
  registry.register(EffectKind.PostFieldGlobal, handlePostFieldGlobal);
  registry.register(EffectKind.SetTailwind, handleSetTailwind);
  registry.register(EffectKind.PostEntryHazard, handlePostEntryHazard);
  registry.register(EffectKind.RemoveEntryHazards, handleRemoveEntryHazards);
  registry.register(EffectKind.PostImprison, handlePostImprison);
  registry.register(EffectKind.SpiteCtTax, handleSpiteCtTax);
  registry.register(EffectKind.PostFutureSight, handlePostFutureSight);
  registry.register(EffectKind.PostPerishSong, handlePerishSong);
  registry.register(EffectKind.PainSplit, handlePainSplit);
  registry.register(EffectKind.PhazeToSpawn, handlePhaze);
  registry.register(EffectKind.Endeavor, handleEndeavor);
  registry.register(EffectKind.FinalGambit, handleFinalGambit);
  registry.register(EffectKind.ReviveOrHeal, handleReviveOrHeal);
  registry.register(EffectKind.PostDestinyBond, handlePostDestinyBond);
  registry.register(EffectKind.PostGrudge, handlePostGrudge);
  registry.register(EffectKind.HelpingHand, handleHelpingHand);
  registry.register(EffectKind.RemoveItem, handleRemoveItem);
  registry.register(EffectKind.StealItem, handleStealItem);
  registry.register(EffectKind.SwapItems, handleSwapItems);
  registry.register(EffectKind.FlingItem, handleFlingItem);
  registry.register(EffectKind.EatTargetBerry, handleEatTargetBerry);
  registry.register(EffectKind.BurnTargetItem, handleBurnTargetItem);
  registry.register(EffectKind.RecycleItem, handleRecycleItem);
  registry.register(EffectKind.ConvertSelfType, handleConvertSelfType);
  registry.register(EffectKind.ConvertResistType, handleConvertResistType);
  registry.register(EffectKind.CopyTargetType, handleCopyTargetType);
  registry.register(EffectKind.SoakType, handleSoakType);
  registry.register(EffectKind.RemoveType, handleRemoveType);
  registry.register(EffectKind.CopyMoveToSlot, handleCopyMoveToSlot);
  registry.register(EffectKind.ResetStatStages, handleResetStatStages);
  registry.register(EffectKind.CopyStatStages, handleCopyStatStages);
  registry.register(EffectKind.InvertStatStages, handleInvertStatStages);
  registry.register(EffectKind.SwapStatStages, handleSwapStatStages);
  registry.register(EffectKind.SwapRawSpeed, handleSwapRawSpeed);
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

  // Move-property immunity (Anti-Bruit vs sound, Envelocape vs powder) — applies whatever the move
  // does (damage OR status), so it gates targets before the type-immunity pass below.
  const moveImmuneIds = new Set<string>();
  for (const target of context.targets) {
    const immunityResult = resolveDefensiveAbility(
      context.abilityRegistry,
      target,
      context.attacker,
    )?.onMoveImmunity?.({
      self: target,
      move: context.move,
    });
    if (immunityResult?.blocked) {
      moveImmuneIds.add(target.id);
      events.push(...immunityResult.events);
      continue;
    }
    // Lunettes Filtre (safety-goggles): immune to Poudre moves, same gate as Envelocape.
    const itemImmunity = context.itemRegistry?.getForPokemon(target)?.onMoveImmunity?.({
      self: target,
      move: context.move,
    });
    if (itemImmunity?.blocked) {
      moveImmuneIds.add(target.id);
      events.push(...itemImmunity.events);
    }
  }

  // Move-type immunity (Normal vs Ghost, ability absorbs, …) only excludes targets of a DAMAGING
  // move. Status / heal moves (heal-pulse, wish, aromatherapy) ignore type effectiveness, so a
  // Ghost ally can still receive a Normal-type Wish.
  // Querelleur (scrappy): Normal/Fighting moves ignore Ghost's type immunity (attacker-side).
  const scrappyGhostBypass =
    context.abilityRegistry?.getForPokemon(context.attacker)?.id === "scrappy";

  let nonImmuneTargets: PokemonInstance[];
  if (moveHasDamage) {
    nonImmuneTargets = [];
    for (const target of context.targets) {
      if (moveImmuneIds.has(target.id)) {
        continue;
      }
      const defenderTypes = context.targetTypesMap.get(target.id) ?? [];

      const immunityResult = resolveDefensiveAbility(
        context.abilityRegistry,
        target,
        context.attacker,
      )?.onTypeImmunity?.({
        self: target,
        moveType: context.move.type,
      });
      if (immunityResult?.events) {
        events.push(...immunityResult.events);
      }
      // Ballon (air-balloon): grants Sol immunity while held, same gate as Lévitation.
      const itemImmunity = context.itemRegistry?.getForPokemon(target)?.onTypeImmunity?.({
        self: target,
        moveType: context.move.type,
      });
      if (itemImmunity?.events) {
        events.push(...itemImmunity.events);
      }
      const abilityImmune = (immunityResult?.blocked ?? false) || (itemImmunity?.blocked ?? false);

      // Gravité: a defender standing in a Gravity zone loses its Flying-type immunity to Ground.
      const groundedByGravity = isInFieldGlobalZone(
        context.state,
        target.position,
        FieldGlobalKind.Gravity,
      );
      const effectiveness = abilityImmune
        ? 0
        : getTypeEffectiveness(
            context.move.type,
            defenderTypes,
            context.typeChart,
            undefined,
            scrappyGhostBypass,
            groundedByGravity,
          );

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
    nonImmuneTargets = context.targets.filter((target) => !moveImmuneIds.has(target.id));
  }

  const shared: SharedEffectState = { lastDamageDealt: 0 };

  // Attacker-side abilities that bend secondary effects (mirror scrappy/shield-dust id-checks).
  const attackerAbilityId = context.abilityRegistry?.getForPokemon(context.attacker)?.id;
  const hasSheerForce = attackerAbilityId === "sheer-force";
  const hasSereneGrace = attackerAbilityId === "serene-grace";

  // Sans Limite (sheer-force): suppress every secondary effect, announced once up front. The
  // matching ×1.3 power boost is applied in the damage calculator via onDamageModify.
  if (hasSheerForce && context.move.effects.some((e) => isSecondaryEffect(e, moveHasDamage))) {
    events.push({
      type: BattleEventType.AbilityActivated,
      pokemonId: context.attacker.id,
      abilityId: "sheer-force",
      targetIds: [context.attacker.id],
    });
  }

  const chanceGroupResults = new Map<number, boolean>();
  for (const effect of context.move.effects) {
    if (effect.kind === EffectKind.StatChange && effect.chanceGroup !== undefined) {
      if (hasSheerForce && isSecondaryEffect(effect, moveHasDamage)) {
        continue;
      }
      if (!chanceGroupResults.has(effect.chanceGroup)) {
        let chance = effect.chance ?? 100;
        // Sérénité (serene-grace): double the secondary effect's chance (capped at 100%).
        if (hasSereneGrace && isSecondaryEffect(effect, moveHasDamage)) {
          chance = Math.min(100, chance * 2);
        }
        chanceGroupResults.set(effect.chanceGroup, context.random() * 100 < chance);
      }
    }
  }

  for (const effect of context.move.effects) {
    if (hasSheerForce && isSecondaryEffect(effect, moveHasDamage)) {
      continue;
    }

    let processedEffect =
      hasSereneGrace && isSecondaryEffect(effect, moveHasDamage)
        ? withDoubledSecondaryChance(effect)
        : effect;

    if (
      processedEffect.kind === EffectKind.StatChange &&
      processedEffect.chanceGroup !== undefined
    ) {
      if (!chanceGroupResults.get(processedEffect.chanceGroup)) {
        continue;
      }
      processedEffect = {
        kind: processedEffect.kind,
        stat: processedEffect.stat,
        stages: processedEffect.stages,
        target: processedEffect.target,
      };
    }

    const effectTargets = filterShieldDustTargets(
      processedEffect,
      moveHasDamage,
      nonImmuneTargets,
      context.abilityRegistry,
      context.attacker,
      events,
    );

    const effectContext: EffectContext = {
      ...context,
      targets: effectTargets,
      effect: processedEffect,
      abilityRegistry: context.abilityRegistry,
      itemRegistry: context.itemRegistry,
      shared,
      pokemonInRadius: (center, radius) => pokemonInRadius(context.state, center, radius),
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
        consumeHeldItem(pokemon, { isBerry: itemHandler.isBerry });
      }
    }
  }

  // Flinch-on-hit items (Roche Royale / Croc Rasoir): a damaging move gains a flat flinch chance
  // against surviving targets — but only when the move does not already inflict flinch itself
  // (faithful to King's Rock / Razor Fang, which never stack with a move's own flinch).
  if (moveHasDamage && context.itemRegistry && nonImmuneTargets.length > 0) {
    const attackerItem = context.itemRegistry.getForPokemon(context.attacker);
    if (attackerItem?.onFlinchChance) {
      const moveInflictsFlinch = context.move.effects.some(
        (effect) =>
          effect.kind === EffectKind.Status &&
          (("status" in effect && effect.status === StatusType.Flinch) ||
            ("statuses" in effect && effect.statuses.includes(StatusType.Flinch))),
      );
      if (!moveInflictsFlinch) {
        for (const target of nonImmuneTargets) {
          if (target.currentHp <= 0) {
            continue;
          }
          if (target.volatileStatuses.some((status) => status.type === StatusType.Flinch)) {
            continue;
          }
          const chance = attackerItem.onFlinchChance({
            self: context.attacker,
            target,
            move: context.move,
          });
          if (context.random() * 100 >= chance) {
            continue;
          }
          target.volatileStatuses.push({ type: StatusType.Flinch, remainingTurns: 1 });
          events.push({
            type: BattleEventType.StatusApplied,
            targetId: target.id,
            status: StatusType.Flinch,
          });
        }
      }
    }
  }

  // After-move-use items (Spray Gorge): fired once per move use, whatever the move does (damage or
  // status) — so it lives outside the damage-gated flinch block above. The handler self-filters on
  // the move flag (e.g. Son) and is consumed on activation.
  if (context.itemRegistry && context.attacker.currentHp > 0) {
    const attackerItem = context.itemRegistry.getForPokemon(context.attacker);
    if (attackerItem?.onAfterMoveUse) {
      const result = attackerItem.onAfterMoveUse({
        self: context.attacker,
        move: context.move,
      });
      events.push(...result.events);
      if (result.consumeItem) {
        consumeHeldItem(context.attacker, { isBerry: attackerItem.isBerry });
      }
    }
  }

  return events;
}

/** Living mons standing inside the Manhattan diamond of `radius` centred on `center` (team-agnostic). */
function pokemonInRadius(state: BattleState, center: Position, radius: number): PokemonInstance[] {
  const tileKeys = new Set(
    enumerateZoneTiles(state, center, radius).map((tile) => `${tile.x},${tile.y}`),
  );
  const result: PokemonInstance[] = [];
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.currentHp <= 0) {
      continue;
    }
    if (tileKeys.has(`${pokemon.position.x},${pokemon.position.y}`)) {
      result.push(pokemon);
    }
  }
  return result;
}

/** Sérénité (serene-grace): return a copy of a secondary effect with its chance doubled (cap 100%). */
function withDoubledSecondaryChance(effect: Effect): Effect {
  if (effect.kind === EffectKind.Status) {
    return { ...effect, chance: Math.min(100, effect.chance * 2) };
  }
  if (effect.kind === EffectKind.StatChange) {
    return { ...effect, chance: Math.min(100, (effect.chance ?? 100) * 2) };
  }
  return effect;
}

function filterShieldDustTargets(
  effect: Effect,
  moveHasDamage: boolean,
  targets: PokemonInstance[],
  abilityRegistry: AbilityHandlerRegistry | undefined,
  attacker: PokemonInstance,
  events: BattleEvent[],
): PokemonInstance[] {
  if (!abilityRegistry || !isSecondaryEffect(effect, moveHasDamage)) {
    return targets;
  }
  const filtered: PokemonInstance[] = [];
  for (const target of targets) {
    // Brise Moule ignores Écran Poudre (shield-dust is breakable) → secondaries still land.
    const ability = resolveDefensiveAbility(abilityRegistry, target, attacker);
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
