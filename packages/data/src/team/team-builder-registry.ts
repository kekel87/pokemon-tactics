import {
  GenderConstraint,
  type HeldItemId,
  Nature,
  type ShowdownExportRegistry,
  type ShowdownImportRegistry,
  type TeamValidatorRegistry,
  toShowdownId,
} from "@pokemon-tactic/core";
import abilitiesReference from "../../reference/abilities.json" with { type: "json" };
import itemsReference from "../../reference/items.json" with { type: "json" };
import movesReference from "../../reference/moves.json" with { type: "json" };
import pokemonReference from "../../reference/pokemon.json" with { type: "json" };
import { abilityHandlers } from "../abilities/ability-definitions";
import { itemHandlers } from "../items/item-definitions";
import type { ReferencePokemon } from "../loaders/reference-types";
import { tacticalOverrides } from "../overrides/tactical";
import { rosterPoc } from "../roster/roster-poc";
import {
  getLegalAbilities,
  getLegalMoves,
  getSpeciesRoot,
  initializeLearnsetResolver,
} from "./learnset-resolver";

interface ReferenceItem {
  id: string;
  names: { en: string; fr: string };
}

interface ReferenceMove {
  id: string;
  names: { en: string; fr: string };
}

interface ReferenceAbility {
  id: string;
  names: { en: string; fr: string };
}

let cachedRegistry: TeamBuilderRegistry | null = null;

export interface TeamBuilderRegistry {
  validator: TeamValidatorRegistry;
  exportRegistry: ShowdownExportRegistry;
  importRegistry: ShowdownImportRegistry;
}

function deriveGenderConstraint(pokemon: ReferencePokemon): GenderConstraint {
  const ratio = pokemon.genderRatio;
  if (ratio === "genderless") {
    return GenderConstraint.Genderless;
  }
  if (ratio.male === 100) {
    return GenderConstraint.MaleOnly;
  }
  if (ratio.female === 100) {
    return GenderConstraint.FemaleOnly;
  }
  return GenderConstraint.Any;
}

export function buildTeamBuilderRegistry(): TeamBuilderRegistry {
  if (cachedRegistry !== null) {
    return cachedRegistry;
  }

  const pokemonRef = pokemonReference as unknown as ReferencePokemon[];
  initializeLearnsetResolver(pokemonRef);

  const rosterIds = new Set(rosterPoc.map((entry) => entry.id).filter((id) => id !== "dummy"));
  const moveIds = new Set(Object.keys(tacticalOverrides));
  const abilityIds = new Set(abilityHandlers.map((h) => h.id));
  const itemIds = new Set<HeldItemId>(itemHandlers.map((h) => h.id as HeldItemId));

  const itemByShowdownId = new Map<string, HeldItemId>();
  for (const item of itemsReference as unknown as ReferenceItem[]) {
    const compressedFromName = toShowdownId(item.names.en);
    const compressedFromId = toShowdownId(item.id);
    if (itemIds.has(item.id as HeldItemId)) {
      itemByShowdownId.set(compressedFromName, item.id as HeldItemId);
      itemByShowdownId.set(compressedFromId, item.id as HeldItemId);
    }
  }

  const pokemonNameById = new Map<string, string>();
  for (const pk of pokemonRef) {
    pokemonNameById.set(pk.id, pk.names.en);
  }
  const moveNameById = new Map<string, string>();
  const moveByShowdownNameId = new Map<string, string>();
  for (const move of movesReference as unknown as ReferenceMove[]) {
    if (moveIds.has(move.id)) {
      moveNameById.set(move.id, move.names.en);
      moveByShowdownNameId.set(toShowdownId(move.names.en), move.id);
      moveByShowdownNameId.set(toShowdownId(move.id), move.id);
    }
  }
  const abilityNameById = new Map<string, string>();
  const abilityByShowdownNameId = new Map<string, string>();
  for (const ability of abilitiesReference as unknown as ReferenceAbility[]) {
    if (abilityIds.has(ability.id)) {
      abilityNameById.set(ability.id, ability.names.en);
      abilityByShowdownNameId.set(toShowdownId(ability.names.en), ability.id);
      abilityByShowdownNameId.set(toShowdownId(ability.id), ability.id);
    }
  }
  const itemNameById = new Map<string, HeldItemId>();
  const itemNameDisplay = new Map<HeldItemId, string>();
  for (const item of itemsReference as unknown as ReferenceItem[]) {
    if (itemIds.has(item.id as HeldItemId)) {
      itemNameById.set(item.id, item.id as HeldItemId);
      itemNameDisplay.set(item.id as HeldItemId, item.names.en);
    }
  }
  const pokemonByEnglishNameMap = new Map<string, string>();
  for (const pk of pokemonRef) {
    if (rosterIds.has(pk.id)) {
      pokemonByEnglishNameMap.set(toShowdownId(pk.names.en), pk.id);
      pokemonByEnglishNameMap.set(toShowdownId(pk.id), pk.id);
    }
  }

  const natureByName = new Map<string, Nature>();
  for (const value of Object.values(Nature)) {
    const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
    natureByName.set(capitalized, value);
  }

  const genderConstraintByPokemon = new Map<string, GenderConstraint>();
  for (const pk of pokemonRef) {
    genderConstraintByPokemon.set(pk.id, deriveGenderConstraint(pk));
  }

  const validator: TeamValidatorRegistry = {
    pokemonIds: rosterIds,
    moveIds,
    abilityIds,
    itemIds,
    getLegalAbilities: (id) => getLegalAbilities(id),
    getLegalMoves: (id) => getLegalMoves(id),
    getSpeciesRoot: (id) => getSpeciesRoot(id),
    getGenderConstraint: (id) => genderConstraintByPokemon.get(id) ?? GenderConstraint.Any,
  };

  const exportRegistry: ShowdownExportRegistry = {
    getPokemonName: (id) => pokemonNameById.get(id) ?? id,
    getAbilityName: (id) => abilityNameById.get(id) ?? id,
    getItemName: (id) => itemNameDisplay.get(id) ?? id,
    getMoveName: (id) => moveNameById.get(id) ?? id,
  };

  const importRegistry: ShowdownImportRegistry = {
    pokemonByShowdownId: pokemonByEnglishNameMap,
    abilityByShowdownId: abilityByShowdownNameId,
    itemByShowdownId,
    moveByShowdownId: moveByShowdownNameId,
    natureByName,
  };

  cachedRegistry = { validator, exportRegistry, importRegistry };
  return cachedRegistry;
}

export function resetTeamBuilderRegistryForTests(): void {
  cachedRegistry = null;
}
