import type { MoveDefinition, PokemonDefinition, PokemonType } from "@pokemon-tactic/core";
import { AbilityHandlerRegistry, type HeldItemHandlerRegistry } from "@pokemon-tactic/core";
import abilitiesReference from "../reference/abilities.json";
import itemsReference from "../reference/items.json";
import movesReference from "../reference/moves.json";
import pokemonReference from "../reference/pokemon.json";
import { abilityHandlers } from "./abilities/ability-definitions";
import { itemHandlers } from "./items/item-definitions";
import { buildItemRegistry } from "./items/load-items";
import { loadAbilitiesFromReference } from "./loaders/load-abilities";
import { loadMovesFromReference } from "./loaders/load-moves";
import { loadPokemonFromReference } from "./loaders/load-pokemon";
import type { ReferenceAbility, ReferenceMove, ReferencePokemon } from "./loaders/reference-types";
import { deepMerge } from "./merge";
import { balanceOverrides } from "./overrides/balance-v1";
import { tacticalOverrides } from "./overrides/tactical";
import { rosterPoc } from "./roster/roster-poc";
import { initializeLearnsetResolver } from "./team/learnset-resolver";

export interface GameData {
  pokemon: PokemonDefinition[];
  moves: MoveDefinition[];
  abilityRegistry: AbilityHandlerRegistry;
  itemRegistry: HeldItemHandlerRegistry;
}

export function loadData(): GameData {
  initializeLearnsetResolver(pokemonReference as unknown as ReferencePokemon[]);
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
      ...(merged.bypassAccuracy ? { bypassAccuracy: true } : {}),
      ...(merged.weatherSetter ? { weatherSetter: merged.weatherSetter } : {}),
      ...(merged.weatherBoostedType ? { weatherBoostedType: true } : {}),
      ...(merged.twoTurnCharge ? { twoTurnCharge: true } : {}),
    };
    return moveDefinition;
  });

  const abilities = loadAbilitiesFromReference(
    abilitiesReference as unknown as ReferenceAbility[],
    abilityHandlers,
  );
  const abilityRegistry = new AbilityHandlerRegistry(abilities);

  const itemRegistry = buildItemRegistry(
    itemsReference as unknown as Array<{
      id: string;
      names: { fr: string; en: string };
      shortDescription: { fr: string; en: string };
    }>,
    itemHandlers,
  );

  return { pokemon, moves, abilityRegistry, itemRegistry };
}

export function loadAllPokemonTypes(): Map<string, PokemonType[]> {
  const reference = pokemonReference as unknown as ReferencePokemon[];
  const result = new Map<string, PokemonType[]>();
  for (const entry of reference) {
    result.set(entry.id, entry.types as PokemonType[]);
  }
  return result;
}
