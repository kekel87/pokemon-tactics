import { BattleEventType } from "../../../enums/battle-event-type";
import type { StatName } from "../../../enums/stat-name";
import { StatName as StatNameEnum } from "../../../enums/stat-name";
import type { BattleEvent } from "../../../types/battle-event";
import type { PokemonInstance } from "../../../types/pokemon-instance";
import { effectiveBaseSpeed } from "../../effective-base-speed";
import { clampStages, computeMovement } from "../../stat-modifier";

/**
 * Write an absolute stat-stage value onto a Pokémon (stat-manip family: reset / copy / invert /
 * swap). Clamps to −6..+6, emits a `StatChanged` event carrying the delta (so the HUD + floating
 * numbers follow), and recomputes movement when the Speed stage moved. No-op (no event) when the
 * value is unchanged. Shared by every stat-manip handler.
 */
export function applyStageWrite(
  pokemon: PokemonInstance,
  stat: StatName,
  value: number,
): BattleEvent[] {
  const current = pokemon.statStages[stat];
  const next = clampStages(0, value);
  const delta = next - current;
  if (delta === 0) {
    return [];
  }
  pokemon.statStages[stat] = next;
  if (stat === StatNameEnum.Speed) {
    pokemon.derivedStats.movement = computeMovement(effectiveBaseSpeed(pokemon), next);
  }
  return [{ type: BattleEventType.StatChanged, targetId: pokemon.id, stat, stages: delta }];
}
