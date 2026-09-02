#!/usr/bin/env tsx
/**
 * telemetry-stats — lit la base de télémétrie et en sort un rapport lisible (plan 196, étape 8).
 *
 * L'agrégation se fait ICI, à la lecture, et pas à l'écriture (décision #868) : le Worker stocke des
 * événements bruts dont il ne comprend pas le contenu, ce qui permet d'ajouter un champ au payload
 * sans migration. La contrepartie est ce fichier — c'est lui qui donne du sens aux lignes.
 *
 * 🔴 **Noms FR officiels obligatoires à l'affichage** (règle projet) : la base stocke des
 * identifiants anglais (`venusaur`, `giga-drain`), jamais montrés tels quels. La traduction vient de
 * `packages/data/reference/`, source unique.
 *
 * Usage :
 *   pnpm stats             # 30 derniers jours
 *   pnpm stats --days 7    # fenêtre choisie
 *   pnpm stats --local     # lit la base locale au lieu de la production
 *
 * Terminal SEULEMENT. Le rendu HTML a existé ici le 2026-09-02 (drapeau `--html` + skill `/stats`),
 * retiré le jour même : la route live du Worker (`GET /tableau`) le fait mieux et de partout. Ce qui
 * ne vit QUE dans ce rapport, ce sont les **statistiques d'usage** (Pokemon, talents, objets tenus,
 * attaques emportées et lancées, causes de K.O.), volontairement absentes de la page — décision
 * humaine du 2026-09-02 : la page est un relevé de fréquentation, l'usage est un autre sujet.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTION_LABELS,
  buildReport,
  CAUSE_LABELS,
  type EventRow,
  INPUT_LABELS,
  label,
  MAP_NAMES,
  MODE_LABELS,
  PLATFORM_LABELS,
  type Report,
  SCREEN_LABELS,
  SOURCE_LABELS,
  type Tally,
  top,
} from "../packages/telemetry-worker/src/report";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const REFERENCE = resolve(ROOT, "packages/data/reference");
const WRANGLER_CONFIG = "packages/telemetry-worker/wrangler.toml";
const DATABASE = "pokemon-tactics-events";

/* ------------------------------------------------------------------ noms FR */

interface NamedEntry {
  id: string;
  names?: { fr?: string; en?: string };
}

function frenchNames(filename: string): Map<string, string> {
  const raw = readFileSync(resolve(REFERENCE, filename), "utf8");
  const entries = JSON.parse(raw) as NamedEntry[];
  return new Map(entries.map((entry) => [entry.id, entry.names?.fr ?? entry.id]));
}

const POKEMON_NAMES = frenchNames("pokemon.json");
const MOVE_NAMES = frenchNames("moves.json");
const ABILITY_NAMES = frenchNames("abilities.json");
const ITEM_NAMES = frenchNames("items.json");

/** Jamais l'identifiant anglais seul : c'est une règle dure du projet. */
function nameOf(dictionary: Map<string, string>, id: string): string {
  return dictionary.get(id) ?? id;
}

/* --------------------------------------------------------------- événements */

function query(sql: string, local: boolean): EventRow[] {
  const output = execFileSync(
    "npx",
    [
      "--yes",
      "wrangler@4",
      "d1",
      "execute",
      DATABASE,
      local ? "--local" : "--remote",
      "--config",
      WRANGLER_CONFIG,
      "--json",
      "--command",
      sql,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, CI: "true" },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  // wrangler préfixe sa sortie JSON de sa bannière : on repart du premier crochet.
  const start = output.indexOf("[");
  if (start === -1) {
    throw new Error(`Réponse inattendue de wrangler :\n${output}`);
  }
  const parsed = JSON.parse(output.slice(start)) as { results: EventRow[] }[];
  return parsed[0]?.results ?? [];
}

/* --------------------------------------------------------------- agrégation */

/* ------------------------------------------------------------------ rapport */

function section(
  title: string,
  tally: Tally,
  translate: (key: string) => string = (k) => k,
): string {
  if (tally.size === 0) {
    return `  ${title}\n    (rien)\n`;
  }
  const lines = top(tally).map(
    ([key, count]) => `    ${String(count).padStart(5)}  ${translate(key)}`,
  );
  return `  ${title}\n${lines.join("\n")}\n`;
}

function renderTerminal(report: Report): string {
  const parts: string[] = [];
  parts.push(`\n═══ Télémétrie — ${report.days} derniers jours ═══\n`);
  parts.push(`  ${report.visits} visite(s) · ${report.uniqueVisitors} visiteur(s) unique(s)`);
  parts.push(`  ${report.rows} ligne(s) brutes (jamais à présenter comme une fréquentation)\n`);

  parts.push(
    section("Visites par plateforme", report.visitsByPlatform, (k) => label(PLATFORM_LABELS, k)),
  );
  parts.push(section("Pays", report.countries));
  parts.push(section("Navigateurs", report.browsers));
  parts.push(section("Systèmes", report.systems));
  parts.push(section("Langues", report.languages));
  parts.push(section("Tailles d'écran", report.screenSizes));
  parts.push(section("Sources d'entrée", report.inputSources, (k) => label(INPUT_LABELS, k)));
  parts.push(section("Référents", report.referrers));
  parts.push(section("Écrans atteints", report.screens, (k) => label(SCREEN_LABELS, k)));
  parts.push(section("Actions d'interface", report.actions, (k) => label(ACTION_LABELS, k)));

  const abandon = report.abandonRate === null ? "—" : `${(report.abandonRate * 100).toFixed(0)} %`;
  const turns = report.averageTurns === null ? "—" : report.averageTurns.toFixed(1);
  const duration =
    report.averageDurationMs === null
      ? "—"
      : `${(report.averageDurationMs / 60_000).toFixed(1)} min`;
  parts.push(
    `\n  Parties : ${report.battlesStarted} commencée(s), ${report.battlesEnded} terminée(s)`,
  );
  parts.push(
    `  Taux d'abandon : ${abandon} · ${turns} tour(s) en moyenne · ${duration} en moyenne\n`,
  );

  parts.push(section("Cartes", report.battlesByMap, (k) => label(MAP_NAMES, k)));
  parts.push(section("Formats", report.battlesByFormat));
  parts.push(section("Modes", report.battlesByMode, (k) => label(MODE_LABELS, k)));
  parts.push(section("Provenance des équipes", report.teamSources, (k) => label(SOURCE_LABELS, k)));

  parts.push("\n  ── Statistiques d'usage (équipes bâties par un humain) ──\n");
  parts.push(section("Pokemon", report.speciesUsage, (k) => nameOf(POKEMON_NAMES, k)));
  parts.push(section("Talents", report.abilityUsage, (k) => nameOf(ABILITY_NAMES, k)));
  parts.push(section("Objets tenus", report.itemUsage, (k) => nameOf(ITEM_NAMES, k)));
  parts.push(section("Attaques emportées", report.movesetUsage, (k) => nameOf(MOVE_NAMES, k)));
  parts.push(
    section("Attaques réellement lancées", report.movesCast, (k) => nameOf(MOVE_NAMES, k)),
  );
  parts.push(section("Causes de K.O.", report.knockOutCauses, (k) => label(CAUSE_LABELS, k)));

  parts.push(section("Versions du jeu", report.builds));
  return parts.join("\n");
}

/* --------------------------------------------------------------------- CLI */

function parseArguments(argv: string[]): { days: number; local: boolean } {
  let days = 30;
  let local = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--days") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--days attend un entier positif");
      }
      days = value;
      index += 1;
    } else if (argument === "--local") {
      local = true;
    }
  }
  return { days, local };
}

function main(): void {
  const { days, local } = parseArguments(process.argv.slice(2));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = query(
    `SELECT id, received_at AS receivedAt, kind, build, platform, visitor, country, browser, os, lang, payload
       FROM events WHERE received_at >= ${since} ORDER BY id`,
    local,
  );
  process.stdout.write(renderTerminal(buildReport(rows, days)));
}

main();
