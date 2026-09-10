#!/usr/bin/env tsx
/**
 * e2e-affected — choisit le NIVEAU de suite e2e à lancer d'après le diff git, et lance Playwright.
 *
 * 3 niveaux (plan 170) :
 *   L1 smoke    — le tour des écrans. Plancher, joint à TOUS les niveaux.
 *   L2 affected — sous-ensemble calculé du diff, par correspondance famille de code → famille de
 *                 specs (voir `SOURCE_TO_FAMILIES`), plus la piste fine du tuning de move.
 *   L3 full     — tout. Réservé au diff qu'on ne sait honnêtement pas scoper.
 *
 * Biais conservateur : tout doute → L3. Un faux positif coûte du temps ; un faux négatif cache une
 * régression → interdit. **Le filet exhaustif est la suite GitHub** (`.github/workflows/e2e.yml`,
 * les 531 à chaque poussée vers `main` et chaque nuit), et `/publish` refuse de publier sur son
 * rouge — ce n'est plus `/ci-gate slow`, qui reste le recours hors ligne.
 *
 * ⚠️ **Ce que la version d'avant le 2026-09-05 faisait vraiment** : elle n'avait qu'un cran
 * d'escalade, et il se déclenchait sur `packages/core/`, tout le rendu, toute l'UI, `packages/app/`,
 * un `package.json` ou un `tsconfig`. Comme une séance de travail touche presque toujours l'un
 * d'eux, le niveau EFFECTIF était « les 531, toujours » — les 24 minutes que le gate coûtait. La
 * table de correspondance est la moitié qui manquait, pas un raffinement.
 *
 * ⚠️ **Le piège du commit WIP** (mesuré le 2026-09-08) : par défaut la comparaison se fait contre
 * `HEAD`, donc contre le DERNIER COMMIT. Or `feedback_wip_commit_retest_before_final` impose un
 * commit WIP avant la revue — passé ce commit, `HEAD` contient déjà tout le lot et il ne reste
 * presque rien à comparer. Relevé ce jour-là : **14 tests joués au lieu de 531** sur un lot qui
 * touchait six paquets, gate vert en ayant validé une fraction du travail. `--since-main` existe
 * pour ça : il cadre sur la base du LOT — le point de divergence d'avec `origin/main` — au lieu du
 * dernier commit. Le tier `full` de `/ci-gate` le passe systématiquement.
 *
 * Usage :
 *   tsx scripts/e2e-affected.ts [baseRef] [--since-main] [--print] [--level=smoke|affected|full]
 *   baseRef      ref de comparaison (défaut : arbre de travail vs HEAD).
 *   --since-main cadre sur le lot entier : point de divergence d'avec `origin/main`. Ignoré si un
 *                `baseRef` explicite est donné.
 *   --print      imprime le niveau + les commandes, ne lance pas.
 *   --level      force un niveau (court-circuite le calcul).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SMOKE_GLOB = "e2e/tests/smoke";
const COMBAT_GLOB = "e2e/tests/combat";
const SANDBOX_CONFIGS = "e2e/fixtures/sandbox-configs.ts";

const LEVELS = ["smoke", "affected", "full"] as const;
export type Level = (typeof LEVELS)[number];

export interface Decision {
  level: Level;
  reason: string;
  /**
   * Invocations `playwright test` à lancer en séquence (échec de l'une = échec global). Une liste
   * d'args par invocation. Plusieurs invocations sont nécessaires car `--only-changed` s'INTERSECTE
   * (AND) avec un filtre positionnel de chemin au lieu de s'unir — mêler les deux dans un seul appel
   * ne lancerait aucun test. Args vides `[]` = toute la suite. Plusieurs positionnels s'unionnent.
   */
  runs: string[][];
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * Comme `git`, mais rend `undefined` au lieu de jeter — pour les refs qui peuvent ne pas exister.
 *
 * `stderr` est capturé, pas hérité : `execFileSync` le laisse filer vers le terminal par défaut,
 * donc une ref absente crachait un « fatal: Not a valid object name » brut au milieu du gate, alors
 * même que l'échec est ATTENDU et rattrapé ici. Un message d'erreur sans contexte au milieu d'une
 * sortie verte est pire qu'aucun message.
 */
function gitOrUndefined(args: string[]): string | undefined {
  try {
    const out = execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Base du LOT : le point où le travail courant a divergé de `main`.
 *
 * Pourquoi le point de divergence plutôt que `origin/main` tel quel : sur une branche en retard,
 * comparer directement à `origin/main` compte AUSSI l'avance de `main` comme des changements du
 * lot — des fichiers que ce travail n'a jamais touchés, donc un périmètre gonflé pour rien. Le
 * point de divergence donne exactement ce que le lot a écrit, commit WIP compris.
 *
 * `origin/main` d'abord (la référence partagée), `main` en repli (dépôt sans distant, ou `fetch`
 * jamais fait). Aucune des deux → `undefined` : l'appelant retombe sur le comportement par défaut
 * (`HEAD`) et le dit, plutôt que d'échouer.
 *
 * La ref RETENUE ressort avec la base : tomber sur `main` local au lieu d'`origin/main` décale le
 * périmètre, et l'appelant doit pouvoir le dire. Un repli muet est le défaut que ce fichier
 * corrige ; s'en offrir un de plus dans le correctif serait une farce.
 */
function resolveLotBase(): { base: string; ref: string } | undefined {
  for (const ref of ["origin/main", "main"]) {
    const base = gitOrUndefined(["merge-base", ref, "HEAD"]);
    if (base !== undefined) {
      return { base, ref };
    }
  }
  return undefined;
}

/** Fichiers changés vs base : suivis (staged + non-staged) + non suivis non ignorés. */
function changedFiles(baseRef: string | undefined): string[] {
  // Dry-run : liste de chemins injectée (séparés par des virgules) pour prévisualiser un diff
  // hypothétique — `PT_AFFECTED_FILES="packages/core/x.ts" tsx scripts/e2e-affected.ts --print`.
  // Garde truthy volontaire : une valeur vide n'écrase pas le diff réel par une liste vide.
  const injected = process.env.PT_AFFECTED_FILES;
  if (injected) {
    return [
      ...new Set(
        injected
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      ),
    ];
  }
  const tracked = baseRef
    ? git(["diff", "--name-only", baseRef])
    : git(["diff", "--name-only", "HEAD"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  const all = [...tracked.split("\n"), ...untracked.split("\n")].map((f) => f.trim());
  return [...new Set(all.filter((f) => f.length > 0))];
}

// --- Classement des chemins -------------------------------------------------

/**
 * Fichiers racine qui ne produisent aucun octet livré : les toucher ne peut casser aucun écran.
 * Sans cette liste, une ligne ajoutée à `.gitignore` faisait « chemin non classé → sûreté », donc
 * les 531 tests (mesuré à la revue du 2026-09-05).
 */
const ROOT_NON_CODE = new Set([
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".npmrc",
  ".nvmrc",
  "LICENSE",
  "renovate.json",
]);

const isNonCode = (f: string) =>
  f.startsWith("docs/") || f.endsWith(".md") || f.startsWith(".claude/") || ROOT_NON_CODE.has(f);
const isE2e = (f: string) => f.startsWith("e2e/");
const isConfigBuild = (f: string) =>
  /(^|\/)(playwright\.config|vitest\.config|vite\.config)\.[cm]?tsx?$/.test(f) ||
  /(^|\/)package\.json$/.test(f) ||
  /(^|\/)pnpm-lock\.yaml$/.test(f) ||
  /(^|\/)tsconfig[^/]*\.json$/.test(f) ||
  /(^|\/)biome\.jsonc?$/.test(f);
/** Data confiné au tuning de move : overrides tactiques + JSON de référence moves/abilities. */
const isMoveTuningData = (f: string) =>
  f === "packages/data/src/overrides/tactical.ts" ||
  f === "packages/data/src/overrides/balance-v1.ts" ||
  f === "packages/data/reference/moves.json" ||
  f === "packages/data/reference/abilities.json";
const isData = (f: string) => f.startsWith("packages/data/");

// --- Familles de specs ------------------------------------------------------

/**
 * Le sélecteur n'avait qu'UN cran d'escalade : « je ne sais pas scoper → je lance tout ». Comme le
 * cœur du jeu (`core`, `app`, rendu, UI) bouge à presque chaque séance, la branche L2 ne se
 * déclenchait quasiment jamais et le niveau réel était « les 531, toujours » — 24 minutes.
 *
 * La moitié manquante est ici : une correspondance **famille de code → famille de specs**, pour que
 * toucher au salon en ligne ne rejoue pas les 218 specs de mécanique, et réciproquement.
 */
export type Family = "tour" | "dom" | "mechanics" | "combat" | "visual" | "online" | "input";

/**
 * Specs de saisie — elles chevauchent `combat` et `dom`, donc elles sont nommées une par une
 * plutôt que déduites d'un dossier.
 */
export const INPUT_SPEC_NAMES = new Set([
  "e2e/tests/combat/keyboard-controls.spec.ts",
  "e2e/tests/combat/touch-controls.spec.ts",
  "e2e/tests/combat/input-prompt-glyph.spec.ts",
  "e2e/tests/combat/controls-remapping.spec.ts",
  "e2e/tests/combat/camera-pan-keyboard.spec.ts",
  "e2e/tests/combat/chrome-key-hints.spec.ts",
  "e2e/tests/combat/compass-and-legend.spec.ts",
  "e2e/tests/dom/gamepad-menus.spec.ts",
  "e2e/tests/dom/gamepad-pickers.spec.ts",
  "e2e/tests/dom/screen-keyboard.spec.ts",
  "e2e/tests/dom/controls-remapping.spec.ts",
]);

const isMechanicsSpec = (spec: string) => spec.startsWith(`${COMBAT_GLOB}/mechanics-`);

const FAMILY_MATCHES: Readonly<Record<Family, (spec: string) => boolean>> = {
  // Le plancher : le tour des écrans + le splash. Toujours joint, quoi qu'ait touché le diff.
  tour: (spec) => spec.startsWith(`${SMOKE_GLOB}/`),
  dom: (spec) => spec.startsWith("e2e/tests/dom/"),
  visual: (spec) => spec.startsWith("e2e/tests/visual/"),
  mechanics: isMechanicsSpec,
  // « combat sans les mécaniques » : interface de combat, caméra, placement, scène, aperçu…
  combat: (spec) => spec.startsWith(`${COMBAT_GLOB}/`) && !isMechanicsSpec(spec),
  /*
   * 🔴 **Tous** les specs du jeu en ligne, et pas seulement celui du salon.
   *
   * La famille ne nommait que `online-lobby.spec.ts`, qui était le seul spec en ligne quand elle a
   * été écrite. Depuis, le Lot B3 a livré `online-resilience.spec.ts` et le Lot B4
   * `online-determinism.spec.ts` — c'est-à-dire précisément les deux specs qui gardent ce qu'un
   * changement sous `packages/network/` ou `packages/app/src/network/` peut casser, et ils n'étaient
   * pas rejoués par le gate. Un filet qui ne se déclenche pas sur son propre sujet n'est pas un
   * filet. Ils vivent tous dans `tests/dom/`, donc le préfixe suffit et le prochain n'aura rien à
   * déclarer (relevé en écrivant le Lot B4).
   */
  online: (spec) => spec.startsWith("e2e/tests/dom/online-"),
  input: (spec) => INPUT_SPEC_NAMES.has(spec),
};

/**
 * Correspondance chemin de source → familles de specs à rejouer. Premier motif qui matche gagne ;
 * un fichier qui ne matche AUCUNE règle fait escalader en `full` (le biais conservateur d'origine
 * est conservé : un faux négatif cacherait une régression).
 *
 * ⚠️ **Arbitrage assumé sur le rendu** (2026-09-05) : un changement de `render-*` / `view-core`
 * NE rejoue PAS les 218 specs de mécanique, alors qu'il pourrait en casser (certaines lisent le
 * graphe de scène, par exemple l'icône de statut). Le motif : ces 218 specs sont une suite de
 * COUVERTURE paramétrée — le même chemin de câblage rejoué avec un identifiant différent, la
 * variation métier étant déjà tenue par les tests unitaires et d'intégration du core. Les rejouer à
 * chaque retouche de rendu coûtait ~10 min pour une information que le filet complet donne aussi.
 * Le filet complet reste donc la contrepartie NON NÉGOCIABLE de cet arbitrage : **la suite
 * GitHub**, dont `/publish` lit le verdict (`pnpm e2e:status`). Si elle cesse d'être jouée ou
 * lue, cette ligne doit être remise à `mechanics`.
 */
const SOURCE_TO_FAMILIES: ReadonlyArray<{
  readonly label: string;
  readonly matches: (file: string) => boolean;
  readonly families: readonly Family[];
}> = [
  {
    label: "moteur de combat",
    matches: (f) => f.startsWith("packages/core/battle/"),
    families: ["mechanics"],
  },
  {
    label: "grille / traversée",
    matches: (f) => f.startsWith("packages/core/grid/"),
    families: ["mechanics", "combat"],
  },
  { label: "IA", matches: (f) => f.startsWith("packages/core/ai/"), families: ["combat"] },
  {
    label: "équipes (core)",
    matches: (f) => f.startsWith("packages/core/team/"),
    families: ["combat", "dom"],
  },
  {
    label: "core (autre)",
    matches: (f) => f.startsWith("packages/core/"),
    families: ["mechanics", "combat", "dom"],
  },
  {
    label: "réseau",
    matches: (f) => f.startsWith("packages/network/") || f.startsWith("packages/app/src/network/"),
    families: ["online"],
  },
  {
    label: "saisie (clavier / manette / tactile)",
    matches: (f) => f.startsWith("packages/app/src/input/"),
    families: ["input"],
  },
  {
    label: "rendu",
    matches: (f) =>
      /^packages\/(render-babylon|render-canvas2d|render-ports|renderer|view-core)\//.test(f) ||
      f.startsWith("packages/app/src/babylon/"),
    families: ["combat", "visual"],
  },
  {
    label: "interface de combat partagée",
    matches: (f) => f.startsWith("packages/ui-dom/"),
    families: ["combat", "dom"],
  },
  {
    label: "écrans / styles de l'app",
    matches: (f) =>
      f.startsWith("packages/app/src/ui/") || f.startsWith("packages/app/src/styles/"),
    families: ["dom", "combat"],
  },
  {
    label: "cartes",
    matches: (f) => f.startsWith("packages/app/src/maps/") || f.startsWith("packages/app/maps/"),
    families: ["dom", "combat"],
  },
  {
    label: "app (autre)",
    matches: (f) => f.startsWith("packages/app/"),
    families: ["dom", "combat"],
  },
  {
    // Aucune couverture e2e : le Worker est testé par ses propres tests d'intégration.
    label: "télémétrie",
    matches: (f) => f.startsWith("packages/telemetry-worker/"),
    families: [],
  },
  {
    // Outillage : ne part pas dans le bundle, donc ne peut pas casser un écran. Ce que produisent
    // les scripts d'assets est versionné — c'est le produit qui compte, pas le script.
    label: "outillage",
    matches: (f) => f.startsWith("scripts/") || f.startsWith(".github/"),
    families: [],
  },
];

// --- Heuristique move-id (L2 resserré) --------------------------------------

interface LineChangeInfo {
  /** Lignes (1-based, post-image) touchées, pour remonter au move englobant. */
  nums: number[];
  /**
   * Un hunk supprime des lignes sans en ajouter (post-image `+c,0`) : le contenu retiré n'existe plus
   * dans l'arbre de travail, on ne peut pas mapper l'id supprimé → ambigu, on escaladera en full.
   */
  hasPureDeletion: boolean;
}

function changedLineInfo(file: string, baseRef: string | undefined): LineChangeInfo {
  const base = baseRef ?? "HEAD";
  const patch = git(["diff", base, "-U0", "--no-color", "--", file]);
  const nums: number[] = [];
  let hasPureDeletion = false;
  for (const line of patch.split("\n")) {
    // En-tête de hunk : @@ -a,b +c,d @@  (d omis ⇒ 1).
    const header = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!header) {
      continue;
    }
    const start = Number(header[1]);
    const count = header[2] === undefined ? 1 : Number(header[2]);
    if (count === 0) {
      hasPureDeletion = true;
      continue;
    }
    for (let index = 0; index < count; index += 1) {
      nums.push(start + index);
    }
  }
  return { nums, hasPureDeletion };
}

interface ChangedIds {
  ids: string[];
  /** Diff non mappable de façon fiable (suppression pure) → l'appelant doit escalader en full. */
  ambiguous: boolean;
}

/**
 * Ids de move/ability concernés par le diff des fichiers data. Pour chaque ligne changée, on remonte
 * jusqu'à la clé englobante — la clé top-level d'un move dans `tactical.ts` (`  "some-move": {`) ou
 * le champ `"id": "…"` le plus proche dans les JSON de référence — pour capter aussi un simple tuning
 * de VALEUR (la ligne-clé reste alors en contexte, hors des lignes +/- du patch).
 */
function changedMoveIds(dataFiles: string[], baseRef: string | undefined): ChangedIds {
  const ids = new Set<string>();
  let ambiguous = false;
  for (const file of dataFiles) {
    if (!existsSync(file)) {
      continue;
    }
    const { nums, hasPureDeletion } = changedLineInfo(file, baseRef);
    if (hasPureDeletion) {
      ambiguous = true;
    }
    const lines = readFileSync(file, "utf8").split("\n");
    for (const lineNo of nums) {
      for (let i = Math.min(lineNo, lines.length) - 1; i >= 0; i -= 1) {
        const text = lines[i] ?? "";
        // Clé de move top-level dans `tactical.ts` : quotée pour un id kebab (`  "fake-out":`), non
        // quotée pour un id d'un seul mot (`  scratch:`, identifiant JS valide) — capter les deux.
        const topKey = text.match(/^ {2}(?:"([a-z0-9][a-z0-9-]+)"|([a-z][a-z0-9]*))\s*:/);
        const topKeyId = topKey?.[1] ?? topKey?.[2];
        const idField = text.match(/"id"\s*:\s*"([a-z0-9][a-z0-9-]+)"/); // JSON de référence
        if (topKeyId) {
          ids.add(topKeyId);
          break;
        }
        const idFieldValue = idField?.[1];
        if (idFieldValue !== undefined) {
          ids.add(idFieldValue);
          break;
        }
      }
    }
  }
  return { ids: [...ids], ambiguous };
}

// --- Résolution id → constantes de config → specs ---------------------------

/** Toutes les constantes de `sandbox-configs.ts` (exportées ou non) : nom → corps littéral. */
export function parseConstBlocks(sandboxSource: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const blockRe =
    /(?:export\s+)?const ([A-Za-z0-9_]+)\s*=([\s\S]*?)(?=\n(?:export\s+)?const |\n?$)/g;
  for (let m = blockRe.exec(sandboxSource); m !== null; m = blockRe.exec(sandboxSource)) {
    const [, name, body] = m;
    if (name !== undefined && body !== undefined) {
      blocks.set(name, body);
    }
  }
  return blocks;
}

/**
 * Constantes de config « portant » l'id : celles dont le corps contient littéralement `"<id>"`, PLUS
 * toutes celles qui les héritent par spread (`{ ...BASE }`), transitivement. Sinon un spec qui ne
 * référence qu'une const dérivée (ex. `POISONED = { ...DUEL }`, `DUEL` portant le move) serait raté.
 */
export function configConstsForId(id: string, constBlocks: Map<string, string>): string[] {
  const needle = `"${id}"`;
  const carrying = new Set<string>();
  for (const [name, body] of constBlocks) {
    if (body.includes(needle)) {
      carrying.add(name);
    }
  }
  // Fermeture transitive : ajoute toute const qui spread (`...X`) une const déjà retenue.
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, body] of constBlocks) {
      if (carrying.has(name)) {
        continue;
      }
      for (const base of carrying) {
        if (new RegExp(`\\.\\.\\.${base}\\b`).test(body)) {
          carrying.add(name);
          grew = true;
          break;
        }
      }
    }
  }
  return [...carrying];
}

/**
 * Les specs de combat, listés UNE fois. `specsForId` est appelé par identifiant changé — un
 * re-tuning d'une dizaine de moves relançait donc `git ls-files` dix fois, et relisait chaque spec
 * autant de fois.
 */
function combatSpecFiles(): string[] {
  return git(["ls-files", `${COMBAT_GLOB}/*.spec.ts`])
    .split("\n")
    .filter(Boolean);
}

/** Specs combat référençant l'id — directement, ou via une constante de config (spreads inclus). */
function specsForId(
  id: string,
  constBlocks: Map<string, string>,
  specFiles: readonly string[],
): string[] {
  const matched = new Set<string>();
  const directNeedle = `"${id}"`;
  const consts = configConstsForId(id, constBlocks);
  for (const spec of specFiles) {
    const src = readFileSync(spec, "utf8");
    if (src.includes(directNeedle) || consts.some((c) => new RegExp(`\\b${c}\\b`).test(src))) {
      matched.add(spec);
    }
  }
  return [...matched];
}

// --- Décision ---------------------------------------------------------------

const SMOKE_RUN: string[] = [SMOKE_GLOB];
const FULL_RUN: string[] = [];

/**
 * Tous les specs, la résolution des familles part de là.
 *
 * Les NON SUIVIS comptent : un spec tout juste écrit n'est pas encore dans l'index git, et
 * l'oublier ici reviendrait à ne jamais jouer le test qu'on vient d'ajouter — précisément celui
 * qu'on veut voir tourner.
 */
function allSpecs(): string[] {
  const tracked = git(["ls-files", "e2e/tests/**/*.spec.ts"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "e2e/tests/"]);
  const all = [...tracked.split("\n"), ...untracked.split("\n")]
    .map((f) => f.trim())
    .filter((f) => f.endsWith(".spec.ts"));
  return [...new Set(all)];
}

/**
 * Résolution famille par famille, et PAS seulement l'union.
 *
 * 🔴 Le détail par famille est ce qui rend une famille MUETTE détectable. Le motif d'une famille
 * peut cesser de matcher — dossier renommé, spec déplacé — et l'ancienne résolution par union
 * rendait alors zéro spec POUR CETTE FAMILLE sans que rien ne bouge : `tour` est toujours ajouté,
 * donc l'union reste non vide, donc la sélection paraît saine. Le message restait rassurant
 * (« L2 affected — réseau → familles : online, tour ») en ne jouant que les deux specs de smoke.
 * Relevé en revue du Lot B4, le 2026-09-10.
 */
export function specsByFamily(
  families: ReadonlySet<Family>,
  specs: readonly string[],
): Map<Family, string[]> {
  const byFamily = new Map<Family, string[]>();
  for (const family of families) {
    byFamily.set(
      family,
      specs.filter((spec) => FAMILY_MATCHES[family](spec)),
    );
  }
  return byFamily;
}

/**
 * Ce que la résolution des familles a de CASSÉ — motifs qui ne matchent plus, pas périmètres
 * légitimement vides. Non vide ⇒ l'appelant escalade en suite entière plutôt que d'annoncer un
 * périmètre qu'il ne joue pas.
 *
 * Deux modes de panne, et le second est le plus sournois :
 *
 * 1. **Famille entièrement muette** — le dossier a été renommé, la famille rend zéro spec. Le
 *    plancher `tour` maintient l'union non vide, donc rien ne se voyait.
 * 2. **Dérive PARTIELLE de `input`** — seule famille définie par une liste de noms en dur, donc la
 *    seule qui peut perdre un spec sans se vider. Renommer un seul des onze en laisse dix : la
 *    famille reste non vide, aucune escalade, et le spec disparaît sans un mot. C'est exactement
 *    le scénario que le premier point prétend fermer, et il y échappait (relevé en revue,
 *    2026-09-10). D'où le contrôle de la liste elle-même, et pas seulement de son agrégat.
 */
export function selectionDefects(
  families: ReadonlySet<Family>,
  specs: readonly string[],
): string[] {
  const defects: string[] = [];
  const mute = [...specsByFamily(families, specs)]
    .filter(([, matched]) => matched.length === 0)
    .map(([family]) => family);
  if (mute.length > 0) {
    defects.push(
      `famille(s) sans aucun spec : ${mute.join(", ")} — motif cassé (dossier renommé ? spec déplacé ?)`,
    );
  }
  if (families.has("input")) {
    const known = new Set(specs);
    const missing = [...INPUT_SPEC_NAMES].filter((name) => !known.has(name));
    if (missing.length > 0) {
      defects.push(
        `spec(s) de saisie nommé(s) dans INPUT_SPEC_NAMES mais introuvable(s) : ${missing.join(", ")}`,
      );
    }
  }
  return defects;
}

export interface Routing {
  families: Set<Family>;
  /** Chemins de source qu'aucune règle ne classe → on ne sait pas scoper, donc `full`. */
  unclassified: string[];
  /** Étiquettes des règles ayant matché, pour que la raison affichée soit lisible. */
  labels: Set<string>;
}

/** Passe chaque fichier changé dans la table, et réunit les familles de specs concernées. */
export function route(files: readonly string[]): Routing {
  const families = new Set<Family>();
  const labels = new Set<string>();
  const unclassified: string[] = [];
  for (const file of files) {
    const rule = SOURCE_TO_FAMILIES.find((candidate) => candidate.matches(file));
    if (!rule) {
      unclassified.push(file);
      continue;
    }
    labels.add(rule.label);
    for (const family of rule.families) {
      families.add(family);
    }
  }
  return { families, unclassified, labels };
}

/**
 * Entrées que les tests injectent à la place de git. Chacune est facultative : sans elle, `decide`
 * interroge le dépôt comme en vrai. C'est de la logique de sélection PURE, elle mérite d'être
 * jouée sans dépendre de l'état du dépôt du moment.
 */
export interface DecideInputs {
  /** Remplace le diff git. Priorité sur `PT_AFFECTED_FILES`. */
  readonly files?: readonly string[];
  /** Remplace la liste des specs du dépôt. */
  readonly specs?: readonly string[];
}

export function decide(baseRef: string | undefined, injected: DecideInputs = {}): Decision {
  const files = injected.files === undefined ? changedFiles(baseRef) : [...injected.files];
  if (files.length === 0) {
    return { level: "smoke", reason: "aucun changement détecté", runs: [SMOKE_RUN] };
  }
  if (files.every(isNonCode)) {
    return { level: "smoke", reason: "diff non-code (docs/config .claude)", runs: [SMOKE_RUN] };
  }

  /*
   * Config/build : le graphe d'import ne dit rien d'utile — un `tsconfig` ou un verrou de
   * dépendances peut tout changer sous les pieds. On lance donc LARGE, mais BORNÉ : le tour des
   * écrans, les specs `dom`, le combat hors mécaniques, et le visuel.
   *
   * Pourquoi plus « tout » (2026-09-05, décision #926) : cette escalade datait d'un monde où le
   * filet exhaustif n'existait qu'en local. Depuis, les 531 tournent sur GitHub à chaque poussée
   * vers `main` et chaque nuit (`.github/workflows/e2e.yml`, ~5 min, sans bloquer personne).
   * Rejouer les 531 EN LOCAL « au cas où » refait à la main ce qu'une machine gratuite fait déjà —
   * et c'est exactement ce qui a rendu ce sélecteur inutile pendant des mois : un simple ajout de
   * script npm dans `package.json` déclenchait 6,4 minutes de e2e.
   *
   * ⚠️ Ça ne tient QUE tant que la suite asynchrone tourne et que son verdict est lu
   * (`pnpm e2e:status`, en tête de `/next`). Si elle s'arrête, remettre `["tour", "dom",
   * "combat", "visual", "mechanics"]` ici. Hors ligne, ou pour une certitude locale
   * immédiate : `/ci-gate slow`.
   */
  //
  // 🔴 Ces familles s'AJOUTENT au reste du calcul, elles ne le remplacent pas. La version qui
  // sortait ici par un `return` faisait qu'un `package.json` dans le diff RÉDUISAIT le périmètre :
  // « toucher au moteur de combat » perdait ses specs de mécanique, et un spec e2e tout neuf
  // n'était pas joué du tout, parce qu'on avait bumpé une dépendance dans le même lot (revue du
  // 2026-09-05, les trois cas mesurés). Une escalade qui rétrécit le périmètre est un contresens.
  const configHits = files.filter(isConfigBuild);
  const configFamilies: readonly Family[] =
    configHits.length > 0 ? ["tour", "dom", "combat", "visual"] : [];

  const codeFiles = files.filter((f) => !isNonCode(f));
  const e2eFiles = codeFiles.filter(isE2e);
  // Les fichiers de config sont déjà traités par `configFamilies` : les laisser passer dans la
  // table les ferait classer « chemin non classé → sûreté », donc la suite entière — ce que la
  // ligne précédente vient précisément d'éviter.
  const sourceFiles = codeFiles.filter((f) => !isE2e(f) && !isConfigBuild(f));

  // Tuning de move : la piste la plus fine qu'on sache suivre — remonter du diff aux identifiants,
  // puis des identifiants aux specs qui les jouent. Réservée au cas où la data touchée n'est QUE
  // du tuning ; sinon la table générique reprend la main.
  const dataFiles = sourceFiles.filter(isData);
  const onlyMoveTuningData = dataFiles.length > 0 && dataFiles.every(isMoveTuningData);
  const otherSources = sourceFiles.filter((f) => !isData(f));

  // Comme pour la configuration : quand la piste fine ne mène nulle part, on ÉLARGIT aux mécaniques
  // sans jeter ce que le reste du diff impose. Un « suppression de move + retouche d'écran » doit
  // jouer les mécaniques ET les écrans, pas seulement les premières.
  const targetedMoveSpecs = new Set<string>();
  const moveFallbackFamilies = new Set<Family>();
  let moveFallbackReason = "";
  if (onlyMoveTuningData) {
    const constBlocks = parseConstBlocks(readFileSync(SANDBOX_CONFIGS, "utf8"));
    const { ids, ambiguous } = changedMoveIds(dataFiles, baseRef);
    const specFiles = combatSpecFiles();
    const unmapped: string[] = [];
    if (ambiguous || ids.length === 0) {
      moveFallbackReason = ambiguous
        ? "suppression de move détectée (non mappable)"
        : "tuning data détecté mais aucun id de move extrait du diff";
    } else {
      for (const id of ids) {
        const specs = specsForId(id, constBlocks, specFiles);
        if (specs.length === 0) {
          unmapped.push(id);
        }
        for (const spec of specs) {
          targetedMoveSpecs.add(spec);
        }
      }
      if (unmapped.length > 0) {
        moveFallbackReason = `move(s) sans spec e2e mappé (${unmapped.join(", ")})`;
      }
    }
    if (moveFallbackReason !== "") {
      moveFallbackFamilies.add("mechanics");
      moveFallbackFamilies.add("combat");
      targetedMoveSpecs.clear();
    }
  }

  // La data hors tuning (pokemon.json, objets, table des types, chargeurs) touche à tout ce qui se
  // joue : mécaniques ET écrans qui affichent ces données.
  const dataFamilies: Family[] =
    dataFiles.length > 0 && !onlyMoveTuningData ? ["mechanics", "combat", "dom"] : [];

  const { families, unclassified, labels } = route(otherSources);
  for (const family of dataFamilies) {
    families.add(family);
  }
  if (dataFamilies.length > 0) {
    labels.add("data (hors tuning de move)");
  }
  for (const family of configFamilies) {
    families.add(family);
  }
  if (configHits.length > 0) {
    labels.add(`config/build (${configHits[0]}) → large mais borné`);
  }
  for (const family of moveFallbackFamilies) {
    families.add(family);
  }
  if (moveFallbackReason !== "") {
    labels.add(`${moveFallbackReason} → repli mécaniques`);
  }

  if (unclassified.length > 0) {
    return {
      level: "full",
      reason: `chemin non classé (${unclassified[0]}) → sûreté`,
      runs: [FULL_RUN],
    };
  }

  // Le plancher, toujours : le tour des écrans coûte quelques secondes et attrape ce qu'un
  // périmètre trop étroit laisserait passer (un écran qui ne monte plus du tout).
  families.add("tour");

  const specs = injected.specs ?? allSpecs();
  const defects = selectionDefects(families, specs);
  if (defects.length > 0) {
    return {
      level: "full",
      reason: `${defects.join(" ; ")} → suite entière, par sûreté`,
      runs: [FULL_RUN],
    };
  }

  // Playwright lirait une liste de chemins VIDE comme « toute la suite » — silencieusement. C'est
  // `selectionDefects` qui ferme ce cas, en amont et en nommant la cause : passé cette garde,
  // chaque famille retenue a au moins un spec, et `tour` en est toujours, donc la sélection ne
  // peut plus être vide.
  const selected = new Set<string>([...specsByFamily(families, specs).values()].flat());
  for (const spec of targetedMoveSpecs) {
    selected.add(spec);
  }
  // Un spec e2e modifié se rejoue, quoi qu'en dise la table.
  for (const spec of e2eFiles.filter((f) => f.endsWith(".spec.ts"))) {
    selected.add(spec);
  }

  // Fixture ou objet de page changé (pas un spec) : le graphe d'import de Playwright sait seul qui
  // en dépend — `--only-changed` le résout, en run séparé (il s'INTERSECTE avec un filtre de
  // chemin, il ne s'y ajoute pas).
  const e2eSupportChanged = e2eFiles.some((f) => !f.endsWith(".spec.ts"));
  const base = baseRef ?? "HEAD";

  const familyList = [...families].join(", ");
  const reasonParts = [
    labels.size > 0 ? [...labels].join(" + ") : "diff e2e seul",
    `→ familles : ${familyList}`,
    targetedMoveSpecs.size > 0 ? `(+ ${targetedMoveSpecs.size} spec(s) de tuning de move)` : "",
    e2eSupportChanged ? `(+ --only-changed depuis ${base})` : "",
  ].filter(Boolean);

  const runs: string[][] = [[...selected]];
  if (e2eSupportChanged) {
    runs.push([`--only-changed=${base}`]);
  }

  return { level: "affected", reason: reasonParts.join(" "), runs };
}

// --- Entrée -----------------------------------------------------------------

function isLevel(value: string | undefined): value is Level {
  return value !== undefined && (LEVELS as readonly string[]).includes(value);
}

const KNOWN_FLAGS = ["--print", "--since-main"] as const;

/**
 * Message d'erreur si un drapeau est inconnu, `undefined` sinon.
 *
 * Liste blanche et pas tolérance : `--level` sortait déjà en 2 sur une valeur invalide, mais
 * `--since-mian` mal tapé était simplement IGNORÉ — repli sur `HEAD`, périmètre étroit, gate vert.
 * La faute de frappe rejouait le défaut même que `--since-main` corrige.
 */
export function unknownFlag(argv: readonly string[]): string | undefined {
  const bad = argv.find(
    (arg) =>
      arg.startsWith("--") &&
      !arg.startsWith("--level=") &&
      !(KNOWN_FLAGS as readonly string[]).includes(arg),
  );
  return bad === undefined
    ? undefined
    : `drapeau inconnu « ${bad} » (attendu : ${[...KNOWN_FLAGS, "--level=…"].join(", ")})`;
}

/** Les refs dont `--since-main` a besoin. Résolues paresseusement : un `merge-base` pour rien sinon. */
export interface LotRefs {
  /** Point de divergence d'avec `main`. `undefined` si ni `origin/main` ni `main` n'existent. */
  readonly base: string | undefined;
  /** La ref d'où vient `base` : `origin/main`, ou `main` en repli. */
  readonly ref: string | undefined;
  /** Sha de `HEAD`, pour dire quand la base du lot ne vaut pas mieux que le défaut. */
  readonly head: string | undefined;
}

export interface BaseRefChoice {
  readonly baseRef: string | undefined;
  /** Ce que l'utilisateur doit savoir avant de croire le périmètre affiché. Jamais silencieux. */
  readonly warnings: string[];
  /** Ligne de commande invalide : l'appelant sort en 2 plutôt que de deviner. */
  readonly error?: string;
}

/**
 * Quelle base de comparaison, et ce qu'il faut en dire. Partie PURE de la décision : `refs` est la
 * seule porte vers git, et les tests la remplacent.
 *
 * Chaque repli parle. Un cadrage qui rétrécit sans le dire est le défaut d'origine de ce fichier ;
 * le reproduire dans son propre correctif serait une farce.
 */
export function resolveBaseRef(argv: readonly string[], refs: () => LotRefs): BaseRefChoice {
  const positionals = argv.filter((arg) => !arg.startsWith("--"));
  const sinceMain = argv.includes("--since-main");
  const warnings: string[] = [];

  // Un second positionnel était avalé sans un mot. Dans un fichier dont tout le sujet est « plus
  // rien de muet », c'est le genre d'incohérence qui finit par coûter un périmètre.
  if (positionals.length > 1) {
    return {
      baseRef: undefined,
      warnings,
      error: `une seule base attendue, ${positionals.length} reçues (${positionals.join(", ")})`,
    };
  }
  const explicitBase = positionals[0];

  if (explicitBase !== undefined) {
    if (sinceMain) {
      warnings.push(`--since-main ignoré : la base explicite « ${explicitBase} » l'emporte`);
    }
    return { baseRef: explicitBase, warnings };
  }
  if (!sinceMain) {
    return { baseRef: undefined, warnings };
  }

  const { base, ref, head } = refs();
  if (base !== undefined && ref === "main") {
    warnings.push(
      "base du lot calculée depuis `main` local — `origin/main` introuvable, périmètre potentiellement décalé",
    );
  }
  if (base === undefined) {
    warnings.push(
      "--since-main sans base de lot (ni origin/main ni main) — repli sur HEAD, périmètre potentiellement étroit",
    );
    return { baseRef: undefined, warnings };
  }
  if (base === head) {
    // Cas courant, pas exceptionnel : avant le premier commit du lot, la base VAUT HEAD. La base
    // existe, donc l'en-tête l'affichait comme une victoire alors qu'elle n'élargit rien. Dire
    // exactement ça — et pas « rien de local », qui serait faux quand l'arbre de travail est sale.
    warnings.push(
      "--since-main : aucun commit local en avance sur `main` — le périmètre se limite à l'arbre de travail",
    );
  }
  return { baseRef: base, warnings };
}

function resolveDecision(baseRef: string | undefined, forced: Level | undefined): Decision {
  if (forced === "smoke") {
    return { level: "smoke", reason: "forcé --level=smoke", runs: [SMOKE_RUN] };
  }
  if (forced === "full") {
    return { level: "full", reason: "forcé --level=full", runs: [FULL_RUN] };
  }
  const decision = decide(baseRef);
  // `--level=affected` forcé : on lance le calcul du diff tel quel (peut légitimement escalader).
  return forced === "affected"
    ? { ...decision, reason: `forcé --level=affected → ${decision.reason}` }
    : decision;
}

function main(): void {
  const argv = process.argv.slice(2);
  const printOnly = argv.includes("--print");
  const levelArg = argv.find((a) => a.startsWith("--level="))?.split("=")[1];
  if (levelArg !== undefined && !isLevel(levelArg)) {
    process.stderr.write(
      `e2e-affected : --level invalide « ${levelArg} » (attendu : ${LEVELS.join("|")})\n`,
    );
    process.exit(2);
  }
  const badFlag = unknownFlag(argv);
  if (badFlag !== undefined) {
    process.stderr.write(`e2e-affected : ${badFlag}\n`);
    process.exit(2);
  }

  const { baseRef, warnings, error } = resolveBaseRef(argv, () => {
    const lot = resolveLotBase();
    return { base: lot?.base, ref: lot?.ref, head: gitOrUndefined(["rev-parse", "HEAD"]) };
  });
  for (const warning of warnings) {
    process.stderr.write(`e2e-affected : ${warning}\n`);
  }
  if (error !== undefined) {
    process.stderr.write(`e2e-affected : ${error}\n`);
    process.exit(2);
  }

  const decision = resolveDecision(baseRef, isLevel(levelArg) ? levelArg : undefined);
  const label = { smoke: "L1 smoke", affected: "L2 affected", full: "L3 full" }[decision.level];
  const cmds = decision.runs.map((run) => `npx ${["playwright", "test", ...run].join(" ")}`);
  // Un sha se tronque, un nom de ref non : « origin/m » ne renseigne personne.
  const shortBase =
    baseRef !== undefined && /^[0-9a-f]{40}$/.test(baseRef) ? baseRef.slice(0, 8) : baseRef;
  const baseNote = shortBase === undefined ? "" : ` (base : ${shortBase})`;
  process.stderr.write(
    `\ne2e-affected → ${label}${baseNote}\n  raison : ${decision.reason}\n${cmds.map((c) => `  $ ${c}`).join("\n")}\n\n`,
  );

  if (printOnly) {
    process.stdout.write(`${decision.level}\n`);
    return;
  }

  for (const run of decision.runs) {
    const result = spawnSync("npx", ["playwright", "test", ...run], { stdio: "inherit" });
    if ((result.status ?? 1) !== 0) {
      process.exit(result.status ?? 1);
    }
  }
  process.exit(0);
}

// Le fichier est importé par ses tests unitaires (`e2e-affected.test.ts`) : sans cette garde,
// l'import lancerait Playwright et sortirait du process.
//
// `realpathSync` n'est pas décoratif : Node résout les liens symboliques pour `import.meta.url`,
// PAS pour `process.argv[1]`. Lancé via un lien, la comparaison brute échouait — le script ne
// faisait rien et sortait 0, donc le gate affichait un ✓ en ayant joué zéro test. Exactement le
// vert silencieux que ce fichier combat (relevé et mesuré en revue, 2026-09-10).
//
// Résolu des DEUX côtés, et jamais jetant. `realpathSync` lève `ENOENT` sur un chemin absent : nu,
// il rendrait ce module inimportable, donc ferait tomber `pnpm test` entier sur une erreur opaque
// — le fichier est désormais dans le projet vitest `unit`. Et résoudre les deux côtés garde la
// comparaison juste sous `--preserve-symlinks`, où `import.meta.url` n'est plus le realpath.
function realPathOrSelf(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
}

const entryPoint = process.argv[1];
const thisFile = realPathOrSelf(fileURLToPath(import.meta.url));
if (entryPoint !== undefined && realPathOrSelf(entryPoint) === thisFile) {
  main();
}
