import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// One Vite server reused for the whole suite, on a DEDICATED e2e port so it never collides
// with the human's own `pnpm dev` (which runs WITHOUT VITE_E2E → the scene-graph hook would be
// absent and every scene-graph assert would fail). PT_PORT env wins (lets a run pick a fresh
// port), else the per-worktree dev port + offset, else main's 5173 + offset.
const E2E_PORT_OFFSET = 1000;
const devPort = existsSync(".worktree-port")
  ? Number(readFileSync(".worktree-port", "utf8").trim())
  : 5173;
const port = Number(process.env.PT_PORT) || devPort + E2E_PORT_OFFSET;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  // Determinism over speed-of-flakiness: no implicit retries locally; CI absorbs GPU/timing jitter.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "blob" : "list",
  use: {
    baseURL,
    // Projet FR-first (doc + UI par défaut FR). On épingle la locale du navigateur à fr-FR pour que
    // `detectLanguage()` (lu par `initLanguage()` au boot) renvoie FR par défaut, indépendamment de
    // la locale de la machine CI. Les tests EN posent `pt-lang=en` explicitement (addInitScript).
    locale: "fr-FR",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    // WebGL en CI headless : le rendu Babylon a besoin de WebGL. Chromium headless moderne désactive
    // le fallback logiciel par défaut → la scène ne se monte jamais (`waitReady` timeout sur tous les
    // tests combat). On force SwiftShader (rendu logiciel) : indispensable en CI sans GPU, inoffensif
    // en local. Voir e2e CI job (ci.yml).
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.01 },
  },
  projects: [
    { name: "smoke", testMatch: "**/smoke/**/*.spec.ts" },
    { name: "dom", testMatch: "**/dom/**/*.spec.ts" },
    // 60s (vs 30s défaut) : le boot Babylon sous SwiftShader (rendu logiciel) est lourd, et les tests
    // de comparaison bootent 2-4 scènes → sous forte parallélisation le budget 30s déborde (flake de
    // charge, pas de déterminisme). Le rendu reste déterministe ; seul le temps de boot varie.
    { name: "combat", testMatch: "**/combat/**/*.spec.ts", timeout: 60_000 },
    { name: "visual", testMatch: "**/visual/**/*.spec.ts", retries: 0 },
  ].map((project) => ({ ...project, use: { ...devices["Desktop Chrome"], locale: "fr-FR" } })),
  webServer: {
    command: "pnpm --filter @pokemon-tactic/app dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // VITE_E2E unlocks the read-only scene-graph debug hook (stripped from prod builds).
    env: { VITE_E2E: "true", PT_PORT: String(port) },
    stdout: "ignore",
    stderr: "pipe",
  },
});
