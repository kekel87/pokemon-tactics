export { EASY_PROFILE, HARD_PROFILE, MEDIUM_PROFILE } from "./ai/ai-profiles";
export { pickAggressiveAction, pickRandomAction } from "./ai/index";
export { pickScoredAction } from "./ai/scored-ai";
export { AbilityHandlerRegistry } from "./battle/ability-handler-registry";
export { BattleEngine } from "./battle/BattleEngine";
export { CT_THRESHOLD, CT_WAIT, computeMoveCost } from "./battle/ct-costs";
export type { EffectContext, EffectHandler, TypeChart } from "./battle/effect-handler-registry";
export { EffectHandlerRegistry } from "./battle/effect-handler-registry";
export { createDefaultEffectRegistry } from "./battle/effect-processor";
export { isEffectivelyFlying } from "./battle/effective-flying";
export { isImmuneToStatusByType } from "./battle/handlers/handle-status";
export { getEffectiveInitiative } from "./battle/initiative-calculator";
export type { PlacementResult } from "./battle/PlacementPhase";
export { PlacementError, PlacementPhase } from "./battle/PlacementPhase";
export type { EngineFactory } from "./battle/replay-runner";
export { runReplay } from "./battle/replay-runner";
export { computeCombatStats, computeStatAtLevel } from "./battle/stat-calculator";
export { computeMovement, isMajorStatus } from "./battle/stat-modifier";
export { TurnManager } from "./battle/TurnManager";
export { validateTeamSelection } from "./battle/team-validator";
export type { PhaseHandler, PhaseResult } from "./battle/turn-pipeline";
export { TurnPipeline } from "./battle/turn-pipeline";
export type { ValidationResult } from "./battle/validate";
export { validateBattleData } from "./battle/validate";
export { validateMapDefinition } from "./battle/validate-map";
export * from "./enums/index";
export { Grid } from "./grid/Grid";
export { hasLineOfSight } from "./grid/line-of-sight";
export type { TargetingMoveContext } from "./grid/targeting";
export {
  resolveBlastEpicenter,
  resolveBlastImpactTile,
  resolveTargeting,
} from "./grid/targeting";
export type * from "./types/index";
export { DEFAULT_STATUS_RULES } from "./types/status-rules";
export * from "./utils/index";
