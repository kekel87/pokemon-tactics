import type { MoveDefinition } from "../types/move-definition";
import type { PokemonDefinition } from "../types/pokemon-definition";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBattleData(data: {
  pokemon: PokemonDefinition[];
  moves: MoveDefinition[];
}): ValidationResult {
  const errors: string[] = [];

  const moveIds = new Set<string>();
  for (const move of data.moves) {
    if (moveIds.has(move.id)) {
      errors.push(`Duplicate move id: ${move.id}`);
    }
    moveIds.add(move.id);

    if (!move.targeting) {
      errors.push(`Move ${move.id} has no targeting pattern`);
    }

    if (!move.effects || move.effects.length === 0) {
      errors.push(`Move ${move.id} has no effects`);
    }

    if (move.power < 0) {
      errors.push(`Move ${move.id} has negative power: ${move.power}`);
    }

    if (move.accuracy < 0 || move.accuracy > 100) {
      errors.push(`Move ${move.id} has invalid accuracy: ${move.accuracy}`);
    }

    if (move.pp <= 0) {
      errors.push(`Move ${move.id} has invalid pp: ${move.pp}`);
    }

    if (move.targeting && "range" in move.targeting) {
      const range = move.targeting.range;
      if (range.min > range.max) {
        errors.push(`Move ${move.id} has range min (${range.min}) > max (${range.max})`);
      }
    }

    if (move.targeting && "radius" in move.targeting) {
      if (move.targeting.radius < 0) {
        errors.push(`Move ${move.id} has negative radius: ${move.targeting.radius}`);
      }
    }
  }

  const pokemonIds = new Set<string>();
  for (const pokemon of data.pokemon) {
    if (pokemonIds.has(pokemon.id)) {
      errors.push(`Duplicate pokemon id: ${pokemon.id}`);
    }
    pokemonIds.add(pokemon.id);

    if (pokemon.movepool.length === 0) {
      errors.push(`Pokemon ${pokemon.id} has empty movepool`);
    }

    for (const moveId of pokemon.movepool) {
      if (!moveIds.has(moveId)) {
        errors.push(`Pokemon ${pokemon.id} references unknown move: ${moveId}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
