/**
 * Sandbox studio config (plan 125). Definition now lives in the engine-agnostic
 * `presentation` package (consumed by `SandboxSetup`); re-exported here so the
 * renderer's existing import sites stay unchanged.
 */
export {
  type AiProfileKey,
  DEFAULT_SANDBOX_CONFIG,
  isSandboxTrainerId,
  normalizeSandboxConfig,
  type Position2D,
  SANDBOX_TRAINER_IDS,
  type SandboxConfig,
  type SandboxMemberConfig,
  type SandboxTeamConfig,
  type SandboxTrainerId,
  type TeamControl,
  TRAINER_ANIMATIONS,
  type TrainerAnimation,
  trainerSpriteId,
} from "@pokemon-tactic/view-core";
