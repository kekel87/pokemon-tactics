import { StatName } from "../enums/stat-name";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import { getStatMultiplier } from "./stat-modifier";

export function checkAccuracy(
  move: MoveDefinition,
  attacker: PokemonInstance,
  defender: PokemonInstance,
  random: RandomFn = () => Math.random(),
  terrainEvasionBonus = 0,
): boolean {
  const accuracyStages = attacker.statStages[StatName.Accuracy];
  const evasionStages = defender.statStages[StatName.Evasion] + terrainEvasionBonus;

  const accuracyMultiplier = getStatMultiplier(accuracyStages);
  const evasionMultiplier = getStatMultiplier(evasionStages);

  const effectiveAccuracy = (move.accuracy * accuracyMultiplier) / evasionMultiplier;

  if (effectiveAccuracy >= 100) {
    return true;
  }

  return random() * 100 < effectiveAccuracy;
}
