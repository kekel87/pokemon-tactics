export { EASY_PROFILE, HARD_PROFILE, MEDIUM_PROFILE } from "./ai/ai-profiles";
export { pickAggressiveAction, pickRandomAction } from "./ai/index";
export { pickScoredAction } from "./ai/scored-ai";
export { AbilityHandlerRegistry } from "./battle/ability-handler-registry";
export {
  AURA_DEFAULT_DURATION,
  AURA_EXTENDED_DURATION,
  AURA_RADIUS,
  auraDurationForCaster,
  computeBrickBreakInteraction,
  computeScreenMultiplier,
  decrementAurasTimer,
  findActiveAurasProtectingTarget,
  findAurasByCaster,
  isProtectedFromStatDecrease,
  isProtectedFromStatus,
  isWithinAuraRadius,
  manhattanDistance,
  postAura,
  removeAurasOfCaster,
} from "./battle/aura-system";
export { BattleEngine } from "./battle/BattleEngine";
export {
  CT_TEMPO_MAX,
  CT_THRESHOLD,
  CT_WAIT,
  computeMoveCost,
  moveCtTempo,
} from "./battle/ct-costs";
export { getEffectivePowerFloor, resolveDynamicPower } from "./battle/dynamic-power-system";
export type { EffectContext, EffectHandler, TypeChart } from "./battle/effect-handler-registry";
export { EffectHandlerRegistry } from "./battle/effect-handler-registry";
export { createDefaultEffectRegistry } from "./battle/effect-processor";
export { isEffectivelyFlying } from "./battle/effective-flying";
export {
  FIELD_TERRAIN_RADIUS,
  getActiveZonesOfKind,
  getFieldTerrainAt,
  isOnFieldTerrain,
} from "./battle/field-terrain-system";
export { isImmuneToStatusByType } from "./battle/handlers/handle-status";
export { HeldItemHandlerRegistry } from "./battle/held-item-handler-registry";
export { getEffectiveInitiative } from "./battle/initiative-calculator";
export {
  applyNatureModifier,
  NATURE_BOOST_MULTIPLIER,
  NATURE_LOWER_MULTIPLIER,
} from "./battle/nature-modifier";
export type { PlacementResult } from "./battle/PlacementPhase";
export { PlacementError, PlacementPhase } from "./battle/PlacementPhase";
export type { EngineFactory } from "./battle/replay-runner";
export { runReplay } from "./battle/replay-runner";
export { rollGender } from "./battle/roll-gender";
export { rollNature } from "./battle/roll-nature";
export { computeCombatStats, computeStatAtLevel } from "./battle/stat-calculator";
export { computeMovement, isMajorStatus } from "./battle/stat-modifier";
export { validateStatSpread } from "./battle/stat-spread-validator";
export { validateTeamSelection } from "./battle/team-validator";
export type { PhaseHandler, PhaseResult } from "./battle/turn-pipeline";
export { TurnPipeline } from "./battle/turn-pipeline";
export type { ValidationResult } from "./battle/validate";
export { validateBattleData } from "./battle/validate";
export { validateMapDefinition } from "./battle/validate-map";
export {
  applyWeatherWar,
  clearWeather,
  computeWeatherDamage,
  decrementWeatherTimer,
  effectiveWeather,
  getWeatherAccuracyOverride,
  getWeatherBallBp,
  getWeatherBallType,
  getWeatherBpModifier,
  getWeatherDefenseStatBoost,
  hasSuppressWeatherActive,
  isWeatherDamageImmune,
  setWeather,
  shouldBlockFreezeInSun,
  WEATHER_DAMAGE_FRACTION,
  WEATHER_DEFAULT_DURATION,
  WEATHER_EXTENDED_DURATION,
  weatherDealsDamage,
} from "./battle/weather-system";
export * from "./enums/index";
export { Grid } from "./grid/Grid";
export { hasLineOfSight } from "./grid/line-of-sight";
export type { TargetingMoveContext } from "./grid/targeting";
export {
  resolveBlastEpicenter,
  resolveBlastImpactTile,
  resolveTargeting,
} from "./grid/targeting";
export {
  enumerateHitAndRunRetreatTiles,
  isValidHitAndRunRetreat,
} from "./grid/validate-hit-and-run-retreat";
export * from "./team/index";
export {
  AuraDissipatedReason,
  ProtectionReason,
  SubstituteFailedReason,
} from "./types/battle-event";
export type * from "./types/index";
export type { SemiInvulnerableDisplay } from "./types/semi-invulnerable-display";
export { SemiInvulnerableState } from "./types/semi-invulnerable-state";
export { SP_PER_STAT_MAX, SP_TOTAL_MAX } from "./types/stat-spread";
export { DEFAULT_STATUS_RULES } from "./types/status-rules";
export * from "./utils/index";
