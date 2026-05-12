import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HeldItemId } from "@pokemon-tactic/core";
import { abilityHandlers } from "../src/abilities/ability-definitions";
import { itemHandlers } from "../src/items/item-definitions";
import { tacticalOverrides } from "../src/overrides/tactical";
import { rosterPoc } from "../src/roster/roster-poc";
import {
  isAbilityImplemented,
  isItemImplemented,
  isMoveImplemented,
  isPokemonImplemented,
} from "../src/team/implementation-flags";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OP_SETS_PATH = resolve(SCRIPT_DIR, "../op-sets/op-sets.json");
const GAP_DOC_PATH = resolve(SCRIPT_DIR, "../../../docs/op-sets-gap-analysis.md");

const ALLOWED_ROLES = new Set([
  "physical-sweeper",
  "special-sweeper",
  "wallbreaker",
  "tank",
  "support",
  "pivot",
  "stallbreaker",
  "lead",
]);
const ALLOWED_GENDERS = new Set(["male", "female", "genderless"]);
const ALLOWED_STAT_KEYS = new Set(["hp", "attack", "defense", "spAttack", "spDefense", "speed"]);
const ALLOWED_SOURCES = new Set(["smogon", "coupcritique", "custom"]);
const SP_TOTAL_MAX = 66;
const SP_STAT_MAX = 32;
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface OpSetEntry {
  id: string;
  pokemonId: string;
  name: string;
  role?: string;
  ability: string;
  heldItemId?: string | null;
  nature: string;
  moveIds: string[];
  statSpread: Partial<
    Record<"hp" | "attack" | "defense" | "spAttack" | "spDefense" | "speed", number>
  >;
  gender?: string | null;
  source: string;
  sourceUrl?: string;
  notes?: string;
}

interface OpSetData {
  schemaVersion: number;
  sets: OpSetEntry[];
}

type Availability = "full" | "partial" | "unavailable";

interface Analysis {
  total: number;
  full: number;
  partial: number;
  unavailable: number;
  perSet: { id: string; availability: Availability; missing: string[] }[];
  missingMoves: Map<string, { sets: Set<string>; pokemon: Set<string> }>;
  missingAbilities: Map<string, { sets: Set<string>; pokemon: Set<string> }>;
  missingItems: Map<string, { sets: Set<string>; pokemon: Set<string> }>;
  pokemonWithoutFull: Set<string>;
}

function loadOpSets(): OpSetData {
  const raw = readFileSync(OP_SETS_PATH, "utf-8");
  return JSON.parse(raw) as OpSetData;
}

function validateSchema(data: OpSetData): string[] {
  const errors: string[] = [];
  if (data.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1, got ${data.schemaVersion}`);
  }
  if (!Array.isArray(data.sets)) {
    errors.push("sets must be an array");
    return errors;
  }
  const seenIds = new Set<string>();
  for (const set of data.sets) {
    if (typeof set.id !== "string" || !KEBAB_RE.test(set.id)) {
      errors.push(`id "${set.id}" not kebab-case`);
    }
    if (seenIds.has(set.id)) {
      errors.push(`duplicate id: ${set.id}`);
    }
    seenIds.add(set.id);
    if (typeof set.pokemonId !== "string" || !KEBAB_RE.test(set.pokemonId)) {
      errors.push(`${set.id}: pokemonId "${set.pokemonId}" not kebab-case`);
    }
    if (set.role !== undefined && !ALLOWED_ROLES.has(set.role)) {
      errors.push(`${set.id}: role "${set.role}" not in allowed list`);
    }
    if (typeof set.ability !== "string" || !KEBAB_RE.test(set.ability)) {
      errors.push(`${set.id}: ability "${set.ability}" not kebab-case`);
    }
    if (set.heldItemId !== undefined && set.heldItemId !== null && !KEBAB_RE.test(set.heldItemId)) {
      errors.push(`${set.id}: heldItemId "${set.heldItemId}" not kebab-case`);
    }
    if (typeof set.nature !== "string" || !/^[a-z]+$/.test(set.nature)) {
      errors.push(`${set.id}: nature "${set.nature}" not lowercase`);
    }
    if (!Array.isArray(set.moveIds) || set.moveIds.length < 1 || set.moveIds.length > 4) {
      errors.push(`${set.id}: moveIds.length must be 1-4, got ${set.moveIds?.length}`);
    } else {
      for (const moveId of set.moveIds) {
        if (!KEBAB_RE.test(moveId)) {
          errors.push(`${set.id}: move "${moveId}" not kebab-case`);
        }
      }
    }
    let spTotal = 0;
    for (const [key, value] of Object.entries(set.statSpread ?? {})) {
      if (!ALLOWED_STAT_KEYS.has(key)) {
        errors.push(`${set.id}: statSpread key "${key}" not allowed`);
        continue;
      }
      if (typeof value !== "number" || value < 0 || value > SP_STAT_MAX) {
        errors.push(`${set.id}: statSpread.${key} must be 0-${SP_STAT_MAX}, got ${value}`);
      }
      spTotal += value ?? 0;
    }
    if (spTotal > SP_TOTAL_MAX) {
      errors.push(`${set.id}: statSpread total ${spTotal} exceeds ${SP_TOTAL_MAX}`);
    }
    if (set.gender !== undefined && set.gender !== null && !ALLOWED_GENDERS.has(set.gender)) {
      errors.push(`${set.id}: gender "${set.gender}" not allowed`);
    }
    if (!ALLOWED_SOURCES.has(set.source)) {
      errors.push(`${set.id}: source "${set.source}" not allowed`);
    }
  }
  return errors;
}

function trackMissing(
  map: Map<string, { sets: Set<string>; pokemon: Set<string> }>,
  key: string,
  setId: string,
  pokemonId: string,
): void {
  const entry = map.get(key) ?? { sets: new Set<string>(), pokemon: new Set<string>() };
  entry.sets.add(setId);
  entry.pokemon.add(pokemonId);
  map.set(key, entry);
}

function analyze(data: OpSetData): Analysis {
  const analysis: Analysis = {
    total: data.sets.length,
    full: 0,
    partial: 0,
    unavailable: 0,
    perSet: [],
    missingMoves: new Map(),
    missingAbilities: new Map(),
    missingItems: new Map(),
    pokemonWithoutFull: new Set(),
  };
  const fullByPokemon = new Map<string, number>();

  for (const set of data.sets) {
    const missing: string[] = [];
    if (!isPokemonImplemented(set.pokemonId, rosterPoc)) {
      analysis.unavailable += 1;
      analysis.perSet.push({ id: set.id, availability: "unavailable", missing: ["pokemon"] });
      continue;
    }
    for (const moveId of set.moveIds) {
      if (!isMoveImplemented(moveId, tacticalOverrides)) {
        missing.push(`move:${moveId}`);
        trackMissing(analysis.missingMoves, moveId, set.id, set.pokemonId);
      }
    }
    if (!isAbilityImplemented(set.ability, abilityHandlers)) {
      missing.push(`ability:${set.ability}`);
      trackMissing(analysis.missingAbilities, set.ability, set.id, set.pokemonId);
    }
    if (
      set.heldItemId !== undefined &&
      set.heldItemId !== null &&
      !isItemImplemented(set.heldItemId as HeldItemId, itemHandlers)
    ) {
      missing.push(`item:${set.heldItemId}`);
      trackMissing(analysis.missingItems, set.heldItemId, set.id, set.pokemonId);
    }
    const availability: Availability = missing.length === 0 ? "full" : "partial";
    if (availability === "full") {
      analysis.full += 1;
      fullByPokemon.set(set.pokemonId, (fullByPokemon.get(set.pokemonId) ?? 0) + 1);
    } else {
      analysis.partial += 1;
    }
    analysis.perSet.push({ id: set.id, availability, missing });
  }
  for (const entry of rosterPoc) {
    if (entry.id === "dummy") {
      continue;
    }
    if ((fullByPokemon.get(entry.id) ?? 0) === 0) {
      analysis.pokemonWithoutFull.add(entry.id);
    }
  }
  return analysis;
}

interface RankedMissing {
  key: string;
  sets: number;
  pokemon: number;
  urgency: "high" | "medium" | "low";
}

function rank(
  map: Map<string, { sets: Set<string>; pokemon: Set<string> }>,
  limit: number,
): RankedMissing[] {
  const items: RankedMissing[] = [];
  for (const [key, entry] of map) {
    const setCount = entry.sets.size;
    const urgency: "high" | "medium" | "low" =
      setCount > 15 ? "high" : setCount >= 5 ? "medium" : "low";
    items.push({ key, sets: setCount, pokemon: entry.pokemon.size, urgency });
  }
  items.sort((a, b) => b.sets - a.sets);
  return items.slice(0, limit);
}

function urgencyIcon(u: "high" | "medium" | "low"): string {
  return u === "high" ? "🔥 High" : u === "medium" ? "🟡 Medium" : "🟢 Low";
}

function renderMarkdown(analysis: Analysis, data: OpSetData): string {
  const today = new Date().toISOString().slice(0, 10);
  const topMoves = rank(analysis.missingMoves, 20);
  const topAbilities = rank(analysis.missingAbilities, 10);
  const topItems = rank(analysis.missingItems, 10);

  const lines: string[] = [];
  lines.push(`# OP Sets Gap Analysis (généré ${today})`);
  lines.push("");
  lines.push("## Stats globales");
  lines.push(`- Total sets : ${analysis.total}`);
  lines.push(
    `- Sets \`full\` : ${analysis.total === 0 ? 0 : Math.round((analysis.full / analysis.total) * 100)}% (${analysis.full} / ${analysis.total})`,
  );
  lines.push(
    `- Sets \`partial\` : ${analysis.total === 0 ? 0 : Math.round((analysis.partial / analysis.total) * 100)}% (${analysis.partial} / ${analysis.total})`,
  );
  if (analysis.unavailable > 0) {
    lines.push(`- Sets \`unavailable\` : ${analysis.unavailable} (Pokemon non implémentés)`);
  }
  const rosterCount = rosterPoc.filter((e) => e.id !== "dummy").length;
  lines.push(`- Pokemon sans set \`full\` : ${analysis.pokemonWithoutFull.size} / ${rosterCount}`);
  lines.push("");

  lines.push("## Top 20 moves manquants (par fréquence)");
  lines.push("");
  lines.push("| Rank | Move | Sets impactés | Pokemon impactés | Urgence |");
  lines.push("|------|------|---------------|------------------|---------|");
  topMoves.forEach((m, i) => {
    lines.push(
      `| ${i + 1} | \`${m.key}\` | ${m.sets} | ${m.pokemon} | ${urgencyIcon(m.urgency)} |`,
    );
  });
  if (topMoves.length === 0) {
    lines.push("| — | — | 0 | 0 | — |");
  }
  lines.push("");

  lines.push("## Top 10 abilities manquantes");
  lines.push("");
  lines.push("| Rank | Ability | Sets impactés | Pokemon impactés | Urgence |");
  lines.push("|------|---------|---------------|------------------|---------|");
  topAbilities.forEach((m, i) => {
    lines.push(
      `| ${i + 1} | \`${m.key}\` | ${m.sets} | ${m.pokemon} | ${urgencyIcon(m.urgency)} |`,
    );
  });
  if (topAbilities.length === 0) {
    lines.push("| — | — | 0 | 0 | — |");
  }
  lines.push("");

  lines.push("## Top 10 items manquants");
  lines.push("");
  lines.push("| Rank | Item | Sets impactés | Pokemon impactés | Urgence |");
  lines.push("|------|------|---------------|------------------|---------|");
  topItems.forEach((m, i) => {
    lines.push(
      `| ${i + 1} | \`${m.key}\` | ${m.sets} | ${m.pokemon} | ${urgencyIcon(m.urgency)} |`,
    );
  });
  if (topItems.length === 0) {
    lines.push("| — | — | 0 | 0 | — |");
  }
  lines.push("");

  lines.push("## Pokemon sans set `full`");
  lines.push("");
  if (analysis.pokemonWithoutFull.size === 0) {
    lines.push("Tous les Pokemon roster ont au moins 1 set `full`. 🎉");
  } else {
    for (const pokemonId of [...analysis.pokemonWithoutFull].sort()) {
      const setsForMon = data.sets.filter((s) => s.pokemonId === pokemonId);
      const detail = setsForMon
        .map((s) => {
          const perSet = analysis.perSet.find((p) => p.id === s.id);
          return `${s.name} (${perSet?.availability})`;
        })
        .join(", ");
      lines.push(`- \`${pokemonId}\` : ${setsForMon.length} set(s) — ${detail}`);
    }
  }
  lines.push("");

  lines.push("## Actions recommandées pour plan 083");
  lines.push("");
  const highMoves = topMoves.filter((m) => m.urgency === "high").map((m) => m.key);
  const highAbilities = topAbilities.filter((m) => m.urgency === "high").map((m) => m.key);
  const highItems = topItems.filter((m) => m.urgency === "high").map((m) => m.key);
  if (highMoves.length > 0) {
    lines.push(
      `- **+${highMoves.length} moves** (\`${highMoves.join("`, `")}\`) — debloquerait le plus grand nombre de sets`,
    );
  }
  if (highAbilities.length > 0) {
    lines.push(`- **+${highAbilities.length} abilities** (\`${highAbilities.join("`, `")}\`)`);
  }
  if (highItems.length > 0) {
    lines.push(`- **+${highItems.length} items** (\`${highItems.join("`, `")}\`)`);
  }
  const projectedFull =
    analysis.full + topMoves.filter((m) => m.urgency === "high").reduce((a, m) => a + m.sets, 0);
  lines.push("");
  lines.push(
    `**Impact estimé** : implémenter tous les éléments 🔥 High de chaque catégorie ferait passer ~${projectedFull - analysis.full} sets supplémentaires de \`partial\` → \`full\` (estimation max, sans double-comptage).`,
  );
  lines.push("");
  lines.push(
    "> Note : l'impact réel exige qu'un set ait TOUS ses moves/ability/item implémentés simultanément. Voir la liste détaillée `perSet` dans le script pour priorisation fine.",
  );
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  let data: OpSetData;
  try {
    data = loadOpSets();
  } catch (err) {
    console.error(`Failed to read ${OP_SETS_PATH}:`, err);
    process.exit(1);
  }

  const schemaErrors = validateSchema(data);
  if (schemaErrors.length > 0) {
    console.error(`Schema validation failed (${schemaErrors.length} errors):`);
    for (const e of schemaErrors) {
      console.error(`  ${e}`);
    }
    process.exit(1);
  }

  const analysis = analyze(data);
  const markdown = renderMarkdown(analysis, data);
  writeFileSync(GAP_DOC_PATH, markdown);

  console.log(`Analyzed ${analysis.total} sets:`);
  console.log(`  full        : ${analysis.full}`);
  console.log(`  partial     : ${analysis.partial}`);
  console.log(`  unavailable : ${analysis.unavailable}`);
  console.log(`  Pokemon without full set : ${analysis.pokemonWithoutFull.size}`);
  console.log(`\nReport written to ${GAP_DOC_PATH}`);
}

main();
