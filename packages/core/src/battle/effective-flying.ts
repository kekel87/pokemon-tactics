import { HeldItemId } from "../enums/held-item-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { effectiveAbilityId } from "./effective-ability";
import { isEffectivelyGrounded, isHeldItemSuppressed } from "./field-global-system";

export function isRoosted(pokemon: PokemonInstance): boolean {
  return pokemon.volatileStatuses.some((v) => v.type === StatusType.Roosted);
}

/** Ingrain (Racines) roots the mon to the ground while active (B2 healing). */
export function isIngrained(pokemon: PokemonInstance): boolean {
  return pokemon.volatileStatuses.some((v) => v.type === StatusType.Ingrain);
}

/**
 * Override-aware base types of an instance. Priority (#656): the runtime `typeOverride` (type-manip
 * family) wins over a Morphing/Imposteur copy (`transformState.types`, plan 157), which wins over the
 * species types from `pokemonTypesMap`. This is THE single point every type read must go through so a
 * mutated type (Conversion, Détrempage, Flamme Ultime, Morphing…) propagates to STAB, effectiveness,
 * terrain, hazards and status immunity. Roost filtering is layered separately via `getEffectiveTypes`.
 */
export function resolveBaseTypes(
  pokemon: PokemonInstance,
  pokemonTypesMap: ReadonlyMap<string, PokemonType[]>,
): PokemonType[] {
  return (
    pokemon.typeOverride ??
    pokemon.transformState?.types ??
    pokemonTypesMap.get(pokemon.definitionId) ??
    []
  );
}

export function getEffectiveTypes(
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
): PokemonType[] {
  if (isRoosted(pokemon)) {
    return types.filter((t) => t !== PokemonType.Flying);
  }
  return [...types];
}

function isNaturallyAirborne(
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
  holdsActiveBalloon: boolean,
): boolean {
  // Roost strips the Flying type entirely for the turn; Ingrain only grounds (keeps the type
  // defensively but removes Ground immunity / Levitate / Magnet Rise / Ballon while rooted).
  if (isRoosted(pokemon) || isIngrained(pokemon)) {
    return false;
  }
  // Ballon (air-balloon): holder floats — same airborne treatment as Lévitation (terrain, hazards
  // au sol, knockback). Reverts the instant the balloon pops (heldItemId cleared on the hit).
  return (
    types.includes(PokemonType.Flying) ||
    effectiveAbilityId(pokemon) === "levitate" ||
    holdsActiveBalloon ||
    // Vol Magnétik (magnet-rise, plan 154): temporary levitation.
    (pokemon.magnetRiseTurns ?? 0) > 0
  );
}

/**
 * Airborne by nature at `position` (Vol, Lévitation, Ballon, Vol Magnétik). A Zone Magique covering
 * `position` suppresses the Ballon (plan 249). Gravité / Anti-Air are NOT applied here: see
 * `isAirborneAt`.
 */
export function isEffectivelyFlying(
  state: BattleState,
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
  position: Position = pokemon.position,
): boolean {
  const holdsActiveBalloon =
    pokemon.heldItemId === HeldItemId.AirBalloon && !isHeldItemSuppressed(state, pokemon, position);
  return isNaturallyAirborne(pokemon, types, holdsActiveBalloon);
}

/** Airborne with no zone anywhere: whether the mon's sprite can ever hover. */
export function isAirborneIgnoringZones(
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
): boolean {
  return isNaturallyAirborne(pokemon, types, pokemon.heldItemId === HeldItemId.AirBalloon);
}

/**
 * The full airborne status of `pokemon` were it standing on `position`: airborne by nature there, and
 * not grounded by a Gravité zone covering `position` or by Anti-Air. Every per-tile movement rule
 * (enter, stop, terrain, entry hazards, landing) reads this, so a zone crossed mid-path counts.
 */
export function isAirborneAt(
  state: BattleState,
  pokemon: PokemonInstance,
  types: readonly PokemonType[],
  position: Position = pokemon.position,
): boolean {
  return (
    !isEffectivelyGrounded(state, pokemon, position) &&
    isEffectivelyFlying(state, pokemon, types, position)
  );
}

/**
 * Types used for TERRAIN immunity on `position`. A mon grounded there (Gravité, Anti-Air) loses its
 * Flying-type terrain immunity too, so it can no longer cross or rest on lava, nor overfly obstacles.
 * Other type resistances (Fire vs Magma, Water vs Water…) are physical and stay.
 */
export function terrainTypesAt(
  state: BattleState,
  pokemon: PokemonInstance,
  types: PokemonType[],
  position: Position = pokemon.position,
): PokemonType[] {
  return isEffectivelyGrounded(state, pokemon, position)
    ? types.filter((type) => type !== PokemonType.Flying)
    : types;
}
