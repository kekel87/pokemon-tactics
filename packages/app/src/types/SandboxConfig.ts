/**
 * Sandbox studio config (plan 125). Definition now lives in the engine-agnostic
 * `presentation` package (consumed by `SandboxSetup`); re-exported here so the
 * renderer's existing import sites stay unchanged.
 */
export {
  type AiProfileKey,
  DEFAULT_SANDBOX_CONFIG,
  normalizeSandboxConfig,
  type Position2D,
  type SandboxConfig,
  type SandboxMemberConfig,
  type SandboxTeamConfig,
  type TeamControl,
} from "@pokemon-tactic/view-core";
