/**
 * Sandbox studio config (plan 125). Definition now lives in the engine-agnostic
 * `presentation` package (consumed by `SandboxSetup`); re-exported here so the
 * renderer's existing import sites stay unchanged.
 */
export {
  DEFAULT_SANDBOX_CONFIG,
  type Position2D,
  type SandboxConfig,
} from "@pokemon-tactic/view-core";
