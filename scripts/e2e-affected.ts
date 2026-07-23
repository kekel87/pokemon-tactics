#!/usr/bin/env tsx
/**
 * e2e-affected — choisit le NIVEAU de suite e2e à lancer d'après le diff git, et lance Playwright.
 *
 * 3 niveaux (plan 170) :
 *   L1 smoke    — `--project=smoke` (boot + nav). Plancher.
 *   L2 affected — sous-ensemble calculé du diff (specs e2e changés, ou combat specs référençant un
 *                 move re-tuné). Défaut au commit.
 *   L3 full     — tout. Escalade auto dès que le diff est cross-cutting (non scopable sûrement).
 *
 * Biais conservateur : tout doute → L3. Un faux positif coûte du temps ; un faux négatif cache une
 * régression → interdit. Le full reste obligatoire au /publish (filet, hors de ce script).
 *
 * Usage :
 *   tsx scripts/e2e-affected.ts [baseRef] [--print] [--level=smoke|affected|full]
 *   baseRef  ref de comparaison (défaut : arbre de travail vs HEAD).
 *   --print  imprime le niveau + les commandes, ne lance pas.
 *   --level  force un niveau (court-circuite le calcul).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SMOKE_GLOB = "e2e/tests/smoke";
const COMBAT_GLOB = "e2e/tests/combat";
const SANDBOX_CONFIGS = "e2e/fixtures/sandbox-configs.ts";

const LEVELS = ["smoke", "affected", "full"] as const;
type Level = (typeof LEVELS)[number];

interface Decision {
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

const isNonCode = (f: string) =>
  f.startsWith("docs/") || f.endsWith(".md") || f.startsWith(".claude/");
const isE2e = (f: string) => f.startsWith("e2e/");
const isConfigBuild = (f: string) =>
  /(^|\/)(playwright\.config|vitest\.config|vite\.config)\.[cm]?tsx?$/.test(f) ||
  /(^|\/)package\.json$/.test(f) ||
  /(^|\/)pnpm-lock\.yaml$/.test(f) ||
  /(^|\/)tsconfig[^/]*\.json$/.test(f) ||
  /(^|\/)biome\.jsonc?$/.test(f);
const isCore = (f: string) => f.startsWith("packages/core/") && !f.endsWith(".test.ts");
const isRenderOrUi = (f: string) =>
  /^packages\/(render-[^/]+|renderer|render-ports|ui-dom|view-core|app)\//.test(f);
/** Data confiné au tuning de move : overrides tactiques + JSON de référence moves/abilities. */
const isMoveTuningData = (f: string) =>
  f === "packages/data/src/overrides/tactical.ts" ||
  f === "packages/data/src/overrides/balance-v1.ts" ||
  f === "packages/data/reference/moves.json" ||
  f === "packages/data/reference/abilities.json";
const isData = (f: string) => f.startsWith("packages/data/");

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
        if (idField) {
          ids.add(idField[1]);
          break;
        }
      }
    }
  }
  return { ids: [...ids], ambiguous };
}

// --- Résolution id → constantes de config → specs ---------------------------

/** Toutes les constantes de `sandbox-configs.ts` (exportées ou non) : nom → corps littéral. */
function parseConstBlocks(sandboxSource: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const blockRe =
    /(?:export\s+)?const ([A-Za-z0-9_]+)\s*=([\s\S]*?)(?=\n(?:export\s+)?const |\n?$)/g;
  for (let m = blockRe.exec(sandboxSource); m !== null; m = blockRe.exec(sandboxSource)) {
    blocks.set(m[1], m[2]);
  }
  return blocks;
}

/**
 * Constantes de config « portant » l'id : celles dont le corps contient littéralement `"<id>"`, PLUS
 * toutes celles qui les héritent par spread (`{ ...BASE }`), transitivement. Sinon un spec qui ne
 * référence qu'une const dérivée (ex. `POISONED = { ...DUEL }`, `DUEL` portant le move) serait raté.
 */
function configConstsForId(id: string, constBlocks: Map<string, string>): string[] {
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

/** Specs combat référençant l'id — directement, ou via une constante de config (spreads inclus). */
function specsForId(id: string, constBlocks: Map<string, string>): string[] {
  const specFiles = git(["ls-files", `${COMBAT_GLOB}/*.spec.ts`])
    .split("\n")
    .filter(Boolean);
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

function decide(baseRef: string | undefined): Decision {
  const files = changedFiles(baseRef);
  if (files.length === 0) {
    return { level: "smoke", reason: "aucun changement détecté", runs: [SMOKE_RUN] };
  }
  if (files.every(isNonCode)) {
    return { level: "smoke", reason: "diff non-code (docs/config .claude)", runs: [SMOKE_RUN] };
  }

  // Escalades L3 (non scopables sûrement).
  const configHits = files.filter(isConfigBuild);
  if (configHits.length > 0) {
    return {
      level: "full",
      reason: `config/build touché (${configHits[0]}) → non scopable`,
      runs: [FULL_RUN],
    };
  }
  const coreHits = files.filter(isCore);
  if (coreHits.length > 0) {
    return {
      level: "full",
      reason: `moteur core touché (${coreHits[0]}) → cross-cutting`,
      runs: [FULL_RUN],
    };
  }
  const renderHits = files.filter(isRenderOrUi);
  if (renderHits.length > 0) {
    return {
      level: "full",
      reason: `rendu/UI touché (${renderHits[0]}) → couplé au scene-graph des combat specs`,
      runs: [FULL_RUN],
    };
  }

  // Reste : uniquement e2e et/ou data. Cas scopables (L2).
  const dataFiles = files.filter(isData);
  const nonMoveTuningData = dataFiles.filter((f) => !isMoveTuningData(f));
  const e2eFiles = files.filter(isE2e);

  // Data hors tuning de move (pokemon.json, items.json, type-chart, loaders…) → trop large, full.
  if (nonMoveTuningData.length > 0) {
    return {
      level: "full",
      reason: `data hors tuning de move (${nonMoveTuningData[0]}) → portée large`,
      runs: [FULL_RUN],
    };
  }

  // e2e-only : laisser Playwright résoudre les specs impactés par le graphe d'import. `--only-changed`
  // ne peut PAS partager une invocation avec le plancher smoke (intersection) → deux runs séparés.
  if (e2eFiles.length > 0 && dataFiles.length === 0) {
    const base = baseRef ?? "HEAD";
    return {
      level: "affected",
      reason: `specs/fixtures e2e changés → --only-changed depuis ${base} + smoke`,
      runs: [SMOKE_RUN, [`--only-changed=${base}`]],
    };
  }

  // Tuning de move data : mapper les ids changés → combat specs. Fallback full si doute.
  if (dataFiles.length > 0) {
    const constBlocks = parseConstBlocks(readFileSync(SANDBOX_CONFIGS, "utf8"));
    const { ids, ambiguous } = changedMoveIds(dataFiles, baseRef);
    if (ambiguous) {
      return {
        level: "full",
        reason: "suppression de move détectée (non mappable) → fallback combat complet",
        runs: [[COMBAT_GLOB, SMOKE_GLOB]],
      };
    }
    if (ids.length === 0) {
      return {
        level: "full",
        reason: "tuning data détecté mais aucun id de move extrait du diff → sûreté",
        runs: [[COMBAT_GLOB, SMOKE_GLOB]],
      };
    }
    const specGlobs = new Set<string>([SMOKE_GLOB]);
    const unmapped: string[] = [];
    for (const id of ids) {
      const specs = specsForId(id, constBlocks);
      if (specs.length === 0) {
        unmapped.push(id);
      } else {
        for (const s of specs) {
          specGlobs.add(s);
        }
      }
    }
    if (unmapped.length > 0) {
      return {
        level: "full",
        reason: `move(s) sans spec e2e mappé (${unmapped.join(", ")}) → fallback combat complet`,
        runs: [[COMBAT_GLOB, SMOKE_GLOB]],
      };
    }
    // Ajoute aussi les specs e2e changés (cas mixte data + spec — positionnels, s'unionnent).
    for (const spec of e2eFiles.filter((f) => f.endsWith(".spec.ts"))) {
      specGlobs.add(spec);
    }
    return {
      level: "affected",
      reason: `tuning move ${ids.join(", ")} → specs mappés`,
      runs: [[...specGlobs]],
    };
  }

  // Filet : rien de reconnu → full.
  return { level: "full", reason: "diff non classé → sûreté", runs: [FULL_RUN] };
}

// --- Entrée -----------------------------------------------------------------

function isLevel(value: string | undefined): value is Level {
  return value !== undefined && (LEVELS as readonly string[]).includes(value);
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
  const baseRef = argv.find((a) => !a.startsWith("--"));

  const decision = resolveDecision(baseRef, isLevel(levelArg) ? levelArg : undefined);
  const label = { smoke: "L1 smoke", affected: "L2 affected", full: "L3 full" }[decision.level];
  const cmds = decision.runs.map((run) => `npx ${["playwright", "test", ...run].join(" ")}`);
  process.stderr.write(
    `\ne2e-affected → ${label}\n  raison : ${decision.reason}\n${cmds.map((c) => `  $ ${c}`).join("\n")}\n\n`,
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

main();
