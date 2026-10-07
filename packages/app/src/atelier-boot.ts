/** What the move workshop opens on (`pnpm dev:atelier '{...}'`, plan 233). All fields optional. */
export interface AtelierConfig {
  move?: string;
  attacker?: string;
  target?: string;
}

function parseAtelierEnvConfig(): AtelierConfig {
  const raw = import.meta.env.VITE_ATELIER_CONFIG;
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid VITE_ATELIER_CONFIG JSON — check your atelier config");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("VITE_ATELIER_CONFIG must be a JSON object");
  }
  const config: AtelierConfig = {};
  for (const key of ["move", "attacker", "target"] as const) {
    const value = (parsed as Record<string, unknown>)[key];
    if (value !== undefined && typeof value !== "string") {
      throw new Error(`VITE_ATELIER_CONFIG.${key} must be a string`);
    }
    if (typeof value === "string") {
      config[key] = value;
    }
  }
  return config;
}

export const atelierBootConfig: { enabled: boolean; config: AtelierConfig } = {
  enabled: Boolean(import.meta.env.VITE_ATELIER),
  config: import.meta.env.VITE_ATELIER ? parseAtelierEnvConfig() : {},
};
