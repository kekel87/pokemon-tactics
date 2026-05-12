import type { ReferencePokemon } from "../loaders/reference-types";

interface ResolverCaches {
  legalMovesByPokemonId: Map<string, ReadonlySet<string>>;
  speciesRootByPokemonId: Map<string, string>;
}

const caches: ResolverCaches = {
  legalMovesByPokemonId: new Map(),
  speciesRootByPokemonId: new Map(),
};

let referenceIndex: Map<string, ReferencePokemon> | null = null;

function buildIndex(reference: readonly ReferencePokemon[]): Map<string, ReferencePokemon> {
  const index = new Map<string, ReferencePokemon>();
  for (const entry of reference) {
    index.set(entry.id, entry);
  }
  return index;
}

export function initializeLearnsetResolver(reference: readonly ReferencePokemon[]): void {
  referenceIndex = buildIndex(reference);
  caches.legalMovesByPokemonId.clear();
  caches.speciesRootByPokemonId.clear();
}

function ensureIndex(): Map<string, ReferencePokemon> {
  if (referenceIndex === null) {
    throw new Error(
      "Learnset resolver not initialized. Call initializeLearnsetResolver(reference) first.",
    );
  }
  return referenceIndex;
}

export function getLegalMoves(pokemonId: string): ReadonlySet<string> {
  const cached = caches.legalMovesByPokemonId.get(pokemonId);
  if (cached) {
    return cached;
  }
  const index = ensureIndex();
  const result = new Set<string>();
  const visited = new Set<string>();
  let current: string | null = pokemonId;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    const reference = index.get(current);
    if (reference === undefined) {
      break;
    }
    for (const entry of reference.learnset.levelUp) {
      result.add(entry.move);
    }
    for (const move of reference.learnset.tm) {
      result.add(move);
    }
    for (const move of reference.learnset.tutor) {
      result.add(move);
    }
    current = reference.evolvesFrom;
  }
  caches.legalMovesByPokemonId.set(pokemonId, result);
  return result;
}

export function getSpeciesRoot(pokemonId: string): string {
  const cached = caches.speciesRootByPokemonId.get(pokemonId);
  if (cached !== undefined) {
    return cached;
  }
  const index = ensureIndex();
  const visited = new Set<string>();
  let current = pokemonId;
  let last = pokemonId;
  while (!visited.has(current)) {
    visited.add(current);
    const reference = index.get(current);
    if (reference === undefined) {
      break;
    }
    last = reference.id;
    if (reference.evolvesFrom === null) {
      break;
    }
    current = reference.evolvesFrom;
  }
  caches.speciesRootByPokemonId.set(pokemonId, last);
  return last;
}

export function getLegalAbilities(pokemonId: string): readonly string[] {
  const index = ensureIndex();
  const reference = index.get(pokemonId);
  if (reference === undefined) {
    return [];
  }
  const abilities: string[] = [];
  if (reference.abilities.ability1 !== null) {
    abilities.push(reference.abilities.ability1);
  }
  if (reference.abilities.ability2 !== null) {
    abilities.push(reference.abilities.ability2);
  }
  if (reference.abilities.hidden !== null) {
    abilities.push(reference.abilities.hidden);
  }
  return abilities;
}

export function resetLearnsetResolverForTests(): void {
  referenceIndex = null;
  caches.legalMovesByPokemonId.clear();
  caches.speciesRootByPokemonId.clear();
}
