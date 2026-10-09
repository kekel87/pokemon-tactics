import { normalizeSandboxConfig, type SandboxConfig } from "./types/SandboxConfig";

function parseSandboxEnvConfig(): SandboxConfig | null {
  const raw = import.meta.env.VITE_SANDBOX_CONFIG;
  if (raw) {
    try {
      return normalizeSandboxConfig(JSON.parse(raw));
    } catch {
      throw new Error("Invalid VITE_SANDBOX_CONFIG JSON — check your sandbox config");
    }
  }
  return null;
}

/**
 * The studio config passed by `pnpm dev:sandbox`. Whether the studio opens is read straight from
 * `import.meta.env.VITE_SANDBOX` in `babylon-boot.ts`, never from here (plan 235).
 */
export const sandboxBootConfig: SandboxConfig | null = import.meta.env.VITE_SANDBOX
  ? parseSandboxEnvConfig()
  : null;
