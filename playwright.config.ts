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

/**
 * Ce qui sert l'application aux tests : un BUILD, pas le serveur de développement.
 *
 * Mesuré le 2026-09-05, mêmes tests, même machine, même GPU — 50 tests de combat :
 *
 *   serveur de dev … 104 s          build servi …  42 s
 *
 * Et sur la suite entière : **24,3 min → 4,0 min**. Le coût dominant d'un test e2e n'était ni le
 * moteur, ni l'assertion : c'était le `page.goto()`. En développement, Vite sert le graphe de
 * modules NON BUNDLÉ — des centaines de requêtes par navigation, transformées à la volée, depuis un
 * seul serveur que tous les workers se partagent. Chaque test rejouait ce péage. Le bundle, lui,
 * tient en trois fichiers déjà transformés.
 *
 * Ça ne coûte presque rien à produire : rolldown reconstruit l'application en **611 ms**, donc le
 * build fait partie du démarrage du serveur sans se voir.
 *
 * `PT_E2E_DEV=1` rend le serveur de développement, pour DÉBOGUER un test (rechargement à chaud,
 * sources non minifiées, `--ui` / `--headed` confortables). Jamais pour mesurer : les chiffres
 * ci-dessus ne valent que pour le build.
 */
const appServerCommand = process.env.PT_E2E_DEV
  ? "pnpm --filter @pokemon-tactic/app dev"
  : `pnpm --filter @pokemon-tactic/app build && pnpm --filter @pokemon-tactic/app exec vite preview --port ${port} --strictPort`;

/**
 * Arguments Chromium sélectionnant le rasteriseur LOGICIEL, quand aucun GPU n'est disponible.
 *
 * Deux implémentations existent, et elles ne se valent pas :
 *
 * - **SwiftShader** (défaut historique) — écrit par Google, EMBARQUÉ dans Chromium, choisi tout
 *   seul en l'absence de GPU. Il vise la portabilité (mêmes pixels partout), pas la vitesse :
 *   mesuré à ~999 % de CPU sur une charge 3D soutenue, soit ~10 cœurs pour un onglet. Sur un
 *   runner GitHub à 4 vCPU, le budget est dépassé d'un facteur ~2,5 par onglet → c'est la cause
 *   mécanique des « tous les tests combat timeout » qui avaient exclu l'e2e de la CI.
 * - **llvmpipe** — le rasteriseur logiciel de Mesa (pile graphique de Linux). Compile les shaders
 *   en code machine via LLVM et rastérise par tuiles réparties sur tous les cœurs, donc taillé
 *   pour un CPU multicœur. Benchmarks tiers : ~4× moins de CPU/temps que SwiftShader sur du 3D.
 *   Il n'est PAS embarqué : le runner doit installer les paquets Mesa, et Chromium doit recevoir
 *   `--use-angle=gl` pour prendre le pilote OpenGL DU SYSTÈME au lieu du sien.
 *
 * Deux pièges des sources, à ne pas réintroduire : `--disable-gpu` réactive SwiftShader en
 * silence (on croit mesurer llvmpipe, on mesure l'autre) ; et **lavapipe** — le pilote VULKAN de
 * Mesa, au nom trompeusement voisin — casse WebGL par extensions manquantes. Ce n'est pas llvmpipe.
 *
 * ⚠️ **Ne PAS passer une liste d'arguments vide en croyant obtenir le GPU** — c'est ce que faisait
 * ce fichier, et la mesure du 2026-09-05 l'a démenti : sans argument, Chromium headless retombe sur
 * SwiftShader. La suite locale tournait donc en rendu logiciel sur une machine équipée d'une Radeon
 * RX 7900 XT inutilisée. Sondé (`scripts/webgl-probe.ts`) :
 *
 *   (aucun argument)                  → ANGLE (Google, SwiftShader driver)
 *   --use-gl=angle --use-angle=gl     → ANGLE (AMD, Radeon RX 7900 XT (radeonsi navi31), OpenGL 4.6)
 *
 * `--use-angle=gl` demande le pilote OpenGL DU SYSTÈME : Mesa sert alors le GPU s'il y en a un
 * (`radeonsi` ici), et llvmpipe s'il n'y en a pas et que `LIBGL_ALWAYS_SOFTWARE=1` est posé. Un
 * seul couple d'arguments couvre donc les deux cas — c'est l'environnement qui tranche.
 *
 * `PT_GL` arbitre, pour que le workflow de comparaison lance les rasteriseurs sur le même runner :
 *   - `system`       → pilote OpenGL du système : GPU réel en local, llvmpipe sur un runner Mesa
 *                      avec `LIBGL_ALWAYS_SOFTWARE=1` (défaut local)
 *   - `swiftshader`  → Google, embarqué (défaut sous CI, comportement historique inchangé)
 */
function rasterizerArgs(): string[] {
  const requested = process.env.PT_GL ?? (process.env.CI ? "swiftshader" : "system");
  if (requested === "swiftshader") {
    return ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  }
  if (requested === "system") {
    return ["--use-gl=angle", "--use-angle=gl"];
  }
  // Refus explicite plutôt qu'un repli silencieux : tout le propos de ce réglage est que ces
  // arguments échouent SANS RIEN DIRE. Une faute de frappe qui donnerait le rasteriseur par défaut
  // ferait mesurer autre chose que ce qu'on croit mesurer — le piège exact qu'on cherche à éviter.
  throw new Error(
    `PT_GL="${requested}" inconnu — valeurs acceptées : "system" (pilote OpenGL du système) ou "swiftshader" (rasteriseur embarqué de Chromium).`,
  );
}

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
    // rendu logiciel, et 0 coût (machine avec GPU). Un rasteriseur LOGICIEL n'est forcé que sous CI
    // headless sans GPU, où le fallback est désactivé par défaut → sinon la scène ne se monte jamais
    // (`waitReady` timeout sur tous les combat specs). Voir plan 170.
    launchOptions: { args: rasterizerArgs() },
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
      command: appServerCommand,
      url: baseURL,
      /*
       * 🔴 On ne réutilise un serveur existant QUE s'il sert le développement.
       *
       * Réutiliser un `vite preview` déjà debout revient à sauter la commande — donc le BUILD — et
       * à tester un bundle périmé, avec un vert qui ne prouve rien. C'est arrivé (revue du
       * 2026-09-05) : un serveur orphelin d'un gate précédent répondait encore sur le port, et la
       * suite suivante a passé sans jamais recompiler. Un serveur de développement, lui, transforme
       * à la demande : le réutiliser est inoffensif, et c'est tout l'intérêt de `PT_E2E_DEV=1`.
       */
      reuseExistingServer: Boolean(process.env.PT_E2E_DEV),
      timeout: 120_000,
      // VITE_E2E unlocks the read-only scene-graph debug hook (stripped from prod builds). Il est
      // lu à la COMPILATION (`import.meta.env`), donc il doit être posé sur le build autant que sur
      // le serveur — c'est le cas ici, la variable couvre toute la commande.
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
