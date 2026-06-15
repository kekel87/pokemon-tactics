import type { HeldItemId, MoveDefinition, PokemonDefinition } from "@pokemon-tactic/core";
import {
  buildTeamBuilderRegistry,
  type CatalogAbility,
  type CatalogItem,
  type CatalogMove,
  type CatalogPokemonAbilities,
  getAllOpSets,
  getCatalogAbilities,
  getCatalogItems,
  getCatalogMoves,
  getOpSetsForPokemon,
  getPokemonAbilities,
  getPokemonName,
  loadData,
  type OpSet,
  playablePokemon,
  type TeamBuilderRegistry,
} from "@pokemon-tactic/data";
import { getLanguage } from "../i18n";

export interface PlayablePokemon {
  id: string;
  dexNumber: number;
  name: string;
  types: readonly string[];
  abilities: CatalogPokemonAbilities;
  definition: PokemonDefinition;
}

export interface AvailableMove {
  id: string;
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  shortDescription: string;
}

export interface AvailableItem {
  id: HeldItemId;
  name: string;
  category: string;
  shortDescription: string;
  implemented: boolean;
}

export interface AvailableAbility {
  id: string;
  name: string;
  shortDescription: string;
  implemented: boolean;
}

interface TeamBuilderDataCache {
  registry: TeamBuilderRegistry;
  pokemonById: Map<string, PlayablePokemon>;
  playable: PlayablePokemon[];
  moveById: Map<string, AvailableMove>;
  abilityById: Map<string, AvailableAbility>;
  itemById: Map<HeldItemId, AvailableItem>;
  allItems: AvailableItem[];
  allMoves: AvailableMove[];
  moveDefById: Map<string, MoveDefinition>;
}

let cache: TeamBuilderDataCache | null = null;
let cachedLanguage: string | null = null;

function pickLocalized(localized: { en: string; fr: string }): string {
  return getLanguage() === "fr" ? localized.fr : localized.en;
}

function build(): TeamBuilderDataCache {
  const gameData = loadData();
  const registry = buildTeamBuilderRegistry();

  const moveDefById = new Map<string, MoveDefinition>();
  for (const move of gameData.moves) {
    moveDefById.set(move.id, move);
  }

  const playable: PlayablePokemon[] = [];
  const pokemonById = new Map<string, PlayablePokemon>();
  const pokemonDefById = new Map<string, PokemonDefinition>();
  for (const def of gameData.pokemon) {
    pokemonDefById.set(def.id, def);
  }
  for (const entry of playablePokemon) {
    if (entry.id === "dummy") {
      continue;
    }
    const def = pokemonDefById.get(entry.id);
    if (def === undefined) {
      continue;
    }
    const playableMon: PlayablePokemon = {
      id: entry.id,
      dexNumber: def.dexNumber ?? 0,
      name: getPokemonName(entry.id, getLanguage()),
      types: def.types,
      abilities: getPokemonAbilities(entry.id),
      definition: def,
    };
    playable.push(playableMon);
    pokemonById.set(entry.id, playableMon);
  }
  playable.sort((a, b) => a.dexNumber - b.dexNumber);

  const moveById = new Map<string, AvailableMove>();
  const allMoves: AvailableMove[] = [];
  for (const m of getCatalogMoves() as readonly CatalogMove[]) {
    const move: AvailableMove = {
      id: m.id,
      name: pickLocalized(m.names),
      type: m.type,
      category: m.category,
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      shortDescription: pickLocalized(m.shortDescription),
    };
    moveById.set(m.id, move);
    allMoves.push(move);
  }
  allMoves.sort((a, b) => a.name.localeCompare(b.name));

  const abilityById = new Map<string, AvailableAbility>();
  for (const ab of getCatalogAbilities() as readonly CatalogAbility[]) {
    abilityById.set(ab.id, {
      id: ab.id,
      name: pickLocalized(ab.names),
      shortDescription: pickLocalized(ab.shortDescription),
      implemented: ab.implemented,
    });
  }

  const allItems: AvailableItem[] = [];
  const itemById = new Map<HeldItemId, AvailableItem>();
  for (const it of getCatalogItems() as readonly CatalogItem[]) {
    const item: AvailableItem = {
      id: it.id,
      name: pickLocalized(it.names),
      category: it.category,
      shortDescription: pickLocalized(it.shortDescription),
      implemented: it.implemented,
    };
    allItems.push(item);
    itemById.set(it.id, item);
  }
  allItems.sort((a, b) => {
    if (a.implemented !== b.implemented) {
      return a.implemented ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    registry,
    pokemonById,
    playable,
    moveById,
    abilityById,
    itemById,
    allItems,
    allMoves,
    moveDefById,
  };
}

function getCache(): TeamBuilderDataCache {
  const lang = getLanguage();
  if (cache === null || cachedLanguage !== lang) {
    cache = build();
    cachedLanguage = lang;
  }
  return cache;
}

export function refreshTeamBuilderData(): void {
  cache = null;
  cachedLanguage = null;
}

export function getPlayablePokemon(): readonly PlayablePokemon[] {
  return getCache().playable;
}

export function getPlayablePokemonById(id: string): PlayablePokemon | null {
  return getCache().pokemonById.get(id) ?? null;
}

export function getMoveInfo(id: string): AvailableMove | null {
  return getCache().moveById.get(id) ?? null;
}

export function getAllMoveInfos(): readonly AvailableMove[] {
  return getCache().allMoves;
}

export function getAbilityInfo(id: string): AvailableAbility | null {
  return getCache().abilityById.get(id) ?? null;
}

export function getItemInfo(id: HeldItemId): AvailableItem | null {
  return getCache().itemById.get(id) ?? null;
}

export function getAllAvailableItems(): readonly AvailableItem[] {
  return getCache().allItems;
}

export function getMoveDefinition(id: string): MoveDefinition | null {
  return getCache().moveDefById.get(id) ?? null;
}

export function getOpSetsByPokemonId(pokemonId: string): readonly OpSet[] {
  return getOpSetsForPokemon(pokemonId);
}

export function getAllOpSetsRaw(): readonly OpSet[] {
  return getAllOpSets();
}

export function getLearnsetForPokemon(pokemonId: string): readonly string[] {
  const data = getCache();
  return Array.from(data.registry.validator.getLegalMoves(pokemonId));
}

export function getLegalAbilitiesForPokemon(pokemonId: string): readonly string[] {
  const data = getCache();
  return Array.from(data.registry.validator.getLegalAbilities(pokemonId));
}

export function getPortraitUrl(pokemonId: string): string {
  return `assets/sprites/pokemon/${pokemonId}/portrait-normal.png`;
}

export function getTeamBuilderRegistry(): TeamBuilderRegistry {
  return getCache().registry;
}
