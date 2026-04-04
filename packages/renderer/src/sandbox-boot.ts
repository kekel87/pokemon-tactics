import { DEFAULT_SANDBOX_CONFIG, type SandboxConfig } from "./types/SandboxConfig";

function parseSandboxEnvConfig(): SandboxConfig | null {
  const raw = import.meta.env.VITE_SANDBOX_CONFIG;
  if (raw) {
    try {
      const partial = JSON.parse(raw) as Partial<SandboxConfig>;
      return { ...DEFAULT_SANDBOX_CONFIG, ...partial };
    } catch {
      throw new Error("Invalid VITE_SANDBOX_CONFIG JSON — check your sandbox config");
    }
  }
  return null;
}

export const sandboxBootConfig: { enabled: boolean; config: SandboxConfig | null } = {
  enabled: Boolean(import.meta.env.VITE_SANDBOX),
  config: import.meta.env.VITE_SANDBOX ? parseSandboxEnvConfig() : null,
};
