import { Category } from "../enums/category";
import { HeldItemId } from "../enums/held-item-id";
import { ScreenKind } from "../enums/screen-kind";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { ScreenAura } from "../types/screen-aura";

export const SCREEN_DEFAULT_DURATION = 5;
export const SCREEN_EXTENDED_DURATION = 8;
export const SCREEN_RADIUS = 3;

export function screenDurationForCaster(caster: PokemonInstance): number {
  return caster.heldItemId === HeldItemId.LightClay
    ? SCREEN_EXTENDED_DURATION
    : SCREEN_DEFAULT_DURATION;
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isWithinScreenRadius(casterPos: Position, targetPos: Position): boolean {
  return manhattanDistance(casterPos, targetPos) <= SCREEN_RADIUS;
}

export function findActiveAurasProtectingTarget(
  state: BattleState,
  target: PokemonInstance,
): ScreenAura[] {
  const protecting: ScreenAura[] = [];
  for (const aura of state.screens) {
    const caster = state.pokemon.get(aura.casterPokemonId);
    if (!caster || caster.currentHp <= 0) {
      continue;
    }
    if (caster.playerId !== target.playerId) {
      continue;
    }
    if (!isWithinScreenRadius(caster.position, target.position)) {
      continue;
    }
    protecting.push(aura);
  }
  return protecting;
}

export function findAurasByCaster(state: BattleState, casterId: string): ScreenAura[] {
  return state.screens.filter((aura) => aura.casterPokemonId === casterId);
}

export function postScreen(
  state: BattleState,
  caster: PokemonInstance,
  kind: ScreenKind,
): ScreenAura {
  const existingIndex = state.screens.findIndex(
    (aura) => aura.casterPokemonId === caster.id && aura.kind === kind,
  );
  const aura: ScreenAura = {
    kind,
    casterPokemonId: caster.id,
    remainingRounds: screenDurationForCaster(caster),
    postedRound: state.roundNumber,
  };
  if (existingIndex >= 0) {
    state.screens[existingIndex] = aura;
  } else {
    state.screens.push(aura);
  }
  return aura;
}

export function removeAurasOfCaster(state: BattleState, casterId: string): ScreenAura[] {
  const removed: ScreenAura[] = [];
  for (let i = state.screens.length - 1; i >= 0; i--) {
    const aura = state.screens[i];
    if (aura && aura.casterPokemonId === casterId) {
      removed.unshift(aura);
      state.screens.splice(i, 1);
    }
  }
  return removed;
}

export interface ExpiredScreenEntry {
  casterId: string;
  kind: ScreenKind;
}

export function decrementScreensTimer(state: BattleState): ExpiredScreenEntry[] {
  const expired: ExpiredScreenEntry[] = [];
  for (const aura of state.screens) {
    aura.remainingRounds -= 1;
  }
  for (let i = state.screens.length - 1; i >= 0; i--) {
    const aura = state.screens[i];
    if (aura && aura.remainingRounds <= 0) {
      expired.unshift({ casterId: aura.casterPokemonId, kind: aura.kind });
      state.screens.splice(i, 1);
    }
  }
  return expired;
}

function screenKindMatchesCategory(kind: ScreenKind, category: Category): boolean {
  if (category === Category.Physical) {
    return kind === ScreenKind.Reflect;
  }
  if (category === Category.Special) {
    return kind === ScreenKind.LightScreen;
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
  const protectingAuras = findActiveAurasProtectingTarget(state, target);
  for (const aura of protectingAuras) {
    if (screenKindMatchesCategory(aura.kind, move.category)) {
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
  _attacker: PokemonInstance,
  target: PokemonInstance,
  move: MoveDefinition,
): BrickBreakInteraction {
  if (move.id !== BRICK_BREAK_MOVE_ID) {
    return { multiplier: 1.0, breakAuraCasterId: null };
  }

  const targetAuras = findAurasByCaster(state, target.id);
  if (targetAuras.length > 0) {
    return { multiplier: 2.0, breakAuraCasterId: target.id };
  }

  return { multiplier: 1.0, breakAuraCasterId: null };
}
