import type { MoveDefinition, PokemonDefinition } from "@pokemon-tactic/core";
import movesReference from "../reference/moves.json";
import pokemonReference from "../reference/pokemon.json";
import { loadMovesFromReference } from "./loaders/load-moves";
import { loadPokemonFromReference } from "./loaders/load-pokemon";
import type { ReferenceMove, ReferencePokemon } from "./loaders/reference-types";
import { deepMerge } from "./merge";
import { balanceOverrides } from "./overrides/balance-v1";
import { tacticalOverrides } from "./overrides/tactical";
import { rosterPoc } from "./roster/roster-poc";

export interface GameData {
  pokemon: PokemonDefinition[];
  moves: MoveDefinition[];
}

export function loadData(): GameData {
  const roster = rosterPoc;

  const pokemon: PokemonDefinition[] = loadPokemonFromReference(
    pokemonReference as unknown as ReferencePokemon[],
    roster,
  );

  const allMoveIds = new Set<string>();
  for (const entry of roster) {
    for (const moveId of entry.movepool) {
      allMoveIds.add(moveId);
    }
  }
  for (const moveId of Object.keys(tacticalOverrides)) {
    allMoveIds.add(moveId);
  }

  const baseMoves = loadMovesFromReference(
    movesReference as unknown as ReferenceMove[],
    allMoveIds,
  );

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
      ...(merged.recharge ? { recharge: true } : {}),
      ...(merged.ignoresHeight ? { ignoresHeight: true } : {}),
      ...(merged.flags ? { flags: merged.flags } : {}),
      ...(merged.effectTier ? { effectTier: merged.effectTier } : {}),
    };
    return moveDefinition;
  });

  return { pokemon, moves };
}
