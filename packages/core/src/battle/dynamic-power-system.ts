import { DynamicPowerKind } from "../enums/dynamic-power-kind";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";
import { pendingRolloutIndex, rolloutPowerForIndex } from "./rollout-streak";
import { getEffectiveStat, isMajorStatus } from "./stat-modifier";

interface DynamicPowerInput {
  move: MoveDefinition;
  attacker: PokemonInstance;
  target: PokemonInstance;
  /** Present during real resolution; absent in tooltip previews (state-dependent kinds fall back). */
  battleState?: BattleState;
  /** Present during real resolution; needed by item-driven kinds (fling). */
  itemRegistry?: HeldItemHandlerRegistry;
}

/** True if `stamp` is strictly more recent than the mon's last completed action. */
function happenedSinceLastAction(
  stamp: number | undefined,
  lastActed: number | undefined,
): boolean {
  if (stamp === undefined) {
    return false;
  }
  return stamp > (lastActed ?? -1);
}

type DynamicPowerResolver = (input: DynamicPowerInput) => number;

function hasMajorStatus(pokemon: PokemonInstance): boolean {
  return pokemon.statusEffects.some((effect) => isMajorStatus(effect.type));
}

function isPoisoned(pokemon: PokemonInstance): boolean {
  return pokemon.statusEffects.some(
    (effect) => effect.type === StatusType.Poisoned || effect.type === StatusType.BadlyPoisoned,
  );
}

function isParalyzed(pokemon: PokemonInstance): boolean {
  return pokemon.statusEffects.some((effect) => effect.type === StatusType.Paralyzed);
}

/** In-battle speed including stat stages and the Champions paralysis -50% penalty. */
function effectiveSpeed(pokemon: PokemonInstance): number {
  const withStages = getEffectiveStat(
    pokemon.combatStats.speed,
    pokemon.statStages[StatName.Speed],
  );
  return isParalyzed(pokemon) ? Math.floor(withStages * 0.5) : withStages;
}

function sumPositiveStages(pokemon: PokemonInstance): number {
  let total = 0;
  for (const stat of Object.values(StatName)) {
    const stage = pokemon.statStages[stat];
    if (stage > 0) {
      total += stage;
    }
  }
  return total;
}

/** flail / reversal — power by the user's HP fraction expressed in 48ths. */
function lowHpPower(pokemon: PokemonInstance): number {
  const fraction = pokemon.maxHp > 0 ? Math.floor((48 * pokemon.currentHp) / pokemon.maxHp) : 0;
  if (fraction <= 1) {
    return 200;
  }
  if (fraction <= 4) {
    return 150;
  }
  if (fraction <= 9) {
    return 100;
  }
  if (fraction <= 16) {
    return 80;
  }
  if (fraction <= 32) {
    return 40;
  }
  return 20;
}

/** electro-ball — power by the user/target speed ratio. */
function speedRatioPower(attacker: PokemonInstance, target: PokemonInstance): number {
  const targetSpeed = effectiveSpeed(target);
  if (targetSpeed <= 0) {
    return 150;
  }
  const ratio = effectiveSpeed(attacker) / targetSpeed;
  if (ratio >= 4) {
    return 150;
  }
  if (ratio >= 3) {
    return 120;
  }
  if (ratio >= 2) {
    return 80;
  }
  if (ratio >= 1) {
    return 60;
  }
  return 40;
}

/** gyro-ball — floor(25 * targetSpeed / userSpeed + 1), capped at 150. */
function speedRatioInversePower(attacker: PokemonInstance, target: PokemonInstance): number {
  const userSpeed = effectiveSpeed(attacker);
  if (userSpeed <= 0) {
    return 1;
  }
  return Math.min(150, Math.floor((25 * effectiveSpeed(target)) / userSpeed + 1));
}

/** low-kick / grass-knot — power by the target's body weight in kilograms. */
function targetWeightPower(target: PokemonInstance): number {
  const weight = target.weight;
  if (weight >= 200) {
    return 120;
  }
  if (weight >= 100) {
    return 100;
  }
  if (weight >= 50) {
    return 80;
  }
  if (weight >= 25) {
    return 60;
  }
  if (weight >= 10) {
    return 40;
  }
  return 20;
}

/**
 * heavy-slam / heat-crash — power by how much the user outweighs the target.
 * Uses Showdown's multiplicative comparison (`userWeight >= targetWeight * N`) so the
 * boundaries (e.g. exactly ×3 → 80) match the games exactly.
 */
function weightRatioPower(attacker: PokemonInstance, target: PokemonInstance): number {
  const userWeight = attacker.weight;
  const targetWeight = target.weight;
  if (userWeight >= targetWeight * 5) {
    return 120;
  }
  if (userWeight >= targetWeight * 4) {
    return 100;
  }
  if (userWeight >= targetWeight * 3) {
    return 80;
  }
  if (userWeight >= targetWeight * 2) {
    return 60;
  }
  return 40;
}

/** last-respects — number of the user's teammates that are currently fainted. */
function faintedAllyCount(attacker: PokemonInstance, battleState?: BattleState): number {
  if (!battleState) {
    return 0;
  }
  let count = 0;
  for (const pokemon of battleState.pokemon.values()) {
    if (
      pokemon.id !== attacker.id &&
      pokemon.playerId === attacker.playerId &&
      pokemon.currentHp <= 0
    ) {
      count += 1;
    }
  }
  return count;
}

const RESOLVERS: ReadonlyMap<DynamicPowerKind, DynamicPowerResolver> = new Map([
  [
    DynamicPowerKind.SelfStatusDouble,
    ({ move, attacker }) => (hasMajorStatus(attacker) ? move.power * 2 : move.power),
  ],
  [
    DynamicPowerKind.TargetStatusDouble,
    ({ move, target }) => (hasMajorStatus(target) ? move.power * 2 : move.power),
  ],
  [
    DynamicPowerKind.TargetPoisonedDouble,
    ({ move, target }) => (isPoisoned(target) ? move.power * 2 : move.power),
  ],
  [
    DynamicPowerKind.NoHeldItemDouble,
    ({ move, attacker }) => (attacker.heldItemId === undefined ? move.power * 2 : move.power),
  ],
  [DynamicPowerKind.StoredPower, ({ attacker }) => 20 + 20 * sumPositiveStages(attacker)],
  [DynamicPowerKind.SpeedRatio, ({ attacker, target }) => speedRatioPower(attacker, target)],
  [
    DynamicPowerKind.SpeedRatioInverse,
    ({ attacker, target }) => speedRatioInversePower(attacker, target),
  ],
  [DynamicPowerKind.LowHpSelf, ({ attacker }) => lowHpPower(attacker)],
  [
    DynamicPowerKind.TargetHpHalfDouble,
    ({ move, target }) =>
      target.maxHp > 0 && target.currentHp * 2 <= target.maxHp ? move.power * 2 : move.power,
  ],
  [
    DynamicPowerKind.TargetHpScaled,
    ({ target }) => (target.maxHp > 0 ? Math.floor((100 * target.currentHp) / target.maxHp) : 0),
  ],
  [
    DynamicPowerKind.SelfHpScaled,
    ({ attacker }) =>
      attacker.maxHp > 0 ? Math.floor((150 * attacker.currentHp) / attacker.maxHp) : 0,
  ],
  [DynamicPowerKind.TargetWeight, ({ target }) => targetWeightPower(target)],
  [DynamicPowerKind.WeightRatio, ({ attacker, target }) => weightRatioPower(attacker, target)],
  [
    DynamicPowerKind.DamagedByEnemySinceLastAction,
    ({ move, attacker }) =>
      happenedSinceLastAction(attacker.lastDamagedByEnemyAtAction, attacker.lastActedAtAction)
        ? move.power * 2
        : move.power,
  ],
  [
    DynamicPowerKind.TargetDamagedSinceLastAction,
    ({ move, target }) =>
      happenedSinceLastAction(target.lastDamagedAtAction, target.lastActedAtAction)
        ? move.power * 2
        : move.power,
  ],
  [
    DynamicPowerKind.TimesHitScaled,
    ({ move, attacker }) => Math.min(350, move.power + 50 * Math.min(6, attacker.timesHit ?? 0)),
  ],
  [
    DynamicPowerKind.AllyFaintedSinceLastAction,
    ({ move, attacker, battleState }) => {
      const faintStamp = battleState?.lastAllyFaintAtAction?.[attacker.playerId];
      return happenedSinceLastAction(faintStamp, attacker.lastActedAtAction)
        ? move.power * 2
        : move.power;
    },
  ],
  [
    DynamicPowerKind.PreviousMoveFailedDouble,
    ({ move, attacker }) => (attacker.lastMoveFailed === true ? move.power * 2 : move.power),
  ],
  [
    DynamicPowerKind.EchoCrescendo,
    ({ battleState }) => Math.min(200, 40 * Math.max(1, battleState?.echoStreak ?? 1)),
  ],
  [
    DynamicPowerKind.TeamPreviousMoveDouble,
    ({ move, attacker, battleState }) =>
      battleState?.lastTeamActionMoveId?.[attacker.playerId] === move.id
        ? move.power * 2
        : move.power,
  ],
  [
    DynamicPowerKind.RolloutStreak,
    ({ move, attacker }) => rolloutPowerForIndex(pendingRolloutIndex(attacker, move.id)),
  ],
  [
    DynamicPowerKind.AllyFaintCountScaled,
    ({ move, attacker, battleState }) => move.power * (1 + faintedAllyCount(attacker, battleState)),
  ],
  [
    DynamicPowerKind.TargetIdleSinceLastAction,
    ({ move, attacker, target }) =>
      (target.lastActedAtAction ?? -1) <= (attacker.lastActedAtAction ?? -1)
        ? move.power * 2
        : move.power,
  ],
  [
    DynamicPowerKind.HeldItemFling,
    ({ attacker, itemRegistry }) => itemRegistry?.get(attacker.heldItemId ?? "")?.flingPower ?? 0,
  ],
]);

/**
 * Returns the move unchanged when it has no `dynamicPower`, otherwise a clone whose `power`
 * is recomputed from battle state (clamped to a minimum of 1 so damage is never skipped).
 */
export function resolveDynamicPower(
  move: MoveDefinition,
  attacker: PokemonInstance,
  target: PokemonInstance,
  battleState?: BattleState,
  itemRegistry?: HeldItemHandlerRegistry,
): MoveDefinition {
  if (!move.dynamicPower) {
    return move;
  }
  const resolver = RESOLVERS.get(move.dynamicPower.kind);
  if (!resolver) {
    return move;
  }
  const power = Math.max(1, resolver({ move, attacker, target, battleState, itemRegistry }));
  return { ...move, power };
}

/**
 * Power value to use when classifying a move as "damaging" without a battle context
 * (AI heuristics, threat detection). A move with `dynamicPower` may have a reference
 * `power` of 0 yet always deals damage, so treat it as at least 1.
 */
export function getEffectivePowerFloor(move: MoveDefinition): number {
  if (move.dynamicPower) {
    return Math.max(1, move.power);
  }
  return move.power;
}
