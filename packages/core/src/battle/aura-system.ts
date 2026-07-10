import { AuraKind } from "../enums/aura-kind";
import { Category } from "../enums/category";
import { HeldItemId } from "../enums/held-item-id";
import { StatusType } from "../enums/status-type";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TeamAura } from "../types/team-aura";
import { effectiveAbilityId } from "./effective-ability";

export const AURA_DEFAULT_DURATION = 5;
export const AURA_EXTENDED_DURATION = 8;
export const AURA_RADIUS = 3;

export function auraDurationForCaster(caster: PokemonInstance, kind: AuraKind): number {
  if (kind === AuraKind.Reflect || kind === AuraKind.LightScreen) {
    return caster.heldItemId === HeldItemId.LightClay
      ? AURA_EXTENDED_DURATION
      : AURA_DEFAULT_DURATION;
  }
  return AURA_DEFAULT_DURATION;
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isWithinAuraRadius(casterPos: Position, targetPos: Position): boolean {
  return manhattanDistance(casterPos, targetPos) <= AURA_RADIUS;
}

export function findActiveAurasProtectingTarget(
  state: BattleState,
  target: PokemonInstance,
  kindFilter?: AuraKind,
): TeamAura[] {
  const protecting: TeamAura[] = [];
  for (const aura of state.auras) {
    if (kindFilter !== undefined && aura.kind !== kindFilter) {
      continue;
    }
    const caster = state.pokemon.get(aura.casterPokemonId);
    if (!caster || caster.currentHp <= 0) {
      continue;
    }
    if (caster.playerId !== target.playerId) {
      continue;
    }
    if (!isWithinAuraRadius(caster.position, target.position)) {
      continue;
    }
    protecting.push(aura);
  }
  return protecting;
}

export function findAurasByCaster(state: BattleState, casterId: string): TeamAura[] {
  return state.auras.filter((aura) => aura.casterPokemonId === casterId);
}

export function postAura(state: BattleState, caster: PokemonInstance, kind: AuraKind): TeamAura {
  const existingIndex = state.auras.findIndex(
    (aura) => aura.casterPokemonId === caster.id && aura.kind === kind,
  );
  const aura: TeamAura = {
    kind,
    casterPokemonId: caster.id,
    remainingRounds: auraDurationForCaster(caster, kind),
    postedAtAction: state.actionCounter ?? 0,
  };
  if (existingIndex >= 0) {
    state.auras[existingIndex] = aura;
  } else {
    state.auras.push(aura);
  }
  return aura;
}

export function removeAurasOfCaster(state: BattleState, casterId: string): TeamAura[] {
  const removed: TeamAura[] = [];
  for (let i = state.auras.length - 1; i >= 0; i--) {
    const aura = state.auras[i];
    if (aura && aura.casterPokemonId === casterId) {
      removed.unshift(aura);
      state.auras.splice(i, 1);
    }
  }
  return removed;
}

export interface ExpiredAuraEntry {
  casterId: string;
  kind: AuraKind;
}

/**
 * Decrement the timers of the auras posted by `casterId` (CT "tours du lanceur" model: an aura
 * counts down on its caster's own turns). Remove and report the ones that reached zero.
 */
export function decrementAurasTimer(state: BattleState, casterId: string): ExpiredAuraEntry[] {
  const expired: ExpiredAuraEntry[] = [];
  for (const aura of state.auras) {
    if (aura.casterPokemonId === casterId) {
      aura.remainingRounds -= 1;
    }
  }
  for (let i = state.auras.length - 1; i >= 0; i--) {
    const aura = state.auras[i];
    if (aura && aura.casterPokemonId === casterId && aura.remainingRounds <= 0) {
      expired.unshift({ casterId: aura.casterPokemonId, kind: aura.kind });
      state.auras.splice(i, 1);
    }
  }
  return expired;
}

function damageScreenMatchesCategory(kind: AuraKind, category: Category): boolean {
  if (category === Category.Physical) {
    return kind === AuraKind.Reflect;
  }
  if (category === Category.Special) {
    return kind === AuraKind.LightScreen;
  }
  return false;
}

export function computeScreenMultiplier(
  state: BattleState,
  attacker: PokemonInstance,
  target: PokemonInstance,
  move: MoveDefinition,
): number {
  if (move.category === Category.Status) {
    return 1.0;
  }
  if (attacker.playerId === target.playerId) {
    return 1.0;
  }
  // Infiltration (infiltrator): the holder's moves pierce Mur Lumière / Protection.
  if (effectiveAbilityId(attacker) === "infiltrator") {
    return 1.0;
  }
  const protectingAuras = findActiveAurasProtectingTarget(state, target);
  for (const aura of protectingAuras) {
    if (damageScreenMatchesCategory(aura.kind, move.category)) {
      return 0.5;
    }
  }
  return 1.0;
}

export const BRICK_BREAK_MOVE_ID = "brick-break";

export interface BrickBreakInteraction {
  multiplier: number;
  breakAuraCasterId: string | null;
}

export function computeBrickBreakInteraction(
  state: BattleState,
  target: PokemonInstance,
  move: MoveDefinition,
): BrickBreakInteraction {
  if (move.id !== BRICK_BREAK_MOVE_ID) {
    return { multiplier: 1.0, breakAuraCasterId: null };
  }

  const targetAuras = findAurasByCaster(state, target.id).filter(
    (aura) => aura.kind === AuraKind.Reflect || aura.kind === AuraKind.LightScreen,
  );
  if (targetAuras.length > 0) {
    return { multiplier: 2.0, breakAuraCasterId: target.id };
  }

  return { multiplier: 1.0, breakAuraCasterId: null };
}

const SAFEGUARD_BLOCKED_STATUSES = new Set<StatusType>([
  StatusType.Burned,
  StatusType.Paralyzed,
  StatusType.Poisoned,
  StatusType.BadlyPoisoned,
  StatusType.Asleep,
  StatusType.Frozen,
  StatusType.Confused,
]);

export interface AuraProtectionResult {
  protected: boolean;
  casterId?: string;
}

function resolveAuraProtection(
  state: BattleState,
  attacker: PokemonInstance,
  target: PokemonInstance,
  kind: AuraKind,
): AuraProtectionResult {
  if (attacker.id === target.id) {
    return { protected: false };
  }
  // Infiltration (infiltrator): the holder's moves pierce Voile Sacré (Safeguard) and Brume (Mist).
  if (effectiveAbilityId(attacker) === "infiltrator") {
    return { protected: false };
  }
  const auras = findActiveAurasProtectingTarget(state, target, kind);
  if (auras.length === 0) {
    return { protected: false };
  }
  return { protected: true, casterId: auras[0]?.casterPokemonId };
}

export function isProtectedFromStatDecrease(
  state: BattleState,
  attacker: PokemonInstance,
  target: PokemonInstance,
): AuraProtectionResult {
  return resolveAuraProtection(state, attacker, target, AuraKind.Mist);
}

export function isProtectedFromStatus(
  state: BattleState,
  attacker: PokemonInstance,
  target: PokemonInstance,
  status: StatusType,
): AuraProtectionResult {
  if (!SAFEGUARD_BLOCKED_STATUSES.has(status)) {
    return { protected: false };
  }
  return resolveAuraProtection(state, attacker, target, AuraKind.Safeguard);
}
