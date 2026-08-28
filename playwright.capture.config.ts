import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/*
 * Configuration DÉDIÉE à la production de captures et de la séquence d'intro (plan 194).
 *
 * Séparée de `playwright.config.ts` à dessein : ce n'est pas une suite de tests. Un projet ajouté
 * là-bas tournerait dans le gate à chaque commit, alors qu'ici on veut de la **vidéo**, un viewport
 * **fixe**, un seul worker, et une sortie qu'on garde. Le gate reste donc intact.
 *
 * Différences assumées avec la config de test :
 * - `video: "on"` et non `retain-on-failure` — la vidéo EST le livrable
 * - `workers: 1` — deux navigateurs en parallèle se disputeraient le GPU et feraient trembler la
 *   cadence d'animation, ce qui se voit à l'image
 * - `retries: 0` — un run de capture qui échoue doit échouer visiblement, pas se rejouer à moitié
 * - viewport 1920×1080 — la résolution de référence du design system, et le format d'une vidéo
 */

const E2E_PORT_OFFSET = 2000;
const devPort = existsSync(".worktree-port")
  ? Number(readFileSync(".worktree-port", "utf8").trim())
  : 5173;
// Décalage propre (+2000) : une capture peut tourner pendant que le gate e2e (+1000) ou le serveur
// de développement de l'humain (port nu) occupent déjà leur port.
const port = Number(process.env.PT_CAPTURE_PORT) || devPort + E2E_PORT_OFFSET;
const baseURL = `http://localhost:${port}`;

const CAPTURE_VIEWPORT = {
  width: Number(process.env.PT_CAPTURE_WIDTH) || 1920,
  height: Number(process.env.PT_CAPTURE_HEIGHT) || 1080,
};

export default defineConfig({
  testDir: "./e2e/capture",
  testMatch: "**/*.capture.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Une séquence d'intro complète (éditeur d'équipe, combat, rotation) prend largement plus que les
  // 30 s par défaut, et elle inclut des pauses volontaires pour laisser respirer l'image.
  //
  // 15 min depuis le volet combat (plan 194) : une vingtaine de tours 6v6 s'y jouent réellement —
  // chacun avec ses animations d'attaque, que rien n'accélère puisque c'est ce qu'on filme.
  timeout: 900_000,
  reporter: "list",
  outputDir: ".captures/artifacts",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    // Anglais : la vidéo et les captures visent itch.io et le README, dont le public est
    // anglophone (demande de l'humain 2026-08-27). Le jeu reste FR par défaut pour lui.
    locale: "en-US",
    viewport: CAPTURE_VIEWPORT,
    video: { mode: "on", size: CAPTURE_VIEWPORT },
    // Le curseur de la souris n'apparaît pas dans une vidéo Playwright, donc les clics sont invisibles
    // à l'image : c'est ce qu'on veut pour une bande-annonce (on montre le jeu, pas le pilote).
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: "pnpm --filter @pokemon-tactic/app dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    // VITE_E2E ouvre `?seed=` (voir `packages/app/src/capture-seed.ts`) — c'est lui qui rend la
    // séquence reproductible. Strictement local : le drapeau est éliminé des builds publiés.
    env: { VITE_E2E: "true", PT_PORT: String(port) },
    stdout: "ignore",
    stderr: "pipe",
  },
});
