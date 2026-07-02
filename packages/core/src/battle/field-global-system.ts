import { FieldGlobalKind } from "../enums/field-global-kind";
import type { BattleState } from "../types/battle-state";
import type { FieldGlobalZone } from "../types/field-global-zone";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { SemiInvulnerableState } from "../types/semi-invulnerable-state";
import { enumerateZoneTiles } from "./field-terrain-system";

export const FIELD_GLOBAL_DEFAULT_DURATION = 5;
export const FIELD_GLOBAL_RADIUS = 3;
/** Gravité boosts the accuracy of attacks against a target standing in the zone (canon ×5/3). */
export const GRAVITY_ACCURACY_MULTIPLIER = 5 / 3;

function zoneContains(zone: FieldGlobalZone, position: Position): boolean {
  return zone.tiles.some((tile) => tile.x === position.x && tile.y === position.y);
}

/** True if any active field-global zone of `kind` covers `position`. */
export function isInFieldGlobalZone(
  state: BattleState,
  position: Position,
  kind: FieldGlobalKind,
): boolean {
  return state.fieldGlobalZones.some((zone) => zone.kind === kind && zoneContains(zone, position));
}

/**
 * Post a field-global zone centered on the caster's current tile (mirror of `postDistortion`):
 * zones of different kinds (or same kind at different epicenters) coexist, but posting the SAME kind
 * on the EXACT epicenter of an existing same-kind zone REPLACES it (refreshes the timer).
 */
export function postFieldGlobalZone(
  state: BattleState,
  caster: PokemonInstance,
  kind: FieldGlobalKind,
): FieldGlobalZone {
  const anchor: Position = { x: caster.position.x, y: caster.position.y };
  for (let i = state.fieldGlobalZones.length - 1; i >= 0; i--) {
    const existing = state.fieldGlobalZones[i];
    if (
      existing &&
      existing.kind === kind &&
      existing.anchor.x === anchor.x &&
      existing.anchor.y === anchor.y
    ) {
      state.fieldGlobalZones.splice(i, 1);
    }
  }
  const zone: FieldGlobalZone = {
    kind,
    casterId: caster.id,
    tiles: enumerateZoneTiles(state, anchor, FIELD_GLOBAL_RADIUS),
    anchor,
    remainingTurns: FIELD_GLOBAL_DEFAULT_DURATION,
  };
  state.fieldGlobalZones.push(zone);
  return zone;
}

export interface ExpiredFieldGlobalZone {
  kind: FieldGlobalKind;
  casterId: string;
}

/**
 * Decrement the timers of the field-global zones posted by `casterId` (CT "tours du lanceur" model:
 * counts down on the caster's own turns — or, after KO, on its ghost turns). Remove and report the
 * zones that reached zero.
 */
export function decrementFieldGlobalTimer(
  state: BattleState,
  casterId: string,
): ExpiredFieldGlobalZone[] {
  const expired: ExpiredFieldGlobalZone[] = [];
  for (const zone of state.fieldGlobalZones) {
    if (zone.casterId === casterId) {
      zone.remainingTurns -= 1;
    }
  }
  for (let i = state.fieldGlobalZones.length - 1; i >= 0; i--) {
    const zone = state.fieldGlobalZones[i];
    if (zone && zone.casterId === casterId && zone.remainingTurns <= 0) {
      expired.unshift({ kind: zone.kind, casterId: zone.casterId });
      state.fieldGlobalZones.splice(i, 1);
    }
  }
  return expired;
}

/** True if the held item of `pokemon` is suppressed (the holder stands in a Zone Magique). */
export function isHeldItemSuppressed(state: BattleState, pokemon: PokemonInstance): boolean {
  return isInFieldGlobalZone(state, pokemon.position, FieldGlobalKind.MagicRoom);
}

/** True if `pokemon` is grounded by a Gravité zone it currently stands in (loses airborne status). */
export function isGroundedByGravityZone(state: BattleState, pokemon: PokemonInstance): boolean {
  return isInFieldGlobalZone(state, pokemon.position, FieldGlobalKind.Gravity);
}

/**
 * True if a move cannot be launched from within a Gravité zone: airborne charge moves (Vol / Rebond,
 * detected via their Flying semi-invulnerable state) and explicitly tagged jump/levitation moves
 * (Pied Voltige). Underground/underwater moves (Tunnel / Plongée) are NOT airborne and stay legal.
 */
export function isAirborneMove(move: MoveDefinition): boolean {
  return (
    move.disabledUnderGravity === true ||
    move.semiInvulnerableState === SemiInvulnerableState.Flying
  );
}
