import { BattleEventType } from "../enums/battle-event-type";
import { FieldTerrain } from "../enums/field-terrain";
import type { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import { ProtectionReason } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { isOnFieldTerrain } from "./field-terrain-system";
import { wakeSleepersInUproarRadius } from "./uproar-aura";

/** A move that forces the caster to repeat it for several turns (Mania / Colère / Brouhaha…). */
export function isLockInMove(move: MoveDefinition): boolean {
  return move.lockIn !== undefined;
}

/**
 * Advance the caster's lock-in state AFTER it has used `move` (post-resolution, in `executeUseMove`).
 * On the first cast rolls the duration and locks the mon into the move (filtered in `getLegalActions`
 * + guarded in `submitAction` via `lockInMoveId`). Each cast decrements; when it reaches 0 the lock
 * clears and, for `confuseOnEnd` moves, the caster is confused (canon rampage downside). Runs whatever
 * the outcome of the cast (a miss still consumes a locked turn). Returns the events to emit.
 */
export function resolveLockIn(
  caster: PokemonInstance,
  move: MoveDefinition,
  random: () => number,
  state: BattleState,
  casterTypes: readonly PokemonType[],
): BattleEvent[] {
  const lockIn = move.lockIn;
  if (lockIn === undefined) {
    return [];
  }
  const events: BattleEvent[] = [];

  const alreadyLocked = caster.lockInMoveId === move.id && (caster.lockInTurnsRemaining ?? 0) > 0;
  if (!alreadyLocked) {
    const span = lockIn.maxTurns - lockIn.minTurns;
    const turns = lockIn.minTurns + (span > 0 ? Math.floor(random() * (span + 1)) : 0);
    caster.lockInMoveId = move.id;
    caster.lockInTurnsRemaining = turns;
    events.push({
      type: BattleEventType.LockInStarted,
      pokemonId: caster.id,
      moveId: move.id,
      turns,
    });
    // Brouhaha: the din rouses any sleeper in range the instant it starts.
    if (move.uproarAura === true) {
      events.push(...wakeSleepersInUproarRadius(state, caster));
    }
  }

  caster.lockInTurnsRemaining = (caster.lockInTurnsRemaining ?? 1) - 1;

  if ((caster.lockInTurnsRemaining ?? 0) <= 0) {
    caster.lockInMoveId = undefined;
    caster.lockInTurnsRemaining = undefined;
    if (lockIn.confuseOnEnd) {
      events.push(...applyLockInConfusion(caster, random, state, casterTypes));
    }
  }

  return events;
}

/**
 * Self-confusion at the end of a rampage. Skips if the caster is already confused; respects Terrain
 * Brumeux immunity (grounded caster on a Misty zone). Confusion duration matches `handleStatus` (1-4).
 */
function applyLockInConfusion(
  caster: PokemonInstance,
  random: () => number,
  state: BattleState,
  casterTypes: readonly PokemonType[],
): BattleEvent[] {
  if (caster.volatileStatuses.some((volatile) => volatile.type === StatusType.Confused)) {
    return [];
  }
  if (isOnFieldTerrain(state, caster, casterTypes, FieldTerrain.Misty)) {
    return [
      {
        type: BattleEventType.StatusBlocked,
        pokemonId: caster.id,
        status: StatusType.Confused,
        reason: ProtectionReason.MistyTerrain,
      },
    ];
  }
  caster.volatileStatuses.push({
    type: StatusType.Confused,
    remainingTurns: Math.floor(random() * 4) + 1,
  });
  return [
    { type: BattleEventType.StatusApplied, targetId: caster.id, status: StatusType.Confused },
  ];
}
