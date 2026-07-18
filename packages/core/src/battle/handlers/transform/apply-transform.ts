import { BattleEventType } from "../../../enums/battle-event-type";
import type { PokemonType } from "../../../enums/pokemon-type";
import { StatName } from "../../../enums/stat-name";
import type { BattleEvent } from "../../../types/battle-event";
import type { PokemonInstance } from "../../../types/pokemon-instance";
import { effectiveBaseSpeed } from "../../effective-base-speed";
import { effectiveCombatStats } from "../../effective-combat-stats";
import { effectiveGender } from "../../effective-gender";
import { effectiveMoveIds } from "../../effective-move-ids";
import { effectiveWeight } from "../../effective-weight";
import { computeMovement } from "../../stat-modifier";

/**
 * Shared Morphing routine (plan 157), used by both the `transform` move and the Imposteur ability.
 * The caster becomes a live copy of `target`: combat stats, base speed, moves, weight and gender are
 * snapshotted into `caster.transformState`; the stat stages are copied in place (#650); the copied
 * types + ability are passed in already-resolved (via `resolveBaseTypes` / `effectiveAbilityId`).
 *
 * Level, `maxHp` and `currentHp` stay the caster's (#649). Per decision #656 ("manip écrase") the
 * caster's own pre-existing type/ability/speed overrides are purged so the morph is the active layer;
 * a later Détrempage / Échange / Permuvitesse re-posts its own override, which then wins.
 *
 * Callers own the failure gates (Substitute, already-transformed, Imposteur target); this routine
 * assumes the transform is legal and only mutates + emits `Transformed`.
 */
export function applyTransform(
  caster: PokemonInstance,
  target: PokemonInstance,
  targetTypes: PokemonType[],
  targetAbilityId: string | undefined,
): BattleEvent[] {
  const moveIds = [...effectiveMoveIds(target)];

  // #656: drop the caster's own overrides so transformState is the active identity layer.
  caster.typeOverride = undefined;
  caster.abilityIdOverride = undefined;
  caster.abilitySuppressed = undefined;
  caster.speedStatOverride = undefined;
  // Plan 162: Partage Garde / Stockage state is dropped so transformState is the active identity layer.
  caster.defenseStatOverride = undefined;
  caster.spDefenseStatOverride = undefined;
  caster.stockpileCount = undefined;
  caster.stockpileDefBoost = undefined;
  caster.stockpileSpDefBoost = undefined;

  // #650: plain snapshot of the target's stat stages; they diverge in place afterwards.
  caster.statStages = { ...target.statStages };

  caster.transformState = {
    definitionId: target.definitionId,
    combatStats: { ...effectiveCombatStats(target) },
    baseSpeed: effectiveBaseSpeed(target),
    types: [...targetTypes],
    abilityId: targetAbilityId,
    moveIds,
    weight: effectiveWeight(target),
    gender: effectiveGender(target),
  };

  // #647: the copied Speed drives both the CT tempo (via effectiveBaseSpeed) and the movement range.
  caster.derivedStats.movement = computeMovement(
    effectiveBaseSpeed(caster),
    caster.statStages[StatName.Speed],
  );

  return [
    {
      type: BattleEventType.Transformed,
      pokemonId: caster.id,
      intoDefinitionId: target.definitionId,
      moveIds,
    },
  ];
}
