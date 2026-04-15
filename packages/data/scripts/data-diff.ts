#!/usr/bin/env -S npx tsx
/**
 * data-diff.ts — Affiche un résumé lisible des changements dans reference/*.json
 * depuis le dernier commit.
 *
 * Usage : pnpm data:diff
 *
 * Output : tableau champ par champ sur stdout. Pas un gate CI — juste un outil
 * d'audit humain avant de commit les données régénérées.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const Dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(Dirname, "..");
const REPO_ROOT = join(PACKAGE_ROOT, "..", "..");
const _REFERENCE_DIR = join(PACKAGE_ROOT, "reference");

/**
 * Lit le contenu d'un fichier tel qu'il était au commit HEAD.
 * Retourne null si le fichier n'existe pas dans HEAD (premier run).
 */
function getFileAtHead(relativePath: string): string | null {
  try {
    const buffer = execFileSync("git", ["show", `HEAD:${relativePath}`], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 20 * 1024 * 1024,
    });
    return buffer.toString("utf-8");
  } catch {
    // Fichier absent de HEAD (nouveau) ou pas de commit encore
    return null;
  }
}

function checkInGitRepo(): void {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    console.error("Error: Not in a git repository.");
    process.exit(1);
  }
}

interface Entry {
  id: string;
  [key: string]: unknown;
}

/**
 * Compare deux listes d'entités par ID et retourne les changements.
 */
function diffEntries(
  before: Entry[],
  after: Entry[],
  interestingFields: string[],
): { added: string[]; removed: string[]; changed: Array<{ id: string; diffs: string[] }> } {
  const beforeById = new Map(before.map((e) => [e.id, e]));
  const afterById = new Map(after.map((e) => [e.id, e]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ id: string; diffs: string[] }> = [];

  for (const [id] of afterById) {
    if (!beforeById.has(id)) {
      added.push(id);
    }
  }

  for (const [id, beforeEntry] of beforeById) {
    const afterEntry = afterById.get(id);
    if (afterEntry === undefined) {
      removed.push(id);
      continue;
    }
    const diffs: string[] = [];
    for (const field of interestingFields) {
      const b = beforeEntry[field];
      const a = afterEntry[field];
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        diffs.push(`${field}: ${stringifyValue(b)} → ${stringifyValue(a)}`);
      }
    }
    if (diffs.length > 0) {
      changed.push({ id, diffs });
    }
  }

  return { added, removed, changed };
}

function stringifyValue(v: unknown): string {
  if (v === null) {
    return "null";
  }
  if (v === undefined) {
    return "undefined";
  }
  if (typeof v === "object") {
    return JSON.stringify(v);
  }
  return String(v);
}

function printSection(
  title: string,
  added: string[],
  removed: string[],
  changed: Array<{ id: string; diffs: string[] }>,
): void {
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return;
  }

  console.log(`\n=== ${title} ===`);

  if (added.length > 0) {
    console.log(
      `Ajoutés (${added.length}): ${added.slice(0, 10).join(", ")}${added.length > 10 ? "…" : ""}`,
    );
  }
  if (removed.length > 0) {
    console.log(
      `Retirés (${removed.length}): ${removed.slice(0, 10).join(", ")}${removed.length > 10 ? "…" : ""}`,
    );
  }
  if (changed.length > 0) {
    console.log(`Modifiés (${changed.length}):`);
    const MAX_DISPLAY = 50;
    for (const { id, diffs } of changed.slice(0, MAX_DISPLAY)) {
      console.log(`  ${id}`);
      for (const diff of diffs) {
        console.log(`    ${diff}`);
      }
    }
    if (changed.length > MAX_DISPLAY) {
      console.log(`  … et ${changed.length - MAX_DISPLAY} de plus`);
    }
  }
}

async function diffJsonFile(
  relativePath: string,
  label: string,
  interestingFields: string[],
): Promise<void> {
  const before = getFileAtHead(relativePath);
  const afterContent = await readFile(join(REPO_ROOT, relativePath), "utf-8");
  const after = JSON.parse(afterContent) as Entry[];

  if (before === null) {
    console.log(`\n=== ${label} ===`);
    console.log("N/A (first run — no previous reference in HEAD)");
    console.log(`Current: ${after.length} entries`);
    return;
  }

  const beforeData = JSON.parse(before) as Entry[];
  const { added, removed, changed } = diffEntries(beforeData, after, interestingFields);
  printSection(label, added, removed, changed);
}

async function diffStatusFile(relativePath: string, label: string): Promise<void> {
  const before = getFileAtHead(relativePath);
  const afterContent = await readFile(join(REPO_ROOT, relativePath), "utf-8");
  const afterData = JSON.parse(afterContent) as Record<string, unknown>;

  console.log(`\n=== ${label} ===`);
  if (before === null) {
    console.log("N/A (first run — no previous status file in HEAD)");
    console.log(`Current: ${JSON.stringify(afterData.status, null, 2)}`);
    return;
  }

  const beforeData = JSON.parse(before) as Record<string, unknown>;
  if (JSON.stringify(beforeData.status) === JSON.stringify(afterData.status)) {
    console.log("Inchangé");
    return;
  }

  console.log("Avant:", JSON.stringify(beforeData.status, null, 2));
  console.log("Après:", JSON.stringify(afterData.status, null, 2));
}

async function main(): Promise<void> {
  checkInGitRepo();
  console.log("=== Data diff: reference/ vs HEAD ===");

  await diffJsonFile("packages/data/reference/moves.json", "Moves", [
    "power",
    "pp",
    "maxPp",
    "accuracy",
    "type",
    "category",
    "priority",
    "secondary",
    "target",
  ]);

  await diffJsonFile("packages/data/reference/pokemon.json", "Pokemon", [
    "types",
    "baseStats",
    "abilities",
  ]);

  await diffJsonFile("packages/data/reference/abilities.json", "Abilities", [
    "shortDescription",
    "longDescription",
  ]);

  await diffJsonFile("packages/data/reference/items.json", "Items", [
    "category",
    "shortDescription",
  ]);

  await diffStatusFile("packages/data/reference/champions-status.json", "Champions Status");

  console.log("\n=== Fin du diff ===");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
