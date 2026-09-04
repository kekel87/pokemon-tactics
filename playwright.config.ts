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

/**
 * Annuaire de mise en relation LOCAL pour les specs du jeu en ligne (plan 199, étape 8).
 *
 * Le jeu passe en production par le service public de PeerJS. Le faire faire à la suite e2e la
 * rendrait dépendante d'un **tiers sans engagement de service** : une coupure d'Internet, ou une
 * panne chez eux, rendrait le gate local rouge sans qu'une seule ligne de notre code ait changé. Le
 * projet publie un serveur autonome (paquet `peer`), qu'on lance donc ici.
 *
 * Port dérivé de celui de l'app, comme le port e2e l'est du port de dev : deux worktrees qui jouent
 * la suite en parallèle ne se disputent pas l'annuaire.
 */
const SIGNALLING_PORT_OFFSET = 100;
const signallingPort = port + SIGNALLING_PORT_OFFSET;

export default defineConfig({
  testDir: "./e2e",
  // Chaque test boote sa propre scène seedée (aucun état partagé entre tests) → on parallélise AU
  // NIVEAU DU TEST, pas seulement du fichier. Sans ça les N tests d'un même spec tournent en série
  // sur un worker (mesuré : spec 9 tests 45→21 s). Voir plan 170.
  fullyParallel: true,
  // Determinism over speed-of-flakiness: no implicit retries locally; CI absorbs GPU/timing jitter.
  retries: process.env.CI ? 2 : 0,
  /**
   * 3 workers au lieu du défaut Playwright (cœurs / 2, soit 8 ici).
   *
   * Motif (2026-08-25) : 8 Chromium avec WebGL saturaient les 16 cœurs pendant ~12 min, rendant le
   * poste inutilisable pour travailler ou jouer en parallèle. Le plafond CPU/RAM du noyau est posé
   * par `scripts/with-cpu-cap.sh` (c'est lui qui BORNE) ; ce réglage-ci évite juste que Playwright
   * ouvre 8 navigateurs pour se les faire étrangler par le cgroup — 3 workers dans 4 cœurs avancent
   * mieux que 8 qui se battent.
   *
   * Lu ici plutôt que passé en `--workers` afin que TOUTES les entrées en profitent, y compris
   * `scripts/e2e-affected.ts` qui construit ses propres arguments.
   *
   * `PT_FULL_SPEED=1` rend la main au défaut Playwright (runs où personne n'utilise la machine).
   */
  workers: process.env.PT_FULL_SPEED ? undefined : Number(process.env.PT_E2E_WORKERS ?? 3),
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
    // WebGL headless : le rendu Babylon a besoin de WebGL. En local (harnais e2e local-only) on
    // laisse Chromium utiliser le GPU matériel — mesuré ~16 % plus rapide sous contention que le
    // rendu logiciel, et 0 coût (machine avec GPU). SwiftShader (rendu logiciel) n'est forcé que
    // sous CI headless sans GPU, où le fallback est désactivé par défaut → sinon la scène ne se
    // monte jamais (`waitReady` timeout sur tous les combat specs). Voir plan 170.
    launchOptions: {
      args: process.env.CI
        ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
    },
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.01 },
  },
  projects: [
    { name: "smoke", testMatch: "**/smoke/**/*.spec.ts" },
    // 60s comme `combat`, et pour la même raison (mesuré 2026-08-25, plan 187). Trois specs de ce
    // projet font un RECHARGEMENT complet de page : en dev, Vite re-sert tout le graphe de modules
    // non bundlé depuis un seul serveur partagé par tous les workers. Isolées, ces 17 tests passent en 24 s
    // (~1,4 s chacun) ; dans la suite complète un seul dépassait 30 s — une dégradation de plus de
    // 20× qui ne vient pas d'un chemin de code mais de la file d'attente. Le projet a basculé quand
    // la suite a grossi de 17 tests, ce que le plan 179 avait annoncé (« `dom` frôle son délai »).
    { name: "dom", testMatch: "**/dom/**/*.spec.ts", timeout: 60_000 },
    // 60s (vs 30s défaut) : le boot Babylon sous SwiftShader (rendu logiciel) est lourd, et les tests
    // de comparaison bootent 2-4 scènes → sous forte parallélisation le budget 30s déborde (flake de
    // charge, pas de déterminisme). Le rendu reste déterministe ; seul le temps de boot varie.
    { name: "combat", testMatch: "**/combat/**/*.spec.ts", timeout: 60_000 },
    { name: "visual", testMatch: "**/visual/**/*.spec.ts", retries: 0 },
  ].map((project) => ({ ...project, use: { ...devices["Desktop Chrome"], locale: "fr-FR" } })),
  webServer: [
    {
      command: "pnpm --filter @pokemon-tactic/app dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // VITE_E2E unlocks the read-only scene-graph debug hook (stripped from prod builds).
      env: { VITE_E2E: "true", PT_PORT: String(port) },
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // `GET /` d'un PeerServer répond 200 : c'est un signal de disponibilité suffisant, et il évite
      // d'appeler `/peerjs/id`, qui **consomme** un identifiant à chaque appel.
      command: `npx peerjs --port ${signallingPort} --path /`,
      url: `http://localhost:${signallingPort}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});

/** Le port de l'annuaire local, lu par les specs du jeu en ligne pour construire leur URL. */
export { signallingPort };
