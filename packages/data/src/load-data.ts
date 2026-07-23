import type { MoveDefinition, PokemonDefinition, PokemonType } from "@pokemon-tactic/core";
import { AbilityHandlerRegistry, type HeldItemHandlerRegistry } from "@pokemon-tactic/core";
import abilitiesReference from "../reference/abilities.json";
import itemsReference from "../reference/items.json";
import movesReference from "../reference/moves.json";
import pokemonReference from "../reference/pokemon.json";
import { abilityHandlers } from "./abilities/ability-definitions";
import { deepFreeze } from "./deep-freeze";
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
    // A tactical override's `flags` must AUGMENT the reference flags, not replace them: a shallow
    // `{ ...base, ...tactical }` would drop reference flags like contact/protect/mirror whenever the
    // override declares its own (e.g. aerial-ace adding `slicing`). Merge the two flag sets instead.
    const mergedFlags =
      base.flags !== undefined || tactical.flags !== undefined
        ? { ...base.flags, ...tactical.flags }
        : undefined;
    const baseWithTactical = {
      ...base,
      ...tactical,
      ...(mergedFlags === undefined ? {} : { flags: mergedFlags }),
    };
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
      ...(merged.isExplosion ? { isExplosion: true } : {}),
      ...(merged.selfKo ? { selfKo: true } : {}),
      ...(merged.selfKoOnConnect ? { selfKoOnConnect: true } : {}),
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
      ...(merged.disabledUnderGravity ? { disabledUnderGravity: true } : {}),
      ...(merged.chargeEffects ? { chargeEffects: merged.chargeEffects } : {}),
      ...(merged.critRatio === undefined ? {} : { critRatio: merged.critRatio }),
      ...(merged.alwaysCrit ? { alwaysCrit: true } : {}),
      ...(merged.ignoresDefensiveStages ? { ignoresDefensiveStages: true } : {}),
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
      ...(merged.requiresUserType ? { requiresUserType: merged.requiresUserType } : {}),
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
      ...(merged.callMove ? { callMove: merged.callMove } : {}),
      ...(merged.knockOffBoost ? { knockOffBoost: true } : {}),
      ...(merged.requiresEatenBerry ? { requiresEatenBerry: true } : {}),
      ...(merged.requiresFlingableItem ? { requiresFlingableItem: true } : {}),
      ...(merged.isOhko ? { isOhko: true } : {}),
      ...(merged.ohkoIceAccuracyRule ? { ohkoIceAccuracyRule: true } : {}),
      ...(merged.ohkoIceImmunity ? { ohkoIceImmunity: true } : {}),
      ...(merged.lockIn ? { lockIn: merged.lockIn } : {}),
      ...(merged.uproarAura ? { uproarAura: true } : {}),
      ...(merged.firstActionOnly ? { firstActionOnly: true } : {}),
      ...(merged.failsUnlessTargetAggressive ? { failsUnlessTargetAggressive: true } : {}),
      ...(merged.failsWithoutStockpile ? { failsWithoutStockpile: true } : {}),
      ...(merged.chargeReaction ? { chargeReaction: merged.chargeReaction } : {}),
      ...(merged.cannotKo ? { cannotKo: true } : {}),
      ...(merged.pursuitBackstab ? { pursuitBackstab: true } : {}),
      ...(merged.targetingByCasterType
        ? { targetingByCasterType: merged.targetingByCasterType }
        : {}),
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

  // Freeze the plain-data definitions (pokemon + moves) so a test in one worker can't mutate the
  // shared cache and poison another test's baseline. Registries hold handler functions, not data.
  deepFreeze(pokemon);
  deepFreeze(moves);
  cachedGameData = { pokemon, moves, abilityRegistry, itemRegistry };
  return cachedGameData;
}

export function loadAllPokemonTypes(): Map<string, PokemonType[]> {
  const reference = pokemonReference as unknown as ReferencePokemon[];
  const result = new Map<string, PokemonType[]>();
  for (const entry of reference) {
    // `entry.types` is a direct reference into the shared JSON — freeze it so a type read/copy can't
    // mutate the singleton in place and poison another test (same invariant as the frozen defs).
    result.set(entry.id, deepFreeze(entry.types as PokemonType[]));
  }
  return result;
}
