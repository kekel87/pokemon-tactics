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
  ABANDON_POSTURE_LABELS,
  ABANDON_SOURCE_LABELS,
  ABANDON_TURN_RANGE_LABELS,
  AbandonTurnRange,
  ACTION_LABELS,
  buildReport,
  CAUSE_LABELS,
  type DeviceAbandons,
  END_REASON_LABELS,
  type EventRow,
  INPUT_LABELS,
  label,
  MAP_NAMES,
  MODE_LABELS,
  PLATFORM_LABELS,
  QUICK_ABANDON_MAX_TURNS,
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

/** Une ligne de tableau : la valeur calée à droite sur 5 colonnes, puis le libellé. */
function countLine(value: string, text: string): string {
  return `    ${value.padStart(5)}  ${text}`;
}

function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(0)} %`;
}

function section(
  title: string,
  tally: Tally,
  translate: (key: string) => string = (k) => k,
): string {
  if (tally.size === 0) {
    return `  ${title}\n    (rien)\n`;
  }
  const lines = top(tally).map(([key, count]) => countLine(String(count), translate(key)));
  return `  ${title}\n${lines.join("\n")}\n`;
}

function renderTerminal(report: Report): string {
  const parts: string[] = [];
  parts.push(`\n═══ Télémétrie — ${report.days} derniers jours ═══\n`);
  // Le total brut de visiteurs compte des couples (visiteur, jour) — voir `visitorsPerDay`. Seule
  // la moyenne se présente, comme dans la page HTML.
  const visitorsPerDay = report.visitorsPerDay === null ? "—" : report.visitorsPerDay.toFixed(1);
  parts.push(
    `  ${report.visits} visite(s) · ${visitorsPerDay} visiteur(s) par jour en moyenne (${report.uniqueVisitors} journée(s)-visiteur)`,
  );
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

  const abandon = report.abandonRate === null ? "—" : percent(report.abandonRate);
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
  parts.push(section("Tablées", report.battlesByParticipants));
  parts.push(
    section("Fins de partie", report.battlesByEndReason, (k) => label(END_REASON_LABELS, k)),
  );
  parts.push(section("Provenance des équipes", report.teamSources, (k) => label(SOURCE_LABELS, k)));

  parts.push("\n  ── Statistiques d'usage (équipes bâties par un humain) ──\n");
  parts.push(section("Pokemon", report.speciesUsage, (k) => nameOf(POKEMON_NAMES, k)));
  parts.push(section("Talents", report.abilityUsage, (k) => nameOf(ABILITY_NAMES, k)));
  parts.push(section("Objets tenus", report.itemUsage, (k) => nameOf(ITEM_NAMES, k)));
  parts.push(section("Attaques emportées", report.movesetUsage, (k) => nameOf(MOVE_NAMES, k)));
  parts.push(
    section("Attaques réellement lancées", report.movesCast, (k) => nameOf(MOVE_NAMES, k)),
  );

  /*
   * 🔴 DEUX BLOCS QUI NE S'ADDITIONNENT JAMAIS (plan 212, Lot E).
   *
   * Le bloc ci-dessus est celui du GOÛT : ce que les joueurs CHOISISSENT, donc les équipes bâties à
   * la main et elles seules. Celui-ci est celui de la FORCE : ce qui GAGNE, toutes équipes humaines
   * confondues — et une équipe aléatoire y vaut mieux qu'une équipe bâtie, le Pokemon y ayant été
   * distribué et non choisi, donc sans biais de réputation.
   *
   * Les mélanger ferait entrer l'aléatoire dans les statistiques d'usage, ce que l'humain a
   * explicitement refusé le 2026-09-16.
   */
  parts.push("\n  ── Déroulé des combats (toutes équipes humaines, aléatoires comprises) ──\n");
  parts.push(section("Causes de K.O.", report.knockOutCauses, (k) => label(CAUSE_LABELS, k)));
  parts.push(
    section("Attaques lancées, toutes équipes", report.movesCastAll, (k) => nameOf(MOVE_NAMES, k)),
  );
  parts.push(
    section("Tombés sans avoir agi", report.diedWithoutActing, (k) => nameOf(POKEMON_NAMES, k)),
  );
  parts.push(winRateSection(report));
  parts.push(matchupSection(report));

  parts.push(abandonBlock(report));

  parts.push(section("Versions du jeu", report.builds));
  return parts.join("\n");
}

/**
 * Nombre minimal d'apparitions avant qu'un taux de victoire ne soit montré.
 *
 * 🔴 Pourquoi un seuil plutôt qu'un affichage brut : sur 150 espèces et ~1,4 camp humain par jour,
 * une espèce donnée apparaît environ une fois tous les 17 jours. Sans garde, un « 100 % de
 * victoires » sur UNE apparition s'afficherait comme un Pokemon cassé. C'est exactement l'erreur que
 * les chiffres du 2026-09-16 invitaient à faire — « une attaque lancée, une cause de K.O. » lus
 * comme un signal alors que c'est du bruit à n=1.
 */
const MIN_APPEARANCES_FOR_WIN_RATE = 10;

/**
 * Taux de présence dans le camp vainqueur, par espèce, **avec son `n`**.
 *
 * ⚠️ Signal d'appoint, jamais à lire seul : une victoire est un résultat d'ÉQUIPE (six membres, la
 * qualité de l'adversaire, des synergies non voulues puisque le tirage est aléatoire). L'attribuer à
 * un membre est intrinsèquement confondu, plus que la mort, le tour de chute ou les attaques
 * lancées, qui sont directement imputables à l'individu.
 */
function winRateSection(report: Report): string {
  return rateSection({
    title: "Présence dans le camp vainqueur",
    appearances: report.speciesAppearances,
    wins: report.speciesWins,
    labelOf: (species) => nameOf(POKEMON_NAMES, species),
    emptyText: "pas encore assez d'apparitions",
    heldText: (held) =>
      `${held} espèce(s) sous ${MIN_APPEARANCES_FOR_WIN_RATE} apparition(s), tues plutôt que lues de travers`,
  });
}

/**
 * Affrontements espèce contre espèce (plan 227), même seuil que la présence dans le camp vainqueur.
 * L'adversaire peut être de l'IA ; le sujet est toujours tenu par un humain.
 */
function matchupSection(report: Report): string {
  return rateSection({
    title: "Affrontements",
    appearances: report.matchupAppearances,
    wins: report.matchupWins,
    labelOf: (key) => {
      const [species = "", opponent = ""] = key.split("|");
      return `${nameOf(POKEMON_NAMES, species)} contre ${nameOf(POKEMON_NAMES, opponent)}`;
    },
    emptyText: "pas encore assez de parties",
    heldText: (held) =>
      `${held} affrontement(s) sous ${MIN_APPEARANCES_FOR_WIN_RATE} partie(s), tus plutôt que lus de travers`,
  });
}

/** Un taux par clé, avec son `n`, sous le seuil `MIN_APPEARANCES_FOR_WIN_RATE`. Douze lignes au plus. */
function rateSection(section: {
  title: string;
  appearances: Tally;
  wins: Tally;
  labelOf: (key: string) => string;
  emptyText: string;
  heldText: (held: number) => string;
}): string {
  const eligible = [...section.appearances.entries()]
    .filter(([, appearances]) => appearances >= MIN_APPEARANCES_FOR_WIN_RATE)
    .map(([key, appearances]) => {
      const wins = section.wins.get(key) ?? 0;
      return { key, appearances, rate: wins / appearances };
    })
    .sort((left, right) => right.rate - left.rate);
  const rows = eligible.slice(0, 12);
  // Compté AVANT la coupe à douze : mélanger les deux attribuerait à un manque de données des
  // lignes qui n'ont manqué que de place, et le message deviendrait faux dès la treizième ligne.
  const held = section.appearances.size - eligible.length;
  const footer = held > 0 ? `    (${section.heldText(held)})\n` : "";
  if (rows.length === 0) {
    return `  ${section.title}\n    (${section.emptyText})\n${footer}`;
  }
  const lines = rows.map((row) =>
    countLine(percent(row.rate), `${section.labelOf(row.key)} (n=${row.appearances})`),
  );
  return `  ${section.title}\n${lines.join("\n")}\n${footer}`;
}

/** Ce que les 77 % d'abandon ne pouvaient pas dire : quand on lâche, et dans quel état. */
function abandonBlock(report: Report): string {
  if (report.battlesAbandoned === 0) {
    return "\n  ── Abandons ──\n  (aucun départ mesuré sur la période)\n";
  }
  const turns = report.medianAbandonTurns === null ? "—" : String(report.medianAbandonTurns);
  const duration =
    report.medianAbandonDurationMs === null
      ? "—"
      : `${(report.medianAbandonDurationMs / 60_000).toFixed(1)} min`;
  const ranges = Object.values(AbandonTurnRange).map((range) =>
    countLine(String(report.abandonByTurnRange.get(range) ?? 0), ABANDON_TURN_RANGE_LABELS[range]),
  );
  return [
    "\n  ── Abandons ──\n",
    `  ${report.battlesAbandoned} départ(s) mesuré(s) · médiane : tour ${turns}, après ${duration}\n`,
    `  Quand on part\n${ranges.join("\n")}\n`,
    section("D'où on part", report.abandonBySource, (k) => label(ABANDON_SOURCE_LABELS, k)),
    section("Dans quel état", report.abandonByPosture, (k) => label(ABANDON_POSTURE_LABELS, k)),
    deviceSection("Abandons rapides par source d'entrée", report.quickAbandonByInput, (k) =>
      label(INPUT_LABELS, k),
    ),
    deviceSection("Abandons rapides par taille d'écran", report.quickAbandonByScreen),
  ].join("\n");
}

/**
 * Départs dans les premiers tours rapportés aux parties lancées, par appareil (plan 224). Vide tant
 * qu'aucune partie n'a été jouée sur une version qui envoie l'appareil.
 */
function deviceSection(
  title: string,
  table: Map<string, DeviceAbandons>,
  translate: (key: string) => string = (key) => key,
): string {
  const heading = `  ${title} (parties quittées au tour ${QUICK_ABANDON_MAX_TURNS} au plus / lancées)`;
  if (table.size === 0) {
    return `${heading}\n    (aucune partie ne porte encore l'appareil)\n`;
  }
  const lines = [...table]
    .sort((left, right) => right[1].started - left[1].started)
    .map(([key, entry]) => {
      const rate = entry.started > 0 ? percent(entry.quick / entry.started) : "—";
      return countLine(rate, `${translate(key)} (${entry.quick}/${entry.started})`);
    });
  return `${heading}\n${lines.join("\n")}\n`;
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
