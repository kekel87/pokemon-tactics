import type { HeldItemId } from "@pokemon-tactic/core";
import abilitiesReference from "../../reference/abilities.json" with { type: "json" };
import itemsReference from "../../reference/items.json" with { type: "json" };
import movesReference from "../../reference/moves.json" with { type: "json" };
import pokemonReference from "../../reference/pokemon.json" with { type: "json" };
import { abilityHandlers } from "../abilities/ability-definitions";
import { itemHandlers } from "../items/item-definitions";
import { tacticalOverrides } from "../overrides/tactical";
import { isAbilityImplemented, isItemImplemented, isMoveImplemented } from "./implementation-flags";

export interface CatalogPokemonAbilities {
  id: string;
  primary?: string;
  secondary?: string;
  hidden?: string;
  all: readonly string[];
}

export interface CatalogMove {
  id: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  names: { en: string; fr: string };
  shortDescription: { en: string; fr: string };
}

export interface CatalogAbility {
  id: string;
  implemented: boolean;
  names: { en: string; fr: string };
  shortDescription: { en: string; fr: string };
}

export interface CatalogItem {
  id: HeldItemId;
  implemented: boolean;
  category: string;
  names: { en: string; fr: string };
  shortDescription: { en: string; fr: string };
}

interface ReferencePokemonRaw {
  id: string;
  abilityId?: string;
  hiddenAbilityId?: string;
  abilities?: {
    abilities?: string[];
    ability1?: string | null;
    ability2?: string | null;
    hidden?: string | null;
  };
}

interface ReferenceMoveRaw {
  id: string;
  type: string;
  category: string;
  power?: number | null;
  accuracy?: number | null;
  pp?: number | null;
  names: { en: string; fr: string };
  shortDescription?: { en: string; fr: string };
}

interface ReferenceAbilityRaw {
  id: string;
  names: { en: string; fr: string };
  shortDescription?: { en: string; fr: string };
}

interface ReferenceItemRaw {
  id: string;
  category?: string;
  names: { en: string; fr: string };
  shortDescription?: { en: string; fr: string };
}

const EMPTY_DESC = { en: "", fr: "" };

let cachedAbilities: CatalogAbility[] | null = null;
let cachedItems: CatalogItem[] | null = null;
let cachedMoves: CatalogMove[] | null = null;
let cachedPokemonAbilities: Map<string, CatalogPokemonAbilities> | null = null;

export function getCatalogAbilities(): readonly CatalogAbility[] {
  if (cachedAbilities !== null) {
    return cachedAbilities;
  }
  const result: CatalogAbility[] = [];
  for (const raw of abilitiesReference as unknown as ReferenceAbilityRaw[]) {
    result.push({
      id: raw.id,
      implemented: isAbilityImplemented(raw.id, abilityHandlers),
      names: raw.names,
      shortDescription: raw.shortDescription ?? EMPTY_DESC,
    });
  }
  cachedAbilities = result;
  return result;
}

export function getCatalogItems(): readonly CatalogItem[] {
  if (cachedItems !== null) {
    return cachedItems;
  }
  const result: CatalogItem[] = [];
  for (const raw of itemsReference as unknown as ReferenceItemRaw[]) {
    const id = raw.id as HeldItemId;
    result.push({
      id,
      implemented: isItemImplemented(id, itemHandlers),
      category: raw.category ?? "other",
      names: raw.names,
      shortDescription: raw.shortDescription ?? EMPTY_DESC,
    });
  }
  cachedItems = result;
  return result;
}

export function getCatalogMoves(): readonly CatalogMove[] {
  if (cachedMoves !== null) {
    return cachedMoves;
  }
  const result: CatalogMove[] = [];
  for (const raw of movesReference as unknown as ReferenceMoveRaw[]) {
    if (!isMoveImplemented(raw.id, tacticalOverrides)) {
      continue;
    }
    result.push({
      id: raw.id,
      type: raw.type,
      category: raw.category,
      power: raw.power ?? null,
      accuracy: raw.accuracy ?? null,
      pp: raw.pp ?? null,
      names: raw.names,
      shortDescription: raw.shortDescription ?? EMPTY_DESC,
    });
  }
  cachedMoves = result;
  return result;
}

export function getPokemonAbilities(pokemonId: string): CatalogPokemonAbilities {
  if (cachedPokemonAbilities === null) {
    cachedPokemonAbilities = new Map();
    for (const raw of pokemonReference as unknown as ReferencePokemonRaw[]) {
      const entry: CatalogPokemonAbilities = build(raw);
      cachedPokemonAbilities.set(raw.id, entry);
    }
  }
  return (
    cachedPokemonAbilities.get(pokemonId) ?? {
      id: pokemonId,
      all: [],
    }
  );
}

function build(raw: ReferencePokemonRaw): CatalogPokemonAbilities {
  const seen = new Set<string>();
  const all: string[] = [];
  const toMaybe = (value: string | null | undefined): string | undefined => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    return value;
  };
  const push = (id: string | undefined): void => {
    if (id === undefined || seen.has(id)) {
      return;
    }
    seen.add(id);
    all.push(id);
  };
  let primary: string | undefined;
  let secondary: string | undefined;
  let hidden: string | undefined;
  const refAbilities = raw.abilities;
  const arr = refAbilities?.abilities ?? [];
  if (arr.length > 0) {
    primary = arr[0];
    if (arr.length > 1) {
      secondary = arr[1];
    }
  }
  primary = primary ?? toMaybe(refAbilities?.ability1);
  secondary = secondary ?? toMaybe(refAbilities?.ability2);
  hidden = toMaybe(refAbilities?.hidden);
  if (primary === undefined && raw.abilityId !== undefined) {
    primary = raw.abilityId;
  }
  if (hidden === undefined && raw.hiddenAbilityId !== undefined) {
    hidden = raw.hiddenAbilityId;
  }
  push(primary);
  push(secondary);
  push(hidden);
  return { id: raw.id, primary, secondary, hidden, all };
}

export function resetTeamBuilderCatalogForTests(): void {
  cachedAbilities = null;
  cachedItems = null;
  cachedMoves = null;
  cachedPokemonAbilities = null;
}
