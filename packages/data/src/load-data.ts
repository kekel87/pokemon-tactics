import type { MoveDefinition, PokemonDefinition } from "@pokemon-tactic/core";
import { baseMoves } from "./base/moves";
import { basePokemon } from "./base/pokemon";
import { deepMerge } from "./merge";
import { balanceOverrides } from "./overrides/balance-v1";
import { tacticalOverrides } from "./overrides/tactical";

export interface GameData {
  pokemon: PokemonDefinition[];
  moves: MoveDefinition[];
}

export function loadData(): GameData {
  const pokemon: PokemonDefinition[] = basePokemon.map((base) => ({
    ...base,
    id: base.name.toLowerCase(),
  }));

  const moves: MoveDefinition[] = baseMoves.map((base) => {
    const tactical = tacticalOverrides[base.id];
    if (!tactical) {
      throw new Error(`Missing tactical override for move: ${base.id}`);
    }
    const balance = balanceOverrides[base.id] ?? {};
    const baseWithTactical = { ...base, ...tactical };
    const merged = deepMerge(baseWithTactical, balance);
    const moveDefinition: MoveDefinition = {
      id: merged.id,
      name: merged.name,
      type: merged.type,
      category: merged.category,
      power: merged.power,
      accuracy: merged.accuracy,
      pp: merged.pp,
      targeting: merged.targeting,
      effects: merged.effects,
    };
    return moveDefinition;
  });

  return { pokemon, moves };
}
