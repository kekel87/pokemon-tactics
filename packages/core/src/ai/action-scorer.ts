import { AURA_RADIUS } from "../battle/aura-system";
import type { BattleEngine } from "../battle/BattleEngine";
import { DISTORTION_RADIUS, isInDistortionZone } from "../battle/distortion-system";
import { getEffectivePowerFloor } from "../battle/dynamic-power-system";
import { effectiveBaseSpeed } from "../battle/effective-base-speed";
import { isEffectivelyFlying } from "../battle/effective-flying";
import { HAZARD_REMOVAL_RADIUS, maxLayersFor } from "../battle/entry-hazard-system";
import { FIELD_TERRAIN_RADIUS, getFieldTerrainAt } from "../battle/field-terrain-system";
import { TRANSFERABLE_STATS } from "../battle/handlers/baton-pass-stats";
import { ohkoAccuracy } from "../battle/ohko";
import { isTerrainImmune } from "../battle/terrain-effects";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import type { EntryHazardKind } from "../enums/entry-hazard-kind";
import { FieldTerrain } from "../enums/field-terrain";
import { PokemonGender } from "../enums/pokemon-gender";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { TerrainType } from "../enums/terrain-type";
import type { Action } from "../types/action";
import type { AiProfile } from "../types/ai-profile";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TargetingPattern } from "../types/targeting-pattern";
import { directionFromTo, getPerpendicularOffsets, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import {
  enemyHasStatDecreaseMoveInRange,
  enemyHasStatusMoveInRange,
  lastMoveIsLowValue,
  lastMoveIsThreat,
  statusMoveRatio,
} from "./threat-detection";

const DANGEROUS_TERRAINS: ReadonlySet<TerrainType> = new Set([
  TerrainType.Magma,
  TerrainType.Lava,
  TerrainType.Swamp,
]);
const DANGEROUS_TERRAIN_PENALTY = 8;

/**
 * CT "tours du lanceur": weather / field / barrier durations count down on the setter's OWN turns,
 * so a slower setter makes its effect last longer in wall-clock — its setup is worth more. Maps base
 * Speed (~30..130) to a multiplier of 2.0 (very slow) .. 1.0 (very fast), clamped at the ends.
 */
function setterDurabilityMultiplier(setter: PokemonInstance): number {
  const t = Math.max(0, Math.min(1, (setter.baseStats.speed - 30) / 100));
  return 2 - t;
}

export function scoreAction(
  action: Action,
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
): number {
  const currentPokemonId = state.activePokemonId;
  const currentPokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
  if (!currentPokemon) {
    return 0;
  }

  const enemies = getAliveEnemies(state, currentPokemon);
  const allies = getAliveAllies(state, currentPokemon);

  switch (action.kind) {
    case ActionKind.UseMove:
      return scoreUseMove(
        action,
        currentPokemon,
        enemies,
        allies,
        moveRegistry,
        engine,
        profile,
        state,
      );
    case ActionKind.Move:
      return scoreMove(action, currentPokemon, enemies, moveRegistry, engine, profile);
    case ActionKind.EndTurn:
      return scoreEndTurn(action, currentPokemon, enemies);
    case ActionKind.UndoMove:
      return 0;
  }
}

function scoreUseMove(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  allies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
  state: BattleState,
): number {
  const move = moveRegistry.get(action.moveId);
  if (!move) {
    return 0;
  }

  const weights = profile.scoringWeights;
  const isSelfTargeting = move.targeting.kind === TargetingKind.Self;
  const hasDamageFloor = getEffectivePowerFloor(move) > 0;

  // Cognobidon guard-rail (belly-drum, plan 154): value it only at high HP with a low Attack stage;
  // hard negative when it would fail (HP ≤ 50% or Attack maxed) so the AI never suicides. Fine
  // valuation (win-condition behind a wall) deferred to the grouped AI pass.
  if (move.effects.some((effect) => effect.kind === EffectKind.BellyDrum)) {
    return scoreBellyDrum(currentPokemon, weights);
  }

  // Par Ici / Poudre Fureur (draw-attention, plan 155): guard-rail only — worthless with no enemy in
  // range to pivot, otherwise a small score scaled by the number of enemies exposed. Fine valuation
  // (setting up an ally's backstab) is deferred to the grouped AI pass.
  const drawAttention = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.DrawAttention }> =>
      effect.kind === EffectKind.DrawAttention,
  );
  if (drawAttention !== undefined) {
    const exposed = enemies.filter(
      (enemy) =>
        enemy.currentHp > 0 &&
        Math.abs(enemy.position.x - currentPokemon.position.x) +
          Math.abs(enemy.position.y - currentPokemon.position.y) <=
          drawAttention.radius,
    );
    return exposed.length === 0 ? -1 : weights.statChanges * 0.5 * exposed.length;
  }

  if (isSelfTargeting && !hasDamageFloor) {
    return scoreSelfMove(currentPokemon, enemies, move, weights, state);
  }

  if (move.targetsAlly === true || move.targetsAllyOrSelf === true) {
    return scoreAllyTargetMove(action, currentPokemon, allies, move, weights);
  }

  // Targeted heal (heal-pulse): heal a wounded ally; never waste it on a full ally or an enemy.
  const targetedHeal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealTarget }> =>
      effect.kind === EffectKind.HealTarget && effect.radius === undefined,
  );
  if (!hasDamageFloor && targetedHeal !== undefined) {
    return scoreTargetedHeal(action, allies, enemies, targetedHeal.percent, weights);
  }

  const hazardSetter = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostEntryHazard }> =>
      effect.kind === EffectKind.PostEntryHazard,
  );
  if (hazardSetter !== undefined) {
    return scoreEntryHazardSetter(action, enemies, allies, hazardSetter.hazardKind, weights, state);
  }

  // Balance (pain-split) / Effort (endeavor): HP manipulation, no power floor. Both shine when the
  // caster is low and the target is high — Balance steals HP, Effort chips the target down hard.
  const isHpManipulation = move.effects.some(
    (effect) => effect.kind === EffectKind.PainSplit || effect.kind === EffectKind.Endeavor,
  );
  if (isHpManipulation) {
    return scoreHpManipulation(action, currentPokemon, enemies, weights);
  }

  // Stat-manip guard-rail (plan 146): the copy/invert/swap kinds carry no damage floor and no
  // StatChange effect, so the generic path scores them 0 and the AI could play a visible blunder on
  // a tie-break (inverting a debuffed target, swapping away its own advantage). Give a small negative
  // score when the net effect clearly favours the target; positive valuation is deferred.
  const hasStatManip = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.CopyStatStages ||
      effect.kind === EffectKind.InvertStatStages ||
      effect.kind === EffectKind.SwapStatStages ||
      effect.kind === EffectKind.SwapRawSpeed,
  );
  if (hasStatManip) {
    return scoreStatManip(action, currentPokemon, enemies, move, weights);
  }

  // OHKO guard-rail (plan 148): one-hit-KO moves carry no power floor → the generic damage path scores
  // them ~0 and the AI would never play them. Give a minimal valuation (accuracy × kill value, favouring
  // high-HP targets) and a hard negative on immune targets so the AI never plays into Fermeté / a type
  // or Ice immunity. Fine heuristics (setup denial, threat assessment) are deferred.
  if (move.isOhko === true) {
    return scoreOhko(action, currentPokemon, enemies, allies, move, engine, weights);
  }

  const affectedTiles = estimateAffectedTiles(
    move.targeting,
    currentPokemon.position,
    action.targetPosition,
  );
  const targetsHit = enemies.filter((enemy) => isOnTiles(enemy.position, affectedTiles));
  const alliesHit = allies.filter((ally) => isOnTiles(ally.position, affectedTiles));

  if (targetsHit.length === 0) {
    return -1;
  }

  // Coup Bas guard-rail (sucker-punch, plan 150): the move fizzles (0 damage, CT paid) unless a hit
  // target's LAST action was offensive. Exclude it when no target satisfies the freshness gate so the
  // AI never throws the turn away. Fine valuation (punishing an identified attacker) is deferred.
  if (move.failsUnlessTargetAggressive === true) {
    const anyAggressive = targetsHit.some(
      (target) =>
        target.lastActedAtAction !== undefined &&
        target.lastOffensiveActionAtAction === target.lastActedAtAction,
    );
    if (!anyAggressive) {
      return -1;
    }
  }

  // Attraction guard-rail (attract, plan 154): fails on same-gender / genderless / already-infatuated
  // targets. Exclude it when no hit target is a valid infatuation candidate so the AI never wastes the
  // turn. Fine valuation (infatuate an identified sweeper) deferred.
  if (move.effects.some((effect) => effect.kind === EffectKind.Attract)) {
    const anyValid = targetsHit.some(
      (target) =>
        currentPokemon.gender !== PokemonGender.Genderless &&
        target.gender !== PokemonGender.Genderless &&
        target.gender !== currentPokemon.gender &&
        !target.volatileStatuses.some((volatile) => volatile.type === StatusType.Infatuated),
    );
    if (!anyValid) {
      return -1;
    }
  }

  let score = 0;

  if (getEffectivePowerFloor(move) > 0) {
    score += scoreDamagingMove(currentPokemon, targetsHit, action.moveId, engine, weights);
  }

  if (alliesHit.length > 0) {
    score -= weights.killPotential * 0.3 * alliesHit.length;
  }

  const hasEnemyDebuff = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StatChange &&
      effect.target === EffectTarget.Targets &&
      effect.stages < 0,
  );
  const hasStatus = move.effects.some((effect) => effect.kind === EffectKind.Status);
  const isTauntApplication = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.Status &&
      "status" in effect &&
      effect.status === StatusType.Taunted,
  );
  const isDisableApplication = move.effects.some((effect) => effect.kind === EffectKind.Disable);
  const isEncoreApplication = move.effects.some((effect) => effect.kind === EffectKind.Encore);
  const isSpiteApplication = move.effects.some((effect) => effect.kind === EffectKind.SpiteCtTax);

  if (hasEnemyDebuff) {
    score += weights.statChanges * 1.5;
  }
  if (isDisableApplication) {
    score += scoreDisableApplication(targetsHit, moveRegistry, weights);
  } else if (isEncoreApplication) {
    score += scoreEncoreApplication(targetsHit, moveRegistry, weights);
  } else if (isTauntApplication) {
    score += scoreTauntApplication(targetsHit, moveRegistry, weights);
  } else if (isSpiteApplication) {
    score += scoreSpiteApplication(targetsHit, weights, state);
  } else if (hasStatus) {
    score += weights.statChanges;
  }

  return score;
}

/**
 * Balance (pain-split) / Effort (endeavor): both want a low-HP caster and a high-HP target. Score by
 * the HP gap (target fraction − caster fraction); negative or tiny gaps return ~0 so the AI does not
 * waste the move when it has nothing to gain.
 */
function scoreHpManipulation(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: readonly PokemonInstance[],
  weights: AiProfile["scoringWeights"],
): number {
  const target = enemies.find(
    (enemy) =>
      enemy.position.x === action.targetPosition.x && enemy.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }
  const gap = target.currentHp / target.maxHp - currentPokemon.currentHp / currentPokemon.maxHp;
  if (gap <= 0.1) {
    return 0;
  }
  return gap * weights.killPotential;
}

/**
 * OHKO garde-fou (plan 148): minimal valuation for one-hit-KO moves (they carry no power floor, so the
 * generic damage path would score them ~0). Per enemy actually caught by the move's pattern: accuracy ×
 * kill value, scaled up for high-HP targets (an OHKO shines when a normal hit wouldn't KO). Immune
 * targets (Fermeté / type / Ice) subtract kill value so the AI never plays into them. Allies caught by a
 * Line/Cone subtract kill value (friendly-fire KO risk). Fine heuristics (setup/threat) are deferred.
 */
function scoreOhko(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: readonly PokemonInstance[],
  allies: readonly PokemonInstance[],
  move: MoveDefinition,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const affectedTiles = estimateAffectedTiles(
    move.targeting,
    currentPokemon.position,
    action.targetPosition,
  );
  const targetsHit = enemies.filter((enemy) => isOnTiles(enemy.position, affectedTiles));
  if (targetsHit.length === 0) {
    return -1;
  }

  const accuracy = ohkoAccuracy(move, engine.getPokemonTypes(currentPokemon.id)) / 100;
  let score = 0;
  for (const target of targetsHit) {
    if (engine.ohkoImmunityAgainst(currentPokemon, move, target) !== null) {
      score -= weights.killPotential;
      continue;
    }
    const hpFraction = target.currentHp / target.maxHp;
    score += accuracy * weights.killPotential * (0.5 + hpFraction);
  }

  const alliesHit = allies.filter((ally) => isOnTiles(ally.position, affectedTiles));
  score -= alliesHit.length * accuracy * weights.killPotential;
  return score;
}

/**
 * Cognobidon garde-fou (belly-drum, plan 154): the −50% HP cost makes it a potential blunder. Fail
 * cases (HP ≤ 50% or Attack already maxed) → hard negative; risky (HP ≤ 70%) → neutral; safe → value
 * the +6 Attack proportionally to the headroom actually gained.
 */
function scoreBellyDrum(
  currentPokemon: PokemonInstance,
  weights: AiProfile["scoringWeights"],
): number {
  const hpRatio = currentPokemon.currentHp / currentPokemon.maxHp;
  if (hpRatio <= 0.5 || currentPokemon.statStages[StatName.Attack] >= 6) {
    return -1;
  }
  if (hpRatio < 0.7) {
    return 0;
  }
  const headroom = (6 - currentPokemon.statStages[StatName.Attack]) / 6;
  return weights.killPotential * headroom;
}

function sumStatStages(pokemon: PokemonInstance, stats: readonly StatName[]): number {
  let total = 0;
  for (const stat of stats) {
    total += pokemon.statStages[stat];
  }
  return total;
}

/**
 * Stat-manip guard-rail (plan 146): return a small negative score when copying / inverting / swapping
 * clearly benefits the target instead of the caster, else 0 (neutral — the AI treats these as inert).
 */
function scoreStatManip(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  move: MoveDefinition,
  weights: AiProfile["scoringWeights"],
): number {
  const target = enemies.find(
    (enemy) =>
      enemy.position.x === action.targetPosition.x && enemy.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }
  const penalty = -weights.statChanges;
  for (const effect of move.effects) {
    if (effect.kind === EffectKind.InvertStatStages) {
      // Inverting a target whose stages sum to ≤ 0 hands it a net buff.
      return sumStatStages(target, TRANSFERABLE_STATS) <= 0 ? penalty : 0;
    }
    if (effect.kind === EffectKind.CopyStatStages) {
      // Copying a target worse off than us throws away our own boosts.
      return sumStatStages(target, TRANSFERABLE_STATS) < sumStatStages(caster, TRANSFERABLE_STATS)
        ? penalty
        : 0;
    }
    if (effect.kind === EffectKind.SwapStatStages) {
      return sumStatStages(target, effect.stats) < sumStatStages(caster, effect.stats)
        ? penalty
        : 0;
    }
    if (effect.kind === EffectKind.SwapRawSpeed) {
      // Swapping raw Speed with a slower target loses us tempo.
      return effectiveBaseSpeed(caster) > effectiveBaseSpeed(target) ? penalty : 0;
    }
  }
  return 0;
}

/**
 * Dépit (spite): a CT tempo tax. Worth more on a target about to act (high CT), wasted on a mon
 * behind a Substitute. Flat statChanges baseline, ×1.5 when the target's CT is near its threshold.
 */
const SPITE_HIGH_CT = 800;
function scoreSpiteApplication(
  targets: readonly PokemonInstance[],
  weights: AiProfile["scoringWeights"],
  state?: BattleState,
): number {
  let total = 0;
  for (const target of targets) {
    if (target.substituteHp !== undefined) {
      continue;
    }
    let score = weights.statChanges;
    const targetCt = state?.ctSnapshot?.[target.id];
    if (targetCt !== undefined && targetCt >= SPITE_HIGH_CT) {
      score *= 1.5;
    }
    total += score;
  }
  return total;
}

/**
 * Score placing an entry-hazard trap on the aimed tile (plan 131). The AI enumerates every tile in
 * range, so we reward tiles near enemies (likely to be traversed) and reject useless placements: on
 * an enemy's current tile (entry-only, no trigger), too far from any enemy, or stacking at cap. Since
 * traps are team-agnostic, a tile adjacent to one of our OWN mons is penalised (self-sabotage risk).
 */
function scoreEntryHazardSetter(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  enemies: readonly PokemonInstance[],
  allies: readonly PokemonInstance[],
  kind: EntryHazardKind,
  weights: AiProfile["scoringWeights"],
  state: BattleState,
): number {
  const livingEnemies = enemies.filter((enemy) => enemy.currentHp > 0);
  if (livingEnemies.length === 0) {
    return -1;
  }
  const tile = action.targetPosition;
  const nearest = Math.min(
    ...livingEnemies.map((enemy) => manhattanDistance(tile, enemy.position)),
  );
  // On an enemy = no entry trigger; beyond 3 tiles = unlikely to be walked over soon.
  const proximityScore = nearest === 0 ? 0 : Math.max(0, 4 - nearest);
  if (proximityScore === 0) {
    return -1;
  }
  // Team-agnostic traps also bite our own mons: don't lay one right next to an ally.
  const nearestAlly = allies
    .filter((ally) => ally.currentHp > 0)
    .reduce(
      (min, ally) => Math.min(min, manhattanDistance(tile, ally.position)),
      Number.POSITIVE_INFINITY,
    );
  if (nearestAlly <= 1) {
    return -1;
  }
  const existing = state.entryHazards.find(
    (cell) => cell.kind === kind && cell.tile.x === tile.x && cell.tile.y === tile.y,
  );
  if (existing && existing.layers >= maxLayersFor(kind)) {
    return -1;
  }
  let score = weights.statChanges * 0.6 * proximityScore;
  if (existing) {
    score *= 0.7;
  }
  return score;
}

function scoreDisableApplication(
  targets: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  let total = 0;
  for (const target of targets) {
    if (
      target.lastUsedMoveId === undefined ||
      target.volatileStatuses.some((v) => v.type === StatusType.Disabled)
    ) {
      continue;
    }
    let score = weights.statChanges;
    if (lastMoveIsThreat(target, moveRegistry)) {
      score *= 1.8;
    }
    const hpRatio = target.currentHp / target.maxHp;
    if (hpRatio < 0.3) {
      score *= 0.3;
    }
    total += score;
  }
  return total;
}

function scoreEncoreApplication(
  targets: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  let total = 0;
  for (const target of targets) {
    if (
      target.lastUsedMoveId === undefined ||
      target.volatileStatuses.some((v) => v.type === StatusType.Encored)
    ) {
      continue;
    }
    let score = weights.statChanges;
    if (lastMoveIsLowValue(target, moveRegistry)) {
      score *= 1.8;
    } else if (lastMoveIsThreat(target, moveRegistry)) {
      score *= 0.3;
    }
    total += score;
  }
  return total;
}

function scoreTauntApplication(
  targets: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  let total = 0;
  for (const target of targets) {
    if (target.volatileStatuses.some((v) => v.type === StatusType.Taunted)) {
      continue;
    }
    let score = weights.statChanges;
    const ratio = statusMoveRatio(target, moveRegistry);
    if (ratio >= 0.4) {
      score *= 1.8;
    }
    const hpRatio = target.currentHp / target.maxHp;
    if (hpRatio < 0.3) {
      score *= 0.3;
    }
    total += score;
  }
  return total;
}

function scoreAllyTargetMove(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  allies: PokemonInstance[],
  move: MoveDefinition,
  weights: AiProfile["scoringWeights"],
): number {
  const target = allies.find(
    (ally) =>
      ally.position.x === action.targetPosition.x && ally.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }

  // Coup d'Main (helping-hand): buff an adjacent ally. Modest flat value; the payoff depends on the
  // ally landing an offensive move next, which the scorer cannot foresee, so keep it conservative.
  const hasHelpingHand = move.effects.some((effect) => effect.kind === EffectKind.HelpingHand);
  if (hasHelpingHand) {
    return weights.statChanges * 0.8;
  }

  // Cri Draconique (dragon-cheer): buff an ally's crit rate. Same conservative flat value as Coup
  // d'Main; wasteful on an ally already sitting at a guaranteed-crit stage.
  const hasAllyCritBuff = move.effects.some(
    (effect) => effect.kind === EffectKind.RaiseCritStage && effect.target === EffectTarget.Targets,
  );
  if (hasAllyCritBuff) {
    return (target.critStageBoost ?? 0) >= 3 ? -1 : weights.statChanges * 0.8;
  }

  // Wish (delayed heal) and ally-targeted heal: value by the recipient's missing HP.
  const wishEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostWish }> =>
      effect.kind === EffectKind.PostWish,
  );
  if (wishEffect !== undefined) {
    const missing = 1 - target.currentHp / target.maxHp;
    if (missing <= 0.1) {
      return 0;
    }
    return missing * weights.killPotential * 0.7;
  }
  const allyHeal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealTarget }> =>
      effect.kind === EffectKind.HealTarget && effect.radius === undefined,
  );
  if (allyHeal !== undefined) {
    const missing = 1 - target.currentHp / target.maxHp;
    return missing <= 0.1 ? 0 : missing * weights.killPotential * 0.8;
  }

  const hasTransfer = move.effects.some((effect) => effect.kind === EffectKind.TransferStatStages);
  if (!hasTransfer) {
    return 0;
  }

  let casterPositive = 0;
  let casterNegative = 0;
  let targetPositive = 0;
  for (const stat of TRANSFERABLE_STATS) {
    const cs = currentPokemon.statStages[stat];
    const ts = target.statStages[stat];
    if (cs > 0) {
      casterPositive += cs;
    } else {
      casterNegative += cs;
    }
    if (ts > 0) {
      targetPositive += ts;
    }
  }

  if (casterPositive === 0) {
    return -20;
  }

  let score = casterPositive * 4 + casterNegative * 2;
  if (targetPositive < casterPositive) {
    score += 8;
  }
  return score * (weights.statChanges / 10 + 1);
}

function scoreTargetedHeal(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  allies: PokemonInstance[],
  enemies: PokemonInstance[],
  percent: number,
  weights: AiProfile["scoringWeights"],
): number {
  const ally = allies.find(
    (candidate) =>
      candidate.position.x === action.targetPosition.x &&
      candidate.position.y === action.targetPosition.y,
  );
  if (ally !== undefined) {
    const missing = 1 - ally.currentHp / ally.maxHp;
    return missing <= 0.1 ? 0 : Math.min(missing, percent) * weights.killPotential * 0.8;
  }
  // Healing an enemy (heal-pulse can reach foes) is always a mistake for the AI.
  const enemy = enemies.find(
    (candidate) =>
      candidate.position.x === action.targetPosition.x &&
      candidate.position.y === action.targetPosition.y,
  );
  return enemy === undefined ? -1 : -weights.killPotential;
}

function scoreSelfMove(
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  move: MoveDefinition,
  weights: AiProfile["scoringWeights"],
  state?: BattleState,
): number {
  const hasSelfBuff = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StatChange &&
      effect.target === EffectTarget.Self &&
      effect.stages > 0,
  );

  const hasRemoveHazards = move.effects.some(
    (effect) => effect.kind === EffectKind.RemoveEntryHazards,
  );
  if (hasRemoveHazards) {
    if (!state) {
      return weights.statChanges;
    }
    const hazardNearby = state.entryHazards.some(
      (cell) => manhattanDistance(cell.tile, currentPokemon.position) <= HAZARD_REMOVAL_RADIUS,
    );
    return hazardNearby ? weights.statChanges * 1.5 : -1;
  }

  // Requiem (perish-song): hits the caster too, so it is a desperation / mutual-KO tool. Value it only
  // when the caster is hurt and there are healthy enemies to drag down; skip if already counting down.
  const hasPerishSong = move.effects.some((effect) => effect.kind === EffectKind.PostPerishSong);
  if (hasPerishSong) {
    if (currentPokemon.perishAura !== undefined) {
      return -1;
    }
    const healthyEnemies = enemies.filter((enemy) => enemy.currentHp / enemy.maxHp > 0.6).length;
    if (healthyEnemies === 0) {
      return 0;
    }
    const desperation = 1 - currentPokemon.currentHp / currentPokemon.maxHp;
    return desperation * healthyEnemies * weights.killPotential * 0.5;
  }

  const postAuraEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostAura }> =>
      effect.kind === EffectKind.PostAura,
  );
  if (postAuraEffect) {
    if (!state) {
      return weights.statChanges;
    }
    const alreadyHasSameKind = state.auras.some(
      (aura) => aura.casterPokemonId === currentPokemon.id && aura.kind === postAuraEffect.aura,
    );
    if (alreadyHasSameKind) {
      return -1;
    }
    let alliesInRadius = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      if (candidate.id === currentPokemon.id) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= AURA_RADIUS) {
        alliesInRadius += 1;
      }
    }
    const earlyMultiplier = setterDurabilityMultiplier(currentPokemon);

    let threatBonus = 1.0;
    if (postAuraEffect.aura === AuraKind.Mist) {
      threatBonus = enemyHasStatDecreaseMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    } else if (postAuraEffect.aura === AuraKind.Safeguard) {
      threatBonus = enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    }

    return weights.statChanges * earlyMultiplier * (1 + alliesInRadius) * threatBonus;
  }

  const postFieldTerrainEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostFieldTerrain }> =>
      effect.kind === EffectKind.PostFieldTerrain,
  );
  if (postFieldTerrainEffect) {
    if (!state) {
      return weights.statChanges;
    }
    // Re-posting the same terrain on a tile already covered by it is wasteful.
    if (getFieldTerrainAt(state, currentPokemon.position) === postFieldTerrainEffect.terrain) {
      return -1;
    }
    let groundedAlliesInRadius = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= FIELD_TERRAIN_RADIUS) {
        groundedAlliesInRadius += 1;
      }
    }
    const earlyMultiplier = setterDurabilityMultiplier(currentPokemon);
    let threatBonus = 1.0;
    if (
      postFieldTerrainEffect.terrain === FieldTerrain.Electric ||
      postFieldTerrainEffect.terrain === FieldTerrain.Misty
    ) {
      // Electric blocks sleep, Misty blocks status: more valuable under an enemy status threat.
      threatBonus = enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    }
    return weights.statChanges * earlyMultiplier * groundedAlliesInRadius * threatBonus;
  }

  const hasPostDistortion = move.effects.some(
    (effect) => effect.kind === EffectKind.PostDistortion,
  );
  if (hasPostDistortion) {
    if (!state) {
      return weights.statChanges;
    }
    // Re-posting where the caster already stands inside a zone is wasteful (mirror field terrains).
    if (isInDistortionZone(state, currentPokemon.position)) {
      return -1;
    }
    // Distorsion pays off when our SLOW mons share the zone with faster enemies. Estimate the
    // benefit as the count of allies (incl. self) inside the zone radius that are slower than the
    // median enemy speed; no slow beneficiaries → no value.
    const enemySpeeds = enemies
      .filter((enemy) => enemy.currentHp > 0)
      .map((enemy) => enemy.baseStats.speed)
      .sort((a, b) => a - b);
    if (enemySpeeds.length === 0) {
      return 0;
    }
    const medianEnemySpeed = enemySpeeds[Math.floor(enemySpeeds.length / 2)] ?? 0;
    let slowBeneficiaries = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= DISTORTION_RADIUS && candidate.baseStats.speed < medianEnemySpeed) {
        slowBeneficiaries += 1;
      }
    }
    if (slowBeneficiaries === 0) {
      return 0;
    }
    return weights.statChanges * setterDurabilityMultiplier(currentPokemon) * slowBeneficiaries;
  }

  const hasPostSubstitute = move.effects.some(
    (effect) => effect.kind === EffectKind.PostSubstitute,
  );
  if (hasPostSubstitute) {
    if (currentPokemon.substituteHp !== undefined) {
      return -1;
    }
    const hpRatio = currentPokemon.currentHp / currentPokemon.maxHp;
    if (hpRatio <= 0.25) {
      return 0;
    }
    let multiplier = 1.0;
    if (
      enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ||
      enemyHasStatDecreaseMoveInRange(enemies, currentPokemon, 5)
    ) {
      multiplier *= 1.5;
    }
    if (state && (state.actionCounter ?? 0) <= 6) {
      multiplier *= 1.2;
    }
    if (hpRatio < 0.4) {
      multiplier *= 0.5;
    }
    return weights.statChanges * 1.5 * multiplier;
  }

  // Self-heal (recover, soft-boiled, slack-off): value by missing HP.
  const healSelf = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealSelf }> =>
      effect.kind === EffectKind.HealSelf,
  );
  if (healSelf !== undefined) {
    const missing = 1 - currentPokemon.currentHp / currentPokemon.maxHp;
    return missing <= 0.1 ? 0 : Math.min(missing, healSelf.percent) * weights.killPotential * 0.9;
  }

  // Heal-over-time setup (ingrain, aqua-ring): worthwhile when hurt and not already active.
  const hotEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostHealOverTime }> =>
      effect.kind === EffectKind.PostHealOverTime,
  );
  if (hotEffect !== undefined) {
    if (currentPokemon.volatileStatuses.some((v) => v.type === hotEffect.status)) {
      return -1;
    }
    const missing = 1 - currentPokemon.currentHp / currentPokemon.maxHp;
    return missing < 0.25 ? 0 : missing * weights.killPotential * 0.4;
  }

  // Life Dew (ally radius heal): sum of allies' missing HP within radius.
  const radiusHeal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealTarget }> =>
      effect.kind === EffectKind.HealTarget && effect.radius !== undefined,
  );
  if (radiusHeal !== undefined) {
    if (!state) {
      return weights.killPotential * 0.5;
    }
    const radius = radiusHeal.radius ?? 0;
    let missingSum = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= radius) {
        missingSum += 1 - candidate.currentHp / candidate.maxHp;
      }
    }
    return missingSum <= 0.1 ? 0 : missingSum * weights.killPotential * 0.6;
  }

  // Aromatherapy (team status cure): value by allies carrying a major status in radius.
  const cureEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.CureTeamStatus }> =>
      effect.kind === EffectKind.CureTeamStatus,
  );
  if (cureEffect !== undefined) {
    if (!state) {
      return weights.statChanges;
    }
    let statusedAllies = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= cureEffect.radius && candidate.statusEffects.length > 0) {
        statusedAllies += 1;
      }
    }
    return statusedAllies === 0 ? 0 : statusedAllies * weights.statChanges * 2;
  }

  // Possessif (imprison): worth it only when an enemy shares moves with us; best when it seals
  // several. -1 if already active or nothing to seal.
  const hasImprison = move.effects.some((effect) => effect.kind === EffectKind.PostImprison);
  if (hasImprison) {
    if (currentPokemon.volatileStatuses.some((v) => v.type === StatusType.Imprisoning)) {
      return -1;
    }
    const myMoves = new Set(currentPokemon.moveIds);
    let maxShared = 0;
    for (const enemy of enemies) {
      if (enemy.currentHp <= 0) {
        continue;
      }
      const shared = enemy.moveIds.filter((id) => myMoves.has(id)).length;
      if (shared > maxShared) {
        maxShared = shared;
      }
    }
    if (maxShared === 0) {
      return -1;
    }
    const base = weights.statChanges * maxShared;
    return maxShared >= 2 ? base * 1.5 : base;
  }

  // Puissance (focus-energy) / Affilage (laser-focus): crit setup. Guard against restacking a
  // boost that is already maxed / already armed; otherwise value it like a generic self-buff.
  const hasCritSetup = move.effects.some(
    (effect) =>
      (effect.kind === EffectKind.RaiseCritStage && effect.target === EffectTarget.Self) ||
      effect.kind === EffectKind.ArmGuaranteedCrit,
  );
  if (hasCritSetup) {
    if (currentPokemon.guaranteedCritArmed === true || (currentPokemon.critStageBoost ?? 0) >= 3) {
      return -1;
    }
    const nearestEnemyDist = closestEnemyManhattanDistance(currentPokemon.position, enemies);
    return nearestEnemyDist > 2 ? weights.statChanges * 3 : weights.statChanges;
  }

  if (!hasSelfBuff) {
    return 0;
  }

  const nearestEnemyDist = closestEnemyManhattanDistance(currentPokemon.position, enemies);
  return nearestEnemyDist > 2 ? weights.statChanges * 3 : weights.statChanges;
}

function scoreDamagingMove(
  currentPokemon: PokemonInstance,
  targetsHit: PokemonInstance[],
  moveId: string,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let totalScore = 0;

  for (const target of targetsHit) {
    const estimate = engine.estimateDamage(currentPokemon.id, moveId, target.id);
    if (!estimate) {
      continue;
    }

    let targetScore = 0;

    if (estimate.min >= target.currentHp) {
      targetScore += weights.killPotential;
    } else {
      const damageRatio = estimate.max / target.maxHp;
      targetScore += damageRatio * weights.killPotential * 0.5;
    }

    if (estimate.effectiveness > 1) {
      targetScore += weights.typeAdvantage;
    } else if (estimate.effectiveness < 1 && estimate.effectiveness > 0) {
      targetScore -= weights.typeAdvantage * 0.5;
    }

    totalScore += targetScore;
  }

  return totalScore;
}

function estimateAffectedTiles(
  targeting: TargetingPattern,
  casterPosition: Position,
  targetPosition: Position,
): Position[] {
  switch (targeting.kind) {
    case TargetingKind.Single:
      return [targetPosition];

    case TargetingKind.Self:
      return [casterPosition];

    case TargetingKind.Dash:
      return [targetPosition];

    case TargetingKind.Line: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const tiles: Position[] = [];
      for (let step = 1; step <= targeting.length; step++) {
        tiles.push(stepInDirection(casterPosition, direction, step));
      }
      return tiles;
    }

    case TargetingKind.Cone: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const tiles: Position[] = [];
      for (let distance = targeting.range.min; distance <= targeting.range.max; distance++) {
        const center = stepInDirection(casterPosition, direction, distance);
        tiles.push(center);
        const halfWidth = distance - 1;
        const perpOffsets = getPerpendicularOffsets(direction);
        for (let offset = 1; offset <= halfWidth; offset++) {
          for (const perp of perpOffsets) {
            tiles.push({ x: center.x + perp.x * offset, y: center.y + perp.y * offset });
          }
        }
      }
      return tiles;
    }

    case TargetingKind.Slash: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const center = stepInDirection(casterPosition, direction, 1);
      const tiles = [center];
      for (const perp of getPerpendicularOffsets(direction)) {
        tiles.push({ x: center.x + perp.x, y: center.y + perp.y });
      }
      return tiles;
    }

    case TargetingKind.Cross: {
      const tiles: Position[] = [];
      const halfSize = Math.floor(targeting.size / 2);
      for (let d = -halfSize; d <= halfSize; d++) {
        tiles.push({ x: casterPosition.x + d, y: casterPosition.y });
        if (d !== 0) {
          tiles.push({ x: casterPosition.x, y: casterPosition.y + d });
        }
      }
      return tiles;
    }

    case TargetingKind.Zone:
      return tilesInRadius(casterPosition, targeting.radius);

    case TargetingKind.Blast:
      return tilesInRadius(targetPosition, targeting.radius);

    case TargetingKind.Teleport:
      return [targetPosition];

    case TargetingKind.HitAndRun:
      return [targetPosition];

    case TargetingKind.GroundTarget:
      return [targetPosition];
  }
}

function tilesInRadius(center: Position, radius: number): Position[] {
  const tiles: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (manhattanDistance(center, { x: center.x + dx, y: center.y + dy }) <= radius) {
        tiles.push({ x: center.x + dx, y: center.y + dy });
      }
    }
  }
  return tiles;
}

function isOnTiles(position: Position, tiles: Position[]): boolean {
  return tiles.some((tile) => tile.x === position.x && tile.y === position.y);
}

function scoreMove(
  action: Extract<Action, { kind: typeof ActionKind.Move }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
): number {
  if (enemies.length === 0) {
    return 0;
  }

  const weights = profile.scoringWeights;
  const destination = action.path[action.path.length - 1] ?? currentPokemon.position;
  const currentDistance = closestDistanceToEnemies(
    currentPokemon.position,
    enemies,
    currentPokemon.id,
    engine,
  );
  const newDistance = closestDistanceToEnemies(destination, enemies, currentPokemon.id, engine);
  const improvement = currentDistance - newDistance;

  let score = improvement > 0 ? improvement * weights.positioning : 0;

  const pokemonTypes = engine.getPokemonTypes(currentPokemon.id);
  const isFlying = isEffectivelyFlying(currentPokemon, pokemonTypes);
  const destinationTile = action.path.length > 0 ? engine.getTileAt(destination) : null;
  if (
    destinationTile &&
    DANGEROUS_TERRAINS.has(destinationTile.terrain) &&
    !isTerrainImmune(destinationTile.terrain, pokemonTypes, isFlying)
  ) {
    score -= DANGEROUS_TERRAIN_PENALTY;
  }

  const attackBonus = evaluateAttacksFromPosition(
    currentPokemon,
    destination,
    enemies,
    moveRegistry,
    engine,
    weights,
  );
  score += attackBonus;

  return score;
}

function evaluateAttacksFromPosition(
  pokemon: PokemonInstance,
  fromPosition: Position,
  enemies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let bestAttackScore = 0;

  for (const moveId of pokemon.moveIds) {
    const move = moveRegistry.get(moveId);
    if (!move || getEffectivePowerFloor(move) === 0) {
      continue;
    }

    const reach = getMoveMaxReach(move.targeting);

    for (const enemy of enemies) {
      const dist = manhattanDistance(fromPosition, enemy.position);
      if (dist > reach) {
        continue;
      }

      const estimate = engine.estimateDamage(pokemon.id, moveId, enemy.id);
      if (!estimate) {
        continue;
      }

      let attackScore = 0;
      if (estimate.min >= enemy.currentHp) {
        attackScore = weights.killPotential;
      } else {
        attackScore = (estimate.max / enemy.maxHp) * weights.killPotential * 0.5;
      }
      if (estimate.effectiveness > 1) {
        attackScore += weights.typeAdvantage;
      }

      if (attackScore > bestAttackScore) {
        bestAttackScore = attackScore;
      }
    }
  }

  return bestAttackScore * 0.8;
}

function getMoveMaxReach(targeting: TargetingPattern): number {
  switch (targeting.kind) {
    case TargetingKind.Single:
      return targeting.range.max;
    case TargetingKind.Cone:
      return targeting.range.max;
    case TargetingKind.Line:
      return targeting.length;
    case TargetingKind.Dash:
      return targeting.maxDistance;
    case TargetingKind.Blast:
      return targeting.range.max + targeting.radius;
    case TargetingKind.Slash:
      return 1;
    case TargetingKind.Cross:
      return Math.floor(targeting.size / 2);
    case TargetingKind.Zone:
      return targeting.radius;
    case TargetingKind.Self:
      return 0;
    case TargetingKind.Teleport:
      return targeting.range.max;
    case TargetingKind.HitAndRun:
      return targeting.hitRange.max;
    case TargetingKind.GroundTarget:
      return targeting.range.max;
  }
}

function scoreEndTurn(
  action: Extract<Action, { kind: typeof ActionKind.EndTurn }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
): number {
  if (enemies.length === 0) {
    return 0;
  }

  const closestEnemy = findClosestEnemy(currentPokemon.position, enemies);
  const desiredDirection = directionFromTo(currentPokemon.position, closestEnemy);

  return action.direction === desiredDirection ? 1 : 0;
}

function getAliveEnemies(state: BattleState, currentPokemon: PokemonInstance): PokemonInstance[] {
  return [...state.pokemon.values()].filter(
    (pokemon) => pokemon.playerId !== currentPokemon.playerId && pokemon.currentHp > 0,
  );
}

function getAliveAllies(state: BattleState, currentPokemon: PokemonInstance): PokemonInstance[] {
  return [...state.pokemon.values()].filter(
    (pokemon) =>
      pokemon.playerId === currentPokemon.playerId &&
      pokemon.id !== currentPokemon.id &&
      pokemon.currentHp > 0,
  );
}

function findClosestEnemy(from: Position, enemies: PokemonInstance[]): Position {
  let closest = enemies[0]?.position ?? from;
  let minDist = manhattanDistance(from, closest);
  for (let i = 1; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) {
      continue;
    }
    const dist = manhattanDistance(from, enemy.position);
    if (dist < minDist) {
      minDist = dist;
      closest = enemy.position;
    }
  }
  return closest;
}

function closestEnemyManhattanDistance(from: Position, enemies: PokemonInstance[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const distance = manhattanDistance(from, enemy.position);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  return minDistance;
}

function closestDistanceToEnemies(
  from: Position,
  enemies: PokemonInstance[],
  pokemonId: string,
  engine: BattleEngine,
): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const pathDist = engine.computePathDistance(from, enemy.position, pokemonId);
    const dist =
      pathDist === Number.POSITIVE_INFINITY ? manhattanDistance(from, enemy.position) : pathDist;
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}
