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
import { getOpSetsForPokemon } from "./op-sets/load-op-sets";
import { balanceOverrides } from "./overrides/balance-v1";
import { tacticalOverrides } from "./overrides/tactical";
import { playablePokemon } from "./playable/playable-pokemon";
import { initializeLearnsetResolver } from "./team/learnset-resolver";

export interface GameData {
  pokemon: PokemonDefinition[];
  moves: MoveDefinition[];
  abilityRegistry: AbilityHandlerRegistry;
  itemRegistry: HeldItemHandlerRegistry;
}

let cachedGameData: GameData | null = null;

export function loadData(): GameData {
  if (cachedGameData !== null) {
    return cachedGameData;
  }
  const allMoveIds = new Set<string>(Object.keys(tacticalOverrides));

  initializeLearnsetResolver(pokemonReference as unknown as ReferencePokemon[]);

  const pokemon: PokemonDefinition[] = loadPokemonFromReference(
    pokemonReference as unknown as ReferencePokemon[],
    playablePokemon,
    {
      implementedMoveIds: allMoveIds,
      getOpSetMoveIds: (pokemonId) => getOpSetsForPokemon(pokemonId).flatMap((set) => set.moveIds),
    },
  );

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
      ...(merged.bypassProtect ? { bypassProtect: true } : {}),
      ...(merged.weatherSetter ? { weatherSetter: merged.weatherSetter } : {}),
      ...(merged.weatherBoostedType ? { weatherBoostedType: true } : {}),
      ...(merged.twoTurnCharge ? { twoTurnCharge: true } : {}),
      ...(merged.sunSkipsCharge ? { sunSkipsCharge: true } : {}),
      ...(merged.semiInvulnerableState
        ? { semiInvulnerableState: merged.semiInvulnerableState }
        : {}),
      ...(merged.chargeEffects ? { chargeEffects: merged.chargeEffects } : {}),
      ...(merged.critRatio === undefined ? {} : { critRatio: merged.critRatio }),
      ...(merged.targetsAlly ? { targetsAlly: true } : {}),
      ...(merged.targetsAllyOrSelf ? { targetsAllyOrSelf: true } : {}),
      ...(merged.dynamicPower ? { dynamicPower: merged.dynamicPower } : {}),
      ...(merged.ignoresBurnAttackDrop ? { ignoresBurnAttackDrop: true } : {}),
      ...(merged.attackStatSource ? { attackStatSource: merged.attackStatSource } : {}),
      ...(merged.hitsPhysicalDefense ? { hitsPhysicalDefense: true } : {}),
      ...(merged.typeEffectivenessOverride
        ? { typeEffectivenessOverride: merged.typeEffectivenessOverride }
        : {}),
      ...(merged.perHitAccuracy ? { perHitAccuracy: true } : {}),
      ...(merged.crashOnMiss ? { crashOnMiss: merged.crashOnMiss } : {}),
      ...(merged.requiresAsleep ? { requiresAsleep: true } : {}),
      ...(merged.requiresAllOtherMovesUsed ? { requiresAllOtherMovesUsed: true } : {}),
      ...(merged.requiresTargetAsleep ? { requiresTargetAsleep: true } : {}),
      ...(merged.fieldTerrainPowerBonus
        ? { fieldTerrainPowerBonus: merged.fieldTerrainPowerBonus }
        : {}),
      ...(merged.dashRangeBonusOnFieldTerrain
        ? { dashRangeBonusOnFieldTerrain: merged.dashRangeBonusOnFieldTerrain }
        : {}),
      ...(merged.fieldTerrainTargetingOverride
        ? { fieldTerrainTargetingOverride: merged.fieldTerrainTargetingOverride }
        : {}),
      ...(merged.fieldTerrainBoostedType ? { fieldTerrainBoostedType: true } : {}),
      ...(merged.naturePowerMorph ? { naturePowerMorph: true } : {}),
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

  cachedGameData = { pokemon, moves, abilityRegistry, itemRegistry };
  return cachedGameData;
}

export function loadAllPokemonTypes(): Map<string, PokemonType[]> {
  const reference = pokemonReference as unknown as ReferencePokemon[];
  const result = new Map<string, PokemonType[]>();
  for (const entry of reference) {
    result.set(entry.id, entry.types as PokemonType[]);
  }
  return result;
}
