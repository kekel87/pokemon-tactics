import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";

export function hasSubstitute(pokemon: PokemonInstance): boolean {
  return pokemon.substituteHp !== undefined && pokemon.substituteHp > 0;
}

export function bypassesSubstitute(move: MoveDefinition): boolean {
  return move.flags?.sound === true || move.flags?.bypasssub === true;
}

export function computeSubstituteHp(maxHp: number): number {
  return Math.floor(maxHp / 4);
}

export interface SubstituteAbsorptionResult {
  absorbed: number;
  broken: boolean;
}

export function applySubstituteAbsorption(
  target: PokemonInstance,
  incomingDamage: number,
): SubstituteAbsorptionResult {
  if (target.substituteHp === undefined) {
    return { absorbed: 0, broken: false };
  }
  const absorbed = Math.min(incomingDamage, target.substituteHp);
  target.substituteHp -= absorbed;
  const broken = target.substituteHp <= 0;
  if (broken) {
    target.substituteHp = undefined;
  }
  return { absorbed, broken };
}

export function shouldSubstituteBlock(
  attacker: PokemonInstance,
  target: PokemonInstance,
  move: MoveDefinition,
): boolean {
  if (!hasSubstitute(target)) {
    return false;
  }
  if (attacker.id === target.id) {
    return false;
  }
  if (bypassesSubstitute(move)) {
    return false;
  }
  // Infiltration (infiltrator): the holder's moves bypass the target's substitute.
  if (attacker.abilityId === "infiltrator") {
    return false;
  }
  return true;
}
