import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { getStatMultiplier } from "./stat-modifier";

export function checkAccuracy(
  move: MoveDefinition,
  attacker: PokemonInstance,
  defender: PokemonInstance,
  random: RandomFn = () => Math.random(),
  terrainEvasionBonus = 0,
  abilityRegistry?: AbilityHandlerRegistry,
): boolean {
  const lockedOnIndex = attacker.volatileStatuses.findIndex((v) => v.type === StatusType.LockedOn);
  if (lockedOnIndex !== -1) {
    attacker.volatileStatuses.splice(lockedOnIndex, 1);
    return true;
  }

  if (move.bypassAccuracy) {
    return true;
  }

  const accuracyStages = attacker.statStages[StatName.Accuracy];
  const evasionStages = defender.statStages[StatName.Evasion] + terrainEvasionBonus;

  const accuracyMultiplier = getStatMultiplier(accuracyStages);
  const evasionMultiplier = getStatMultiplier(evasionStages);
  const abilityAccBonus = abilityRegistry?.getForPokemon(attacker)?.accuracyMultiplier ?? 1;

  const effectiveAccuracy =
    (move.accuracy * accuracyMultiplier * abilityAccBonus) / evasionMultiplier;

  if (effectiveAccuracy >= 100) {
    return true;
  }

  return random() * 100 < effectiveAccuracy;
}
