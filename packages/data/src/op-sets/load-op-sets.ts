import type { HeldItemId, Nature, PokemonGender, StatSpread } from "@pokemon-tactic/core";
import opSetsJson from "../../op-sets/op-sets.json" with { type: "json" };

export interface OpSet {
  id: string;
  pokemonId: string;
  name: string;
  role: string;
  ability: string;
  heldItemId: HeldItemId | null;
  nature: Nature;
  moveIds: string[];
  statSpread: Partial<StatSpread>;
  gender: PokemonGender | "genderless" | null;
  source: string;
  sourceUrl?: string;
  notes?: string;
}

interface OpSetsFile {
  schemaVersion: number;
  sets: OpSet[];
}

const data = opSetsJson as unknown as OpSetsFile;

export function getAllOpSets(): readonly OpSet[] {
  return data.sets;
}

export function getOpSetsForPokemon(pokemonId: string): OpSet[] {
  return data.sets.filter((set) => set.pokemonId === pokemonId);
}
