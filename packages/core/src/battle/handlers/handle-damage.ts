import { BattleEventType } from "../../enums/battle-event-type";
import { Category } from "../../enums/category";
import type { EffectKind } from "../../enums/effect-kind";
import { FieldGlobalKind } from "../../enums/field-global-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatName } from "../../enums/stat-name";
import { StatusType } from "../../enums/status-type";
import { Weather } from "../../enums/weather";
import { Grid } from "../../grid/Grid";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { MoveDefinition } from "../../types/move-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { RandomFn } from "../../utils/prng";
import { resolveDefensiveAbility } from "../ability-suppression";
import {
  computeBrickBreakInteraction,
  computeScreenMultiplier,
  removeAurasOfCaster,
} from "../aura-system";
import { areBerriesSuppressed } from "../berry-suppression";
import { applyChargeReaction } from "../charge-reaction";
import { effectConditionHolds } from "../condition-eval";
import {
  calculateDamageWithCrit,
  type FieldGlobalDamageContext,
  getTypeEffectiveness,
} from "../damage-calculator";
import { checkDefense } from "../defense-check";
import { resolveDynamicPower } from "../dynamic-power-system";
import type { EffectContext } from "../effect-handler-registry";
import { effectiveHeldItem } from "../effective-held-item";
import {
  isEffectivelyGrounded,
  isHeldItemSuppressed,
  isInFieldGlobalZone,
} from "../field-global-system";
import {
  getFieldTerrainBpMultiplier,
  getFieldTerrainDamageMultiplier,
  getFieldTerrainMovePowerMultiplier,
  resolveFieldTerrainPulseMove,
} from "../field-terrain-system";
import { ejectToSpawn } from "../forced-teleport";
import { friendGuardMultiplier } from "../friend-guard-system";
import { consumeHeldItem } from "../held-item-transfer";
import { isMajorStatus } from "../stat-modifier";
import { applySubstituteAbsorption, shouldSubstituteBlock } from "../substitute-system";
import {
  effectiveWeather,
  getWeatherBallBp,
  getWeatherBallType,
  getWeatherBpModifier,
  getWeatherDefenseStatBoost,
} from "../weather-system";
import { HELPING_HAND_MULTIPLIER } from "./handle-helping-hand";

function resolveWeatherBallMove(move: MoveDefinition, activeWeather: Weather): MoveDefinition {
  if (!move.weatherBoostedType) {
    return move;
  }
  return {
    ...move,
    type: getWeatherBallType(activeWeather),
    power: getWeatherBallBp(activeWeather, move.power),
  };
}

const MULTI_HIT_PROBABILITIES: number[] = [0.35, 0.35, 0.15, 0.15];

function rollMultiHitCount(min: number, max: number, random: RandomFn): number {
  const roll = random();
  let cumulative = 0;
  for (let i = 0; i < MULTI_HIT_PROBABILITIES.length; i++) {
    cumulative += MULTI_HIT_PROBABILITIES[i] ?? 0;
    if (roll < cumulative) {
      return min + i;
    }
  }
  return max;
}

function getHitCount(
  effect: Extract<Effect, { kind: typeof EffectKind.Damage }>,
  random: RandomFn,
  skillLink: boolean,
): number {
  if (effect.escalatingHitPower !== undefined) {
    return effect.escalatingHitPower.length;
  }
  if (effect.hits === undefined) {
    return 1;
  }
  if (typeof effect.hits === "number") {
    return effect.hits;
  }
  // Multi-Coups (skill-link): variable-hit moves always land the maximum number of hits.
  if (skillLink) {
    return effect.hits.max;
  }
  return rollMultiHitCount(effect.hits.min, effect.hits.max, random);
}

/**
 * Beat Up (B3): one hit per healthy team member, power = 5 + floor(ally base Attack / 10).
 * The user always participates; other allies are skipped if fainted or holding a major status
 * (parity with Showdown's `pokemon.side.pokemon.filter(...)`).
 */
function computeBeatUpPowers(context: EffectContext): number[] {
  const powers: number[] = [];
  for (const mon of context.state.pokemon.values()) {
    if (mon.playerId !== context.attacker.playerId) {
      continue;
    }
    const isSelf = mon.id === context.attacker.id;
    if (!isSelf) {
      if (mon.currentHp <= 0) {
        continue;
      }
      if (mon.statusEffects.some((s) => isMajorStatus(s.type))) {
        continue;
      }
    }
    powers.push(5 + Math.floor(mon.baseStats.attack / 10));
  }
  return powers;
}

function dealSingleHit(
  context: EffectContext,
  target: PokemonInstance,
  defenderTypes: PokemonType[],
  moveDamageAccumulator: { total: number },
  hitPowerOverride?: number,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const facingMod = context.facingModifierMap.get(target.id) ?? 1.0;
  const activeWeather = effectiveWeather(context.state, (pokemon) => {
    if (pokemon.currentHp <= 0) {
      return false;
    }
    const handler = context.abilityRegistry?.getForPokemon(pokemon);
    return handler?.suppressesWeatherEffects === true;
  });
  let resolvedMove = resolveDynamicPower(
    resolveFieldTerrainPulseMove(
      context.state,
      context.attacker,
      context.attackerTypes,
      resolveWeatherBallMove(context.move, activeWeather),
    ),
    context.attacker,
    target,
    context.state,
    context.itemRegistry,
  );
  if (hitPowerOverride !== undefined) {
    resolvedMove = { ...resolvedMove, power: hitPowerOverride };
  }
  // Charge (B3): the user's next Electric move is doubled while the Charged volatile is held.
  if (
    resolvedMove.type === PokemonType.Electric &&
    context.attacker.volatileStatuses.some((v) => v.type === StatusType.Charged)
  ) {
    resolvedMove = { ...resolvedMove, power: resolvedMove.power * 2 };
  }
  let weatherBp = getWeatherBpModifier(resolvedMove.type, activeWeather);
  if (
    resolvedMove.id === "solar-beam" &&
    (activeWeather === Weather.Rain ||
      activeWeather === Weather.Sandstorm ||
      activeWeather === Weather.Snow)
  ) {
    weatherBp *= 0.5;
  }
  const usesPhysicalDefense =
    resolvedMove.category === Category.Physical || resolvedMove.hitsPhysicalDefense === true;
  const defenseStat = usesPhysicalDefense ? StatName.Defense : StatName.SpDefense;
  const defenseWeather = getWeatherDefenseStatBoost(defenderTypes, defenseStat, activeWeather);
  const brickBreakInteraction = computeBrickBreakInteraction(context.state, target, resolvedMove);
  const screenMultiplier = brickBreakInteraction.breakAuraCasterId
    ? 1.0
    : computeScreenMultiplier(context.state, context.attacker, target, resolvedMove);
  const fieldTerrainBp =
    getFieldTerrainBpMultiplier(
      context.state,
      context.attacker,
      context.attackerTypes,
      resolvedMove,
    ) *
    getFieldTerrainMovePowerMultiplier(
      context.state,
      context.attacker,
      context.attackerTypes,
      target,
      defenderTypes,
      resolvedMove,
    );
  const fieldTerrainDamage = getFieldTerrainDamageMultiplier(
    context.state,
    target,
    defenderTypes,
    resolvedMove,
  );
  // Analyste (analytic): the holder acts after the target when the target's last action is more
  // recent than the holder's — the exact inverse of fishious-rend's "target idle" condition.
  const targetAlreadyActed =
    (target.lastActedAtAction ?? -1) > (context.attacker.lastActedAtAction ?? -1);

  // Field-global per-hit modifiers (caller holds BattleState): Gravité grounding (Ground hits a
  // Flying defender), Zone Étrange (swap defender Def↔Sp.Def), Zone Magique (suppress item effects).
  const fieldGlobalContext: FieldGlobalDamageContext = {
    // `defenderGroundedByGravity` now means "effectively grounded": Gravité zone OR Anti-Air (smack-down).
    defenderGroundedByGravity: isEffectivelyGrounded(context.state, target),
    defenderDefensesSwapped: isInFieldGlobalZone(
      context.state,
      target.position,
      FieldGlobalKind.WonderRoom,
    ),
    attackerItemSuppressed: isHeldItemSuppressed(context.state, context.attacker),
    defenderItemSuppressed: isHeldItemSuppressed(context.state, target),
  };

  const { damage: baseDamage, isCrit } = calculateDamageWithCrit(
    context.attacker,
    target,
    resolvedMove,
    context.typeChart,
    context.attackerTypes,
    defenderTypes,
    undefined,
    context.random,
    context.heightModifier,
    context.terrainModifier,
    facingMod,
    context.abilityRegistry,
    context.itemRegistry,
    weatherBp,
    defenseWeather,
    screenMultiplier,
    brickBreakInteraction.multiplier,
    fieldTerrainBp,
    fieldTerrainDamage,
    activeWeather,
    targetAlreadyActed,
    fieldGlobalContext,
  );

  // Coup d'Main (helping-hand): the ally's offensive move is boosted while the flag is set. Applied
  // to every hit; the flag is consumed at the end of the buffed mon's turn (engine), not here.
  let damage = baseDamage;
  if (context.attacker.helpingHand === true && resolvedMove.power > 0) {
    damage = Math.floor(damage * HELPING_HAND_MULTIPLIER);
  }

  // Garde Amie (friend-guard): a living ally of the target within Manhattan r2 cuts incoming damage
  // to ×0.75. Applied here (not in the damage calc, which lacks `state`); multiplicative with screens.
  const friendGuard = friendGuardMultiplier(context.state, target);
  if (friendGuard !== 1 && damage > 0) {
    damage = Math.max(1, Math.floor(damage * friendGuard));
  }

  // Querelleur (scrappy): Normal/Fighting moves treat Ghost as neutral, so the reported
  // effectiveness must match the damage calc (otherwise the hit shows "no effect" yet deals damage).
  const scrappyGhostBypass =
    context.abilityRegistry?.getForPokemon(context.attacker)?.id === "scrappy";

  // OHKO family (K.O. en un coup): damage is fixed to the target's max HP, ignoring Helping Hand /
  // Garde Amie / the damage formula. Type/Ice/Fermeté immunities are pre-filtered engine-side, so this
  // path is only reached for a non-immune target; the `=== 0 ? 0` is a defensive failsafe. Everything
  // downstream (Protection/Ténacité via checkDefense, Baie Ceinture, Clone) applies as usual.
  if (context.move.isOhko) {
    const ohkoEffectiveness = getTypeEffectiveness(
      context.move.type,
      defenderTypes,
      context.typeChart,
      context.move.typeEffectivenessOverride,
      scrappyGhostBypass,
      fieldGlobalContext.defenderGroundedByGravity === true,
    );
    damage = ohkoEffectiveness === 0 ? 0 : target.maxHp;
  }

  const defenseResult = checkDefense(
    context.attacker,
    target,
    context.move,
    damage,
    context.targetPosition,
  );
  events.push(...defenseResult.events);

  if (defenseResult.consumeDefense) {
    target.activeDefense = null;
  }

  if (defenseResult.blocked) {
    return events;
  }

  let actualDamage = damage;
  if (defenseResult.endureAtOne) {
    actualDamage = target.currentHp - 1;
  }

  const wasAtMaxHp = target.currentHp === target.maxHp;

  // Brise Moule ignores the target's breakable abilities (Fermeté survival + breakable reactive
  // visuals like Isograisse). Non-breakable reactives (Statik, Corps Ardent) still resolve.
  const targetAbility = resolveDefensiveAbility(context.abilityRegistry, target, context.attacker);
  let sturdyTriggered = false;
  if (
    targetAbility?.id === "sturdy" &&
    wasAtMaxHp &&
    !defenseResult.endureAtOne &&
    actualDamage >= target.currentHp
  ) {
    actualDamage = target.currentHp - 1;
    sturdyTriggered = true;
  }

  // Zone Magique (magic-room): a holder inside the zone has its item inert — no FocusSash survival,
  // no type-reaction / berry / eject triggers, no Life Orb recoil, no contact-effect protection.
  const targetItem = fieldGlobalContext.defenderItemSuppressed
    ? undefined
    : context.itemRegistry?.getForPokemon(target);
  const isSuperEffective =
    getTypeEffectiveness(
      context.move.type,
      defenderTypes,
      context.typeChart,
      context.move.typeEffectivenessOverride,
      scrappyGhostBypass,
      fieldGlobalContext.defenderGroundedByGravity === true,
    ) > 1;
  const isContact = context.move.flags?.contact === true;
  // Pare-Effet (protective-pads) / Gant de Boxe (punching-glove): the holder's contact moves ignore
  // the target's contact-triggered reactions (Casque Brut recoil, Statik, Peau Dure, Boom Final…).
  // Pare-Effet covers every contact move; Gant de Boxe only its Poing moves. The move still counts as
  // contact for the attacker's own effects (Poing de Fer, Toxitouche) — only the target's reactions are muted.
  const attackerHeldItem = fieldGlobalContext.attackerItemSuppressed
    ? undefined
    : context.itemRegistry?.getForPokemon(context.attacker);
  const contactNullified =
    isContact &&
    (attackerHeldItem?.protectsFromContactEffects === true ||
      attackerHeldItem?.nullifiesContactForMove?.(context.move) === true);

  let focusSashTriggered = false;
  if (
    targetItem?.id === HeldItemId.FocusSash &&
    wasAtMaxHp &&
    !defenseResult.endureAtOne &&
    !sturdyTriggered &&
    actualDamage >= target.currentHp
  ) {
    actualDamage = target.currentHp - 1;
    focusSashTriggered = true;
  }

  const effectiveness = getTypeEffectiveness(
    context.move.type,
    defenderTypes,
    context.typeChart,
    context.move.typeEffectivenessOverride,
    scrappyGhostBypass,
    fieldGlobalContext.defenderGroundedByGravity === true,
  );

  if (isCrit) {
    events.push({ type: BattleEventType.CriticalHit, targetId: target.id });
  }

  const subBlocks = shouldSubstituteBlock(context.attacker, target, context.move);
  if (subBlocks) {
    const { absorbed, broken } = applySubstituteAbsorption(target, actualDamage);
    context.shared.lastDamageDealt += absorbed;

    events.push({
      type: BattleEventType.DamageDealt,
      targetId: target.id,
      amount: absorbed,
      effectiveness,
      absorbedBySubstitute: absorbed,
    });

    if (absorbed > 0) {
      events.push({
        type: BattleEventType.SubstituteDamaged,
        pokemonId: target.id,
        damage: absorbed,
        remaining: target.substituteHp ?? 0,
      });
    }

    if (broken) {
      events.push({
        type: BattleEventType.SubstituteBroken,
        pokemonId: target.id,
        breakerId: context.attacker.id,
        breakerMoveId: context.move.id,
      });
    }

    return events;
  }

  // Faux-Chage (false-swipe): the damage can never KO — cap it so the target keeps ≥1 HP. Placed
  // after Endure/Sturdy/Focus-Sash survivals (they may already have lowered the damage) and after
  // the Substitute early-return above (the clone still breaks normally).
  if (context.move.cannotKo === true && target.currentHp > 0 && actualDamage >= target.currentHp) {
    actualDamage = target.currentHp - 1;
  }

  // Bandeau (focus-band): unlike Focus Sash / Solidité (max HP only, guaranteed), it grants a
  // probabilistic survival at 1 HP from ANY HP. Not consumed → can trigger again later.
  let focusBandTriggered = false;
  const focusBandChance = targetItem?.survivesLethalHitChance;
  if (
    focusBandChance !== undefined &&
    !defenseResult.endureAtOne &&
    !sturdyTriggered &&
    !focusSashTriggered &&
    target.currentHp > 0 &&
    actualDamage >= target.currentHp &&
    context.random() < focusBandChance
  ) {
    actualDamage = target.currentHp - 1;
    focusBandTriggered = true;
  }

  target.currentHp = Math.max(0, target.currentHp - actualDamage);
  context.shared.lastDamageDealt += actualDamage;

  if (actualDamage > 0) {
    // Action-clock stamps (B3): record that the target took damage this action so
    // Assurance / Avalanche / Revenge / Rage Fist can read it on later turns.
    const clock = context.state.actionCounter ?? 0;
    target.lastDamagedAtAction = clock;
    target.timesHit = (target.timesHit ?? 0) + 1;
    if (context.attacker.id !== target.id && context.attacker.playerId !== target.playerId) {
      target.lastDamagedByEnemyAtAction = clock;
    }
    // Killing-blow attribution (plan 147): stamp who/what dealt this hit so `handleKo` can resolve
    // Lien du Destin (KO the killer) and Rancune (lock the killing move). Self-recoil never counts.
    if (context.attacker.id !== target.id) {
      target.lastHitBy = { attackerId: context.attacker.id, moveId: context.move.id };
    }
    // Reactive-charge family (plan 150): a charging Mitra-Poing / Bec-Canon / Carapiège that is
    // struck during its wait window reacts here (interrupt focus / burn contact attacker / arm the
    // trap). Self-recoil never triggers it. Runs after the hit lands, before any KO resolution.
    if (context.attacker.id !== target.id && target.chargingMove?.reaction !== undefined) {
      for (const event of applyChargeReaction({
        victim: target,
        attacker: context.attacker,
        attackerMove: context.move,
        attackerTypes: context.attackerTypes,
      })) {
        events.push(event);
      }
    }
  }

  events.push({
    type: BattleEventType.DamageDealt,
    targetId: target.id,
    amount: actualDamage,
    effectiveness,
    ...(context.move.isOhko === true ? { ohko: true } : {}),
  });

  // OHKO family: a connecting one-hit-KO that reduced the target to 0 HP emits a dedicated event so the
  // log reads "C'est un K.O. direct !" before the KO animation. A survival (Baie Ceinture / Ténacité)
  // leaves currentHp > 0 → no OneHitKo (the normal survival messages apply instead).
  if (context.move.isOhko && target.currentHp <= 0) {
    events.push({ type: BattleEventType.OneHitKo, targetId: target.id });
  }

  if (brickBreakInteraction.breakAuraCasterId) {
    const brokenAuras = removeAurasOfCaster(context.state, brickBreakInteraction.breakAuraCasterId);
    for (const brokenAura of brokenAuras) {
      events.push({
        type: BattleEventType.AuraBroken,
        casterId: brickBreakInteraction.breakAuraCasterId,
        kind: brokenAura.kind,
        breakerId: context.attacker.id,
        breakerMoveId: context.move.id,
      });
    }
  }

  if (sturdyTriggered) {
    events.push({
      type: BattleEventType.AbilityActivated,
      pokemonId: target.id,
      abilityId: "sturdy",
      targetIds: [target.id],
    });
  }

  if (focusSashTriggered) {
    events.push({
      type: BattleEventType.HeldItemActivated,
      pokemonId: target.id,
      itemId: HeldItemId.FocusSash,
      targetIds: [target.id],
    });
    events.push({
      type: BattleEventType.HeldItemConsumed,
      pokemonId: target.id,
      itemId: HeldItemId.FocusSash,
    });
    consumeHeldItem(target);
  }

  if (focusBandTriggered) {
    events.push({
      type: BattleEventType.HeldItemActivated,
      pokemonId: target.id,
      itemId: HeldItemId.FocusBand,
      targetIds: [target.id],
    });
  }

  if (target.currentHp <= 0) {
    events.push({
      type: BattleEventType.PokemonKo,
      pokemonId: target.id,
      countdownStart: 0,
    });
  }

  if (defenseResult.reflectDamage > 0 && target.currentHp > 0) {
    const reflectedDamage = Math.min(defenseResult.reflectDamage, context.attacker.currentHp);
    context.attacker.currentHp = Math.max(0, context.attacker.currentHp - reflectedDamage);

    events.push({
      type: BattleEventType.DamageDealt,
      targetId: context.attacker.id,
      amount: reflectedDamage,
      effectiveness: 1,
    });

    if (context.attacker.currentHp <= 0) {
      events.push({
        type: BattleEventType.PokemonKo,
        pokemonId: context.attacker.id,
        countdownStart: 0,
      });
    }
  }

  // Called even when the hit KO'd the target: most reactive abilities self-guard on `self.currentHp
  // > 0` (a buff on a fainted holder is meaningless), but Boom Final (aftermath) needs the KO case
  // to backfire on the attacker, so the engine must not gate this on the holder surviving.
  if (actualDamage > 0 && targetAbility?.onAfterDamageReceived) {
    const attackerTypes = context.attackerTypes;
    const selfTypes = defenderTypes;
    const abilityEvents = targetAbility.onAfterDamageReceived({
      self: target,
      attacker: context.attacker,
      move: context.move,
      damageDealt: actualDamage,
      wasAtMaxHp,
      isCrit,
      state: context.state,
      selfTypes,
      attackerTypes,
      random: context.random,
      contactNullified,
    });
    events.push(...abilityEvents);
  }

  const attackerAbility = context.abilityRegistry?.getForPokemon(context.attacker);
  if (actualDamage > 0 && target.currentHp > 0 && attackerAbility?.onAfterDamageDealt) {
    const abilityEvents = attackerAbility.onAfterDamageDealt({
      self: context.attacker,
      target,
      move: context.move,
      damageDealt: actualDamage,
      state: context.state,
      selfTypes: context.attackerTypes,
      targetTypes: defenderTypes,
      random: context.random,
    });
    events.push(...abilityEvents);
  }

  // Tension (unnerve): a living enemy with Tension keeps the target from eating its berry.
  const berrySuppressed =
    targetItem?.isBerry === true && areBerriesSuppressed(context.state, target);
  if (
    actualDamage > 0 &&
    target.currentHp > 0 &&
    targetItem?.onAfterDamageReceived &&
    !berrySuppressed
  ) {
    const result = targetItem.onAfterDamageReceived({
      target,
      attacker: context.attacker,
      move: context.move,
      damageDealt: actualDamage,
      wasAtMaxHp,
      isSuperEffective,
      isContact: isContact && !contactNullified,
    });
    events.push(...result.events);
    if (result.consumeItem) {
      consumeHeldItem(target, { isBerry: targetItem.isBerry });
    }
    if (target.currentHp <= 0) {
      events.push({
        type: BattleEventType.PokemonKo,
        pokemonId: target.id,
        countdownStart: 0,
      });
    }
  }

  // Eject items (Bouton Fuite / Carton Rouge): on a damaging hit, teleport a mon back to a safe tile
  // of its spawn zone, then consume. No bench in this tactical game → spawn-zone teleport is the
  // analogue of the canonical switch-out. Skipped (and not consumed) when no safe tile is free.
  if (actualDamage > 0 && (targetItem?.ejectsHolderOnHit || targetItem?.ejectsAttackerOnHit)) {
    const grid = new Grid(
      context.state.grid[0]?.length ?? 0,
      context.state.grid.length,
      context.state.grid,
    );
    const ejectsAttacker = targetItem.ejectsAttackerOnHit === true;
    const teleportee = ejectsAttacker ? context.attacker : target;
    const teleporteeTypes = ejectsAttacker ? context.attackerTypes : defenderTypes;
    const threat = ejectsAttacker ? target.position : context.attacker.position;
    if (teleportee.currentHp > 0) {
      const teleportEvent = ejectToSpawn(context.state, grid, teleportee, teleporteeTypes, threat);
      if (teleportEvent !== null) {
        const itemId = targetItem.id;
        events.push({
          type: BattleEventType.HeldItemActivated,
          pokemonId: target.id,
          itemId,
          targetIds: [teleportee.id],
        });
        events.push(teleportEvent);
        events.push({
          type: BattleEventType.HeldItemConsumed,
          pokemonId: target.id,
          itemId,
        });
        target.heldItemId = undefined;
      }
    }
  }

  // Accumulate this hit's damage; the attacker's post-move item hook fires once in handleDamage.
  if (actualDamage > 0) {
    moveDamageAccumulator.total += actualDamage;
  }

  return events;
}

export function handleDamage(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];

  if (context.move.category === Category.Status) {
    return events;
  }

  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Damage }>;
  const beatUpPowers = effect.teamBeatUp === true ? computeBeatUpPowers(context) : undefined;
  // Multi-Coups (skill-link) OR Dé Pipé (loaded-dice, maximizesMultiHit): variable-hit moves land max hits.
  const skillLink =
    context.abilityRegistry?.getForPokemon(context.attacker)?.id === "skill-link" ||
    effectiveHeldItem(context.state, context.attacker, context.itemRegistry)?.maximizesMultiHit ===
      true;
  const hitCount = beatUpPowers?.length ?? getHitCount(effect, context.random, skillLink);
  const isMultiHit = hitCount > 1;
  const moveDamageAccumulator = { total: 0 };

  for (const target of context.targets) {
    // Conditional damage branch (pollen-puff): only damage when the predicate holds (e.g. the
    // target is an enemy). On an ally, the move's HealTarget branch applies instead.
    if (
      effect.appliesIf !== undefined &&
      !effectConditionHolds(effect.appliesIf, context.attacker, target)
    ) {
      continue;
    }

    const defenderTypes = context.targetTypesMap.get(target.id) ?? [];
    let actualHits = 0;

    for (let hit = 0; hit < hitCount; hit++) {
      if (target.currentHp <= 0) {
        break;
      }
      // Attacker fainted mid-move from per-hit contact recoil (Casque Brut / Peau Dure) — a KO'd
      // Pokemon deals no further hits (canon: the multi-hit move ends when the user faints).
      if (context.attacker.currentHp <= 0) {
        break;
      }

      if (hit > 0 && context.move.perHitAccuracy === true) {
        if (context.random() * 100 >= context.move.accuracy) {
          break;
        }
      }

      const hitPower = beatUpPowers?.[hit] ?? effect.escalatingHitPower?.[hit];
      const hitEvents = dealSingleHit(
        context,
        target,
        defenderTypes,
        moveDamageAccumulator,
        hitPower,
      );
      events.push(...hitEvents);
      actualHits++;

      if (target.currentHp <= 0) {
        break;
      }
    }

    if (isMultiHit && actualHits > 0) {
      events.push({
        type: BattleEventType.MultiHitComplete,
        attackerId: context.attacker.id,
        targetId: target.id,
        totalHits: actualHits,
      });
    }
  }

  // Post-move attacker item (Orbe Vie recoil, Grelot Coque soin, Joyau Normal consommé) fires once
  // for the whole move on the accumulated damage across every hit and target — never per hit (canon).
  const attackerItem = isHeldItemSuppressed(context.state, context.attacker)
    ? undefined
    : context.itemRegistry?.getForPokemon(context.attacker);
  if (moveDamageAccumulator.total > 0 && attackerItem?.onAfterMoveDamageDealt) {
    events.push(
      ...attackerItem.onAfterMoveDamageDealt({
        attacker: context.attacker,
        move: context.move,
        damageDealt: moveDamageAccumulator.total,
      }),
    );
  }

  return events;
}
