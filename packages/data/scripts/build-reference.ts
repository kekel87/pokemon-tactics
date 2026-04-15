#!/usr/bin/env -S npx tsx
/**
 * build-reference.ts — Generates the Pokemon reference knowledge base.
 *
 * Sources: Pokemon Showdown (primary) + PokeAPI v2 (enrichment).
 * Output:  packages/data/reference/*.json + indexes/
 *
 * Usage:   npx tsx packages/data/scripts/build-reference.ts
 *          npx tsx packages/data/scripts/build-reference.ts --fetch-only
 *          npx tsx packages/data/scripts/build-reference.ts --skip-fetch
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChampionsOverride } from "./champions-override.types";
import { fetchChampionsData } from "./fetch-champions";
import { CACHE_DIR, cachedFetch, cachedFetchText, ensureDir, sleep } from "./fetch-utils";

// ─── Configuration ───────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const REFERENCE_DIR = join(PACKAGE_ROOT, "reference");
const INDEXES_DIR = join(REFERENCE_DIR, "indexes");

const SHOWDOWN_BASE = "https://play.pokemonshowdown.com/data";
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

const CONCURRENCY = 8;

const FETCH_ONLY = process.argv.includes("--fetch-only");
const SKIP_FETCH = process.argv.includes("--skip-fetch");

async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R | null>,
  concurrency: number,
  label: string,
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value !== null) {
        results.push(result.value);
      } else if (result.status === "rejected") {
        failed++;
      }
    }
    completed += batch.length;
    process.stdout.write(`\r  ${label}: ${completed}/${items.length} (${failed} failed)`);
  }
  console.log();
  return results;
}

function toKebabCase(name: string): string {
  return name
    .replace(/['']/g, "")
    .replace(/[^a-zA-Z0-9\u00C0-\u024F]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

function extractFrName(names: Array<{ language: { name: string }; name: string }>): string | null {
  return names.find((n) => n.language.name === "fr")?.name ?? null;
}

function extractFrGenus(
  genera: Array<{ language: { name: string }; genus: string }>,
): string | null {
  return genera.find((g) => g.language.name === "fr")?.genus ?? null;
}

function extractEnGenus(
  genera: Array<{ language: { name: string }; genus: string }>,
): string | null {
  return genera.find((g) => g.language.name === "en")?.genus ?? null;
}

function extractFlavorText(
  entries: Array<{
    flavor_text: string;
    language: { name: string };
    version_group?: { name: string };
    version?: { name: string };
  }>,
  lang: string,
): Record<string, string> {
  // Group by generation, take latest version per gen
  const byGen: Record<string, string> = {};
  const genVersionMap: Record<string, number> = {
    "red-blue": 1, yellow: 1,
    "gold-silver": 2, crystal: 2,
    "ruby-sapphire": 3, emerald: 3, "firered-leafgreen": 3,
    "diamond-pearl": 4, platinum: 4, "heartgold-soulsilver": 4,
    "black-white": 5, "black-2-white-2": 5,
    "x-y": 6, "omega-ruby-alpha-sapphire": 6,
    "sun-moon": 7, "ultra-sun-ultra-moon": 7, "lets-go-pikachu-lets-go-eevee": 7,
    "sword-shield": 8, "brilliant-diamond-and-shining-pearl": 8, "legends-arceus": 8,
    "scarlet-violet": 9, "the-teal-mask": 9, "the-indigo-disk": 9,
  };

  for (const entry of entries) {
    if (entry.language.name !== lang) continue;
    const versionName =
      entry.version_group?.name ?? entry.version?.name ?? "";
    const gen = genVersionMap[versionName];
    if (gen) {
      const key = `gen${gen}`;
      const text = entry.flavor_text ?? "";
      byGen[key] = text.replace(/\n|\f/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return byGen;
}

function extractLatestFlavorText(
  entries: Array<{
    flavor_text: string;
    language: { name: string };
    version_group?: { name: string };
    version?: { name: string };
  }>,
  lang: string,
): string | null {
  // Get the latest (highest gen) flavor text
  const byGen = extractFlavorText(entries, lang);
  const gens = Object.keys(byGen).sort();
  return gens.length > 0 ? byGen[gens[gens.length - 1]] : null;
}

// ─── Showdown Data Fetching ──────────────────────────────────────────────────

interface ShowdownData {
  pokedex: Record<string, Record<string, unknown>>;
  moves: Record<string, Record<string, unknown>>;
  learnsets: Record<string, { learnset: Record<string, string[]> }>;
  abilityFlags: Map<string, Record<string, boolean>>;
}

const SHOWDOWN_GH_RAW = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data";

function parseShowdownAbilityFlags(tsSource: string): Map<string, Record<string, boolean>> {
  const result = new Map<string, Record<string, boolean>>();
  const lines = tsSource.split("\n");
  let currentAbility: string | null = null;

  for (const line of lines) {
    // Ability key: single-tab indented word followed by `: {`
    const abilityMatch = line.match(/^\t(\w+):\s*\{/);
    if (abilityMatch) {
      currentAbility = abilityMatch[1];
      continue;
    }
    // Flags line: `flags: { key: 1, key: 1 },` or `flags: {},`
    if (currentAbility) {
      const flagsMatch = line.match(/flags:\s*\{([^}]*)\}/);
      if (flagsMatch) {
        const content = flagsMatch[1].trim();
        if (content) {
          const flags: Record<string, boolean> = {};
          for (const pair of content.split(",")) {
            const key = pair.split(":")[0].trim();
            if (key) flags[key] = true;
          }
          if (Object.keys(flags).length > 0) {
            result.set(currentAbility, flags);
          }
        }
      }
    }
  }
  return result;
}

async function fetchShowdownData(): Promise<ShowdownData> {
  console.log("Fetching Showdown data (3 JSON + 1 TS)...");
  const [pokedex, moves, learnsets, abilitiesTsRaw] = await Promise.all([
    cachedFetch(`${SHOWDOWN_BASE}/pokedex.json`, "showdown/pokedex.json"),
    cachedFetch(`${SHOWDOWN_BASE}/moves.json`, "showdown/moves.json"),
    cachedFetch(`${SHOWDOWN_BASE}/learnsets.json`, "showdown/learnsets.json"),
    cachedFetchText(`${SHOWDOWN_GH_RAW}/abilities.ts`, "showdown/abilities.ts"),
  ]);
  const abilityFlags = parseShowdownAbilityFlags(abilitiesTsRaw);
  console.log(`  Showdown data cached. Parsed flags for ${abilityFlags.size} abilities.`);
  return {
    pokedex: pokedex as Record<string, Record<string, unknown>>,
    moves: moves as Record<string, Record<string, unknown>>,
    learnsets: learnsets as Record<string, { learnset: Record<string, string[]> }>,
    abilityFlags,
  };
}

// ─── PokeAPI Data Fetching ───────────────────────────────────────────────────

async function fetchPokeApiSpecies(
  dexNum: number,
): Promise<Record<string, unknown> | null> {
  try {
    return (await cachedFetch(
      `${POKEAPI_BASE}/pokemon-species/${dexNum}`,
      `pokeapi/species/${dexNum}.json`,
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchPokeApiPokemon(
  dexNum: number,
): Promise<Record<string, unknown> | null> {
  try {
    return (await cachedFetch(
      `${POKEAPI_BASE}/pokemon/${dexNum}`,
      `pokeapi/pokemon/${dexNum}.json`,
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchPokeApiMove(
  moveId: number,
): Promise<Record<string, unknown> | null> {
  try {
    return (await cachedFetch(
      `${POKEAPI_BASE}/move/${moveId}`,
      `pokeapi/moves/${moveId}.json`,
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchPokeApiAbility(
  abilityId: number,
): Promise<Record<string, unknown> | null> {
  try {
    return (await cachedFetch(
      `${POKEAPI_BASE}/ability/${abilityId}`,
      `pokeapi/abilities/${abilityId}.json`,
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchPokeApiItem(
  itemId: number,
): Promise<Record<string, unknown> | null> {
  try {
    return (await cachedFetch(
      `${POKEAPI_BASE}/item/${itemId}`,
      `pokeapi/items/${itemId}.json`,
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchPokeApiType(
  typeId: number,
): Promise<Record<string, unknown> | null> {
  try {
    return (await cachedFetch(
      `${POKEAPI_BASE}/type/${typeId}`,
      `pokeapi/types/${typeId}.json`,
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchAllPokeApiData(showdown: ShowdownData): Promise<{
  species: Map<number, Record<string, unknown>>;
  pokemon: Map<number, Record<string, unknown>>;
  moves: Map<number, Record<string, unknown>>;
  abilities: Map<number, Record<string, unknown>>;
  items: Map<number, Record<string, unknown>>;
  types: Map<number, Record<string, unknown>>;
}> {
  // Extract unique dex numbers from Showdown pokedex (base species only)
  const dexNumbers = new Set<number>();
  for (const entry of Object.values(showdown.pokedex)) {
    const num = entry.num as number;
    if (num > 0 && !entry.baseSpecies) {
      dexNumbers.add(num);
    }
  }
  const sortedDexNums = [...dexNumbers].sort((a, b) => a - b);
  const maxDex = sortedDexNums[sortedDexNums.length - 1];
  console.log(`Found ${sortedDexNums.length} base species (max dex: ${maxDex})`);

  // Extract unique move nums from Showdown moves
  const moveNums = new Set<number>();
  for (const move of Object.values(showdown.moves)) {
    const num = move.num as number;
    if (num > 0 && !move.isZ && !move.isMax) {
      moveNums.add(num);
    }
  }
  const sortedMoveNums = [...moveNums].sort((a, b) => a - b);
  console.log(`Found ${sortedMoveNums.length} moves to enrich`);

  // Extract unique ability IDs referenced in pokedex
  // We'll fetch by PokeAPI ID which we'll need to discover
  // For now, collect ability names and fetch the full ability list
  const abilityNames = new Set<string>();
  for (const entry of Object.values(showdown.pokedex)) {
    const abilities = entry.abilities as Record<string, string> | undefined;
    if (abilities) {
      for (const name of Object.values(abilities)) {
        abilityNames.add(name);
      }
    }
  }
  console.log(`Found ${abilityNames.size} unique abilities`);

  // Fetch species data
  console.log("Fetching PokeAPI species data...");
  const speciesResults = await batchProcess(
    sortedDexNums,
    async (num) => {
      const data = await fetchPokeApiSpecies(num);
      return data ? ([num, data] as [number, Record<string, unknown>]) : null;
    },
    CONCURRENCY,
    "Species",
  );
  const speciesMap = new Map(speciesResults.filter(Boolean) as Array<[number, Record<string, unknown>]>);

  // Fetch pokemon data (for base_experience, cries, ev_yields)
  console.log("Fetching PokeAPI pokemon data...");
  const pokemonResults = await batchProcess(
    sortedDexNums,
    async (num) => {
      const data = await fetchPokeApiPokemon(num);
      return data ? ([num, data] as [number, Record<string, unknown>]) : null;
    },
    CONCURRENCY,
    "Pokemon",
  );
  const pokemonMap = new Map(pokemonResults.filter(Boolean) as Array<[number, Record<string, unknown>]>);

  // Fetch move data (for FR names and descriptions)
  console.log("Fetching PokeAPI move data...");
  const moveResults = await batchProcess(
    sortedMoveNums,
    async (num) => {
      const data = await fetchPokeApiMove(num);
      return data ? ([num, data] as [number, Record<string, unknown>]) : null;
    },
    CONCURRENCY,
    "Moves",
  );
  const moveMap = new Map(moveResults.filter(Boolean) as Array<[number, Record<string, unknown>]>);

  // Fetch ability data — need to map ability names to PokeAPI IDs
  // Fetch the full ability list first to get name→ID mapping
  console.log("Fetching PokeAPI ability list...");
  const abilityList = (await cachedFetch(
    `${POKEAPI_BASE}/ability?limit=500`,
    "pokeapi/ability-list.json",
  )) as { results: Array<{ name: string; url: string }> };

  const abilityNameToId = new Map<string, number>();
  for (const item of abilityList.results) {
    const id = Number.parseInt(item.url.split("/").filter(Boolean).pop()!);
    abilityNameToId.set(item.name, id);
  }

  // Map Showdown ability names to PokeAPI IDs
  const abilityIds = new Set<number>();
  for (const name of abilityNames) {
    const kebab = toKebabCase(name);
    const id = abilityNameToId.get(kebab);
    if (id) abilityIds.add(id);
  }

  console.log("Fetching PokeAPI ability details...");
  const abilityResults = await batchProcess(
    [...abilityIds].sort((a, b) => a - b),
    async (id) => {
      const data = await fetchPokeApiAbility(id);
      return data ? ([id, data] as [number, Record<string, unknown>]) : null;
    },
    CONCURRENCY,
    "Abilities",
  );
  const abilityMap = new Map(abilityResults.filter(Boolean) as Array<[number, Record<string, unknown>]>);

  // Fetch items — get the full list, filter by category, then fetch details
  console.log("Fetching PokeAPI item list...");
  const itemList = (await cachedFetch(
    `${POKEAPI_BASE}/item?limit=2500`,
    "pokeapi/item-list.json",
  )) as { results: Array<{ name: string; url: string }> };

  const allItemIds = itemList.results.map((item) => {
    return Number.parseInt(item.url.split("/").filter(Boolean).pop()!);
  });
  console.log(`  Total items in PokeAPI: ${allItemIds.length}`);

  // Fetch item details (we'll filter after fetching based on category)
  console.log("Fetching PokeAPI item details...");
  const itemResults = await batchProcess(
    allItemIds,
    async (id) => {
      const data = await fetchPokeApiItem(id);
      return data ? ([id, data] as [number, Record<string, unknown>]) : null;
    },
    CONCURRENCY,
    "Items",
  );
  const itemMap = new Map(itemResults.filter(Boolean) as Array<[number, Record<string, unknown>]>);

  // Fetch types (18 main types, IDs 1-18; skip "unknown" and "shadow")
  console.log("Fetching PokeAPI type data...");
  const typeIds = Array.from({ length: 18 }, (_, i) => i + 1);
  const typeResults = await batchProcess(
    typeIds,
    async (id) => {
      const data = await fetchPokeApiType(id);
      return data ? ([id, data] as [number, Record<string, unknown>]) : null;
    },
    CONCURRENCY,
    "Types",
  );
  const typeMap = new Map(typeResults.filter(Boolean) as Array<[number, Record<string, unknown>]>);

  return {
    species: speciesMap,
    pokemon: pokemonMap,
    moves: moveMap,
    abilities: abilityMap,
    items: itemMap,
    types: typeMap,
  };
}

// ─── Transformers ────────────────────────────────────────────────────────────

// --- Pokemon ---

interface PokemonForm {
  id: string;
  formName: string;
  formType: "mega" | "regional" | "paradox" | "other";
  types: string[];
  baseStats: Record<string, number>;
  abilities: { ability1: string; ability2: string | null; hidden: string | null };
  height: number;
  weight: number;
}

export interface PokemonEntry {
  dexNumber: number;
  id: string;
  generation: number;
  names: { en: string; fr: string };
  genus: { en: string | null; fr: string | null };
  types: string[];
  height: number;
  weight: number;
  color: string;
  shape: string | null;
  habitat: string | null;
  genderRatio: { male: number; female: number } | "genderless";
  catchRate: number | null;
  baseFriendship: number | null;
  baseExperience: number | null;
  growthRate: string | null;
  evYields: Record<string, number>;
  baseStats: Record<string, number>;
  abilities: { ability1: string; ability2: string | null; hidden: string | null };
  learnset: {
    levelUp: Array<{ level: number; move: string }>;
    tm: string[];
    tutor: string[];
  };
  evolvesFrom: string | null;
  evolutions: Array<{ toId: string; method: string; condition: string | null }>;
  pokedexEntries: Record<string, { en: string | null; fr: string | null }>;
  flags: {
    isLegendary: boolean;
    isMythical: boolean;
    isUltraBeast: boolean;
    isParadox: boolean;
  };
  cry: string | null;
  forms: PokemonForm[];
}

function deriveGeneration(dexNum: number): number {
  if (dexNum <= 151) return 1;
  if (dexNum <= 251) return 2;
  if (dexNum <= 386) return 3;
  if (dexNum <= 493) return 4;
  if (dexNum <= 649) return 5;
  if (dexNum <= 721) return 6;
  if (dexNum <= 809) return 7;
  if (dexNum <= 905) return 8;
  return 9;
}

function deriveFormType(forme: string, showdownEntry: Record<string, unknown>): PokemonForm["formType"] {
  const f = forme.toLowerCase();
  if (f.includes("mega")) return "mega";
  if (
    f.includes("alola") ||
    f.includes("galar") ||
    f.includes("hisui") ||
    f.includes("paldea")
  )
    return "regional";
  const tags = showdownEntry.tags as string[] | undefined;
  if (tags?.includes("Paradox")) return "paradox";
  return "other";
}

function parseLearnset(
  learnsetData: Record<string, string[]> | undefined,
): PokemonEntry["learnset"] {
  const result: PokemonEntry["learnset"] = { levelUp: [], tm: [], tutor: [] };
  if (!learnsetData) return result;

  // Find the highest generation available
  let maxGen = 0;
  for (const entries of Object.values(learnsetData)) {
    for (const entry of entries) {
      const gen = Number.parseInt(entry[0]);
      if (gen > maxGen) maxGen = gen;
    }
  }

  for (const [moveId, entries] of Object.entries(learnsetData)) {
    const kebabMove = toKebabCase(moveId);
    for (const entry of entries) {
      const gen = Number.parseInt(entry[0]);
      if (gen !== maxGen) continue;
      const type = entry[1];
      const rest = entry.slice(2);

      if (type === "L") {
        const level = Number.parseInt(rest) || 0;
        // Avoid duplicates
        if (!result.levelUp.some((e) => e.move === kebabMove && e.level === level)) {
          result.levelUp.push({ level, move: kebabMove });
        }
      } else if (type === "M") {
        if (!result.tm.includes(kebabMove)) result.tm.push(kebabMove);
      } else if (type === "T") {
        if (!result.tutor.includes(kebabMove)) result.tutor.push(kebabMove);
      }
      // Skip E (egg), S (special/event), V (virtual console), R (reminder)
    }
  }

  result.levelUp.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
  result.tm.sort();
  result.tutor.sort();
  return result;
}

function transformShowdownAbilities(
  abilities: Record<string, string> | undefined,
): PokemonEntry["abilities"] {
  if (!abilities) return { ability1: "unknown", ability2: null, hidden: null };
  return {
    ability1: toKebabCase(abilities["0"] ?? "unknown"),
    ability2: abilities["1"] ? toKebabCase(abilities["1"]) : null,
    hidden: abilities["H"] ? toKebabCase(abilities["H"]) : null,
  };
}

function transformPokemon(
  showdown: ShowdownData,
  pokeapi: {
    species: Map<number, Record<string, unknown>>;
    pokemon: Map<number, Record<string, unknown>>;
  },
): PokemonEntry[] {
  console.log("Transforming Pokemon data...");
  const entries: PokemonEntry[] = [];

  // Group forms by base species
  const formsByBase = new Map<string, Array<[string, Record<string, unknown>]>>();
  for (const [key, entry] of Object.entries(showdown.pokedex)) {
    if (entry.baseSpecies) {
      const baseKey = (entry.baseSpecies as string).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!formsByBase.has(baseKey)) formsByBase.set(baseKey, []);
      formsByBase.get(baseKey)!.push([key, entry]);
    }
  }

  for (const [showdownKey, sdEntry] of Object.entries(showdown.pokedex)) {
    // Skip forms (they'll be nested under base species)
    if (sdEntry.baseSpecies) continue;

    const dexNum = sdEntry.num as number;
    if (dexNum <= 0) continue; // Skip CAP, etc.

    const enName = sdEntry.name as string;
    const speciesData = pokeapi.species.get(dexNum);
    const pokemonData = pokeapi.pokemon.get(dexNum);

    // FR name from PokeAPI
    const frName = speciesData
      ? extractFrName(speciesData.names as Array<{ language: { name: string }; name: string }>)
      : null;

    // Genus
    const genera = speciesData?.genera as
      | Array<{ language: { name: string }; genus: string }>
      | undefined;

    // Gender ratio
    const genderRatioRaw = sdEntry.genderRatio as { M: number; F: number } | undefined;
    const genderField = sdEntry.gender as string | undefined;
    let genderRatio: PokemonEntry["genderRatio"];
    if (genderField === "N") {
      genderRatio = "genderless";
    } else if (genderRatioRaw) {
      genderRatio = { male: genderRatioRaw.M * 100, female: genderRatioRaw.F * 100 };
    } else {
      // Default 50/50
      genderRatio = { male: 50, female: 50 };
    }

    // EV yields from PokeAPI
    const evYields: Record<string, number> = {};
    if (pokemonData) {
      const stats = pokemonData.stats as
        | Array<{ effort: number; stat: { name: string } }>
        | undefined;
      if (stats) {
        const statNameMap: Record<string, string> = {
          hp: "hp",
          attack: "atk",
          defense: "def",
          "special-attack": "spa",
          "special-defense": "spd",
          speed: "spe",
        };
        for (const s of stats) {
          if (s.effort > 0) {
            const key = statNameMap[s.stat.name];
            if (key) evYields[key] = s.effort;
          }
        }
      }
    }

    // Cries
    const cries = pokemonData?.cries as { latest?: string } | undefined;
    const cryUrl = cries?.latest ?? null;

    // Evolution
    const prevo = sdEntry.prevo as string | undefined;
    const evos = sdEntry.evos as string[] | undefined;
    const evolutions: PokemonEntry["evolutions"] = [];
    if (evos) {
      for (const evo of evos) {
        const evoKey = evo.toLowerCase().replace(/[^a-z0-9]/g, "");
        const evoEntry = showdown.pokedex[evoKey];
        if (evoEntry) {
          const method = (evoEntry.evoType as string) ?? "levelUp";
          const conditions: string[] = [];
          if (evoEntry.evoLevel) conditions.push(`level ${evoEntry.evoLevel}`);
          if (evoEntry.evoItem) conditions.push(`item: ${evoEntry.evoItem}`);
          if (evoEntry.evoCondition) conditions.push(evoEntry.evoCondition as string);
          evolutions.push({
            toId: toKebabCase(evo),
            method,
            condition: conditions.length > 0 ? conditions.join(", ") : null,
          });
        }
      }
    }

    // Flavor text from PokeAPI species
    let pokedexEntries: Record<string, { en: string | null; fr: string | null }> = {};
    if (speciesData) {
      const flavorEntries = speciesData.flavor_text_entries as
        | Array<{
            flavor_text: string;
            language: { name: string };
            version: { name: string };
          }>
        | undefined;
      if (flavorEntries) {
        const enByGen = extractFlavorText(flavorEntries, "en");
        const frByGen = extractFlavorText(flavorEntries, "fr");
        const allGens = new Set([...Object.keys(enByGen), ...Object.keys(frByGen)]);
        for (const gen of allGens) {
          pokedexEntries[gen] = { en: enByGen[gen] ?? null, fr: frByGen[gen] ?? null };
        }
      }
    }

    // Learnset
    const learnsetKey = showdownKey.toLowerCase().replace(/[^a-z0-9]/g, "");
    const learnsetData = showdown.learnsets[learnsetKey]?.learnset;
    const learnset = parseLearnset(learnsetData);

    // Flags
    const tags = sdEntry.tags as string[] | undefined;
    const isLegendary =
      (speciesData?.is_legendary as boolean) ??
      tags?.some((t) => t.includes("Legendary")) ??
      false;
    const isMythical = (speciesData?.is_mythical as boolean) ?? false;
    const isUltraBeast = tags?.includes("Ultra Beast") ?? false;
    const isParadox = tags?.includes("Paradox") ?? false;

    // Forms (excluding Gmax, Totem, Z-forms)
    const forms: PokemonForm[] = [];
    const formEntries = formsByBase.get(showdownKey) ?? [];
    for (const [, formEntry] of formEntries) {
      const forme = formEntry.forme as string;
      if (!forme) continue;

      const formeLower = forme.toLowerCase();
      // Exclude Gigantamax, Totem, Eternamax, Starter (Pikachu cosplay forms)
      if (
        formeLower.includes("gmax") ||
        formeLower === "gigantamax" ||
        formeLower.includes("totem") ||
        formeLower.includes("eternamax")
      ) {
        continue;
      }

      const formId = toKebabCase(formEntry.name as string);
      const rawFormTypes = formEntry.types as string[] | undefined;
      if (!rawFormTypes) continue; // Skip forms without type data
      const formTypes = rawFormTypes.map((t) => t.toLowerCase());
      const formStats = (formEntry.baseStats as Record<string, number>) ?? sdEntry.baseStats;
      const formAbilities = transformShowdownAbilities(
        formEntry.abilities as Record<string, string>,
      );

      forms.push({
        id: formId,
        formName: forme,
        formType: deriveFormType(forme, formEntry),
        types: formTypes,
        baseStats: formStats,
        abilities: formAbilities,
        height: formEntry.heightm as number,
        weight: formEntry.weightkg as number,
      });
    }

    // Species metadata from PokeAPI
    const shape = speciesData?.shape
      ? (speciesData.shape as { name: string }).name
      : null;
    const habitat = speciesData?.habitat
      ? (speciesData.habitat as { name: string }).name
      : null;
    const growthRate = speciesData?.growth_rate
      ? (speciesData.growth_rate as { name: string }).name
      : null;

    entries.push({
      dexNumber: dexNum,
      id: toKebabCase(enName),
      generation: deriveGeneration(dexNum),
      names: { en: enName, fr: frName ?? enName },
      genus: {
        en: genera ? extractEnGenus(genera) : null,
        fr: genera ? extractFrGenus(genera) : null,
      },
      types: (sdEntry.types as string[]).map((t) => t.toLowerCase()),
      height: sdEntry.heightm as number,
      weight: sdEntry.weightkg as number,
      color: ((sdEntry.color as string) ?? "").toLowerCase(),
      shape,
      habitat,
      genderRatio,
      catchRate: (speciesData?.capture_rate as number) ?? null,
      baseFriendship: (speciesData?.base_happiness as number) ?? null,
      baseExperience: (pokemonData?.base_experience as number) ?? null,
      growthRate,
      evYields,
      baseStats: sdEntry.baseStats as Record<string, number>,
      abilities: transformShowdownAbilities(sdEntry.abilities as Record<string, string>),
      learnset,
      evolvesFrom: prevo ? toKebabCase(prevo) : null,
      evolutions,
      pokedexEntries,
      flags: { isLegendary, isMythical, isUltraBeast, isParadox },
      cry: cryUrl,
      forms,
    });
  }

  entries.sort((a, b) => a.dexNumber - b.dexNumber);
  console.log(`  Generated ${entries.length} Pokemon entries with ${entries.reduce((s, e) => s + e.forms.length, 0)} forms`);
  return entries;
}

// --- Moves ---

export interface MoveEntry {
  id: string;
  generation: number;
  names: { en: string; fr: string };
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  maxPp: number;
  priority: number;
  target: string;
  shortDescription: { en: string; fr: string | null };
  longDescription: { en: string | null; fr: string | null };
  secondary: {
    chance: number | null;
    status: string | null;
    boosts: Record<string, number> | null;
    volatileStatus: string | null;
  } | null;
  drain: number | null;
  recoil: number | null;
  critRatio: number;
  flags: Record<string, boolean>;
  ignoresAbility: boolean;
  isSignatureOf: string | null;
}

function transformMoves(
  showdown: ShowdownData,
  pokeapiMoves: Map<number, Record<string, unknown>>,
): MoveEntry[] {
  console.log("Transforming moves data...");
  const entries: MoveEntry[] = [];

  for (const [, sdMove] of Object.entries(showdown.moves)) {
    const num = sdMove.num as number;
    if (num <= 0) continue;

    // Skip Z-moves and Max moves
    if (sdMove.isZ || sdMove.isMax) continue;

    // Skip moves marked as non-standard (CAP moves, etc.) except "Past" which are real moves
    const isNonstandard = sdMove.isNonstandard as string | undefined;
    if (isNonstandard && isNonstandard !== "Past" && isNonstandard !== "Unobtainable") continue;

    const enName = sdMove.name as string;
    const id = toKebabCase(enName);
    const category = ((sdMove.category as string) ?? "Physical").toLowerCase();
    const basePower = sdMove.basePower as number;
    const accuracy = sdMove.accuracy as number | boolean;
    const pp = sdMove.pp as number;

    // FR name from PokeAPI
    const pokeapiData = pokeapiMoves.get(num);
    const frName = pokeapiData
      ? extractFrName(
          pokeapiData.names as Array<{ language: { name: string }; name: string }>,
        )
      : null;

    // FR description from PokeAPI flavor text
    const frDesc = pokeapiData
      ? extractLatestFlavorText(
          pokeapiData.flavor_text_entries as Array<{
            flavor_text: string;
            language: { name: string };
            version_group: { name: string };
          }>,
          "fr",
        )
      : null;

    // Flags
    const sdFlags = (sdMove.flags as Record<string, number>) ?? {};
    const flags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(sdFlags)) {
      flags[key] = value === 1;
    }

    // Secondary effect
    let secondary: MoveEntry["secondary"] = null;
    const sdSecondary = sdMove.secondary as Record<string, unknown> | undefined;
    const directStatus = sdMove.status as string | undefined;
    const directBoosts = sdMove.boosts as Record<string, number> | undefined;
    const directVolatile = sdMove.volatileStatus as string | undefined;

    if (sdSecondary) {
      secondary = {
        chance: (sdSecondary.chance as number) ?? null,
        status: (sdSecondary.status as string) ?? null,
        boosts: (sdSecondary.boosts as Record<string, number>) ?? null,
        volatileStatus: (sdSecondary.volatileStatus as string) ?? null,
      };
    } else if (directStatus || directBoosts || directVolatile) {
      secondary = {
        chance: 100,
        status: directStatus ?? null,
        boosts: directBoosts ?? null,
        volatileStatus: directVolatile ?? null,
      };
    }

    // Drain / Recoil
    const drainArr = sdMove.drain as [number, number] | undefined;
    const recoilArr = sdMove.recoil as [number, number] | undefined;
    const drain = drainArr ? drainArr[0] / drainArr[1] : null;
    const recoil = recoilArr ? recoilArr[0] / recoilArr[1] : null;

    // Generation
    const gen = (sdMove.gen as number) ?? deriveGeneration(0);

    entries.push({
      id,
      generation: gen,
      names: { en: enName, fr: frName ?? enName },
      type: ((sdMove.type as string) ?? "Normal").toLowerCase(),
      category,
      power: basePower > 0 ? basePower : null,
      accuracy: typeof accuracy === "number" ? accuracy : null,
      pp,
      maxPp: Math.floor(pp * 1.6),
      priority: (sdMove.priority as number) ?? 0,
      target: (sdMove.target as string) ?? "normal",
      shortDescription: {
        en: (sdMove.shortDesc as string) ?? "",
        fr: frDesc,
      },
      longDescription: {
        en: (sdMove.desc as string) ?? null,
        fr: frDesc,
      },
      secondary,
      drain,
      recoil,
      critRatio: (sdMove.critRatio as number) ?? 1,
      flags,
      ignoresAbility: (sdMove.ignoreAbility as boolean) ?? false,
      isSignatureOf: null, // Could be derived but complex
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  console.log(`  Generated ${entries.length} move entries`);
  return entries;
}

// --- Abilities ---

export interface AbilityEntry {
  id: string;
  generation: number;
  names: { en: string; fr: string };
  shortDescription: { en: string | null; fr: string | null };
  longDescription: { en: string | null; fr: string | null };
  flags: { breakable: boolean; ignorable: boolean; unsuppressable: boolean };
}

function transformAbilities(
  pokeapiAbilities: Map<number, Record<string, unknown>>,
  showdownAbilityFlags: Map<string, Record<string, boolean>>,
): AbilityEntry[] {
  console.log("Transforming abilities data...");
  const entries: AbilityEntry[] = [];

  for (const [, data] of pokeapiAbilities) {
    const id = (data.name as string) ?? "";
    const gen = (data.generation as { name: string })?.name;
    const genNum = gen ? Number.parseInt(gen.replace("generation-", "")) : 0;
    const romanToNum: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
    const generation = romanToNum[gen?.replace("generation-", "") ?? ""] ?? genNum;

    const names = data.names as Array<{ language: { name: string }; name: string }>;
    const enName = names?.find((n) => n.language.name === "en")?.name ?? id;
    const frName = extractFrName(names ?? []);

    const effectEntries = data.effect_entries as
      | Array<{ effect: string; short_effect: string; language: { name: string } }>
      | undefined;
    const enEffect = effectEntries?.find((e) => e.language.name === "en");

    const flavorEntries = data.flavor_text_entries as
      | Array<{
          flavor_text: string;
          language: { name: string };
          version_group: { name: string };
        }>
      | undefined;
    const frFlavor = flavorEntries
      ? extractLatestFlavorText(flavorEntries, "fr")
      : null;

    entries.push({
      id,
      generation,
      names: { en: enName, fr: frName ?? enName },
      shortDescription: {
        en: enEffect?.short_effect ?? null,
        fr: frFlavor,
      },
      longDescription: {
        en: enEffect?.effect ?? null,
        fr: frFlavor,
      },
      flags: (() => {
        // Showdown key is lowercase no separators: "solar-power" → "solarpower"
        const sdKey = id.replace(/-/g, "");
        const sdFlags = showdownAbilityFlags.get(sdKey);
        return {
          breakable: sdFlags?.breakable ?? false,
          ignorable: sdFlags?.breakable ?? false, // "breakable" = ignorable by Mold Breaker
          unsuppressable: sdFlags?.cantsuppress ?? false,
        };
      })(),
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  console.log(`  Generated ${entries.length} ability entries`);
  return entries;
}

// --- Items ---

export interface ItemEntry {
  id: string;
  generation: number;
  names: { en: string; fr: string };
  category: string;
  shortDescription: { en: string | null; fr: string | null };
  longDescription: { en: string | null; fr: string | null };
  flingPower: number | null;
  flingEffect: string | null;
  naturalGift: { type: string; power: number } | null;
  consumable: boolean;
  price: number | null;
}

// Categories to exclude
const EXCLUDED_ITEM_CATEGORIES = new Set([
  "unused", "loot", "all-mail", "all-machines",
  "gameplay", "plot-advancement", "species-candies",
  "dynamax-crystals", "tera-shard", "picnic",
]);

// Z-crystal and Tera-related item name patterns
const EXCLUDED_ITEM_PATTERNS = [
  /z$/i,         // Z-crystals end with "z"
  /ium-z$/i,     // e.g., normalium-z
  /tera-shard/i,
  /dynamax/i,
];

function transformItems(
  pokeapiItems: Map<number, Record<string, unknown>>,
): ItemEntry[] {
  console.log("Transforming items data...");
  const entries: ItemEntry[] = [];

  for (const [, data] of pokeapiItems) {
    const id = data.name as string;
    const category = (data.category as { name: string })?.name ?? "unknown";

    // Filter by category
    if (EXCLUDED_ITEM_CATEGORIES.has(category)) continue;

    // Filter Z-crystals and Tera items by name pattern
    if (category === "z-crystals") continue;

    // Skip by name patterns
    if (EXCLUDED_ITEM_PATTERNS.some((p) => p.test(id))) continue;

    const names = data.names as Array<{ language: { name: string }; name: string }>;
    const enName = names?.find((n) => n.language.name === "en")?.name ?? id;
    const frName = extractFrName(names ?? []);

    const effectEntries = data.effect_entries as
      | Array<{ effect: string; short_effect: string; language: { name: string } }>
      | undefined;
    const enEffect = effectEntries?.find((e) => e.language.name === "en");

    const flavorEntries = data.flavor_text_entries as
      | Array<{
          flavor_text: string;
          language: { name: string };
          version_group: { name: string };
        }>
      | undefined;
    const frFlavor = flavorEntries
      ? extractLatestFlavorText(flavorEntries, "fr")
      : null;

    const flingEffect = data.fling_effect as { name: string } | null;
    const flingPower = data.fling_power as number | null;
    const cost = data.cost as number;

    // Determine generation from game_indices
    const gameIndices = data.game_indices as
      | Array<{ generation: { name: string } }>
      | undefined;
    let generation = 0;
    if (gameIndices && gameIndices.length > 0) {
      const romanToNum: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
      for (const gi of gameIndices) {
        const genName = gi.generation.name.replace("generation-", "");
        const num = romanToNum[genName] ?? 0;
        if (generation === 0 || num < generation) generation = num;
      }
    }

    // Determine if consumable
    const attributes = data.attributes as Array<{ name: string }> | undefined;
    const consumable = attributes?.some((a) => a.name === "consumable") ?? false;

    // Determine if it's a mega stone
    const isMegaStone = category === "mega-stones" || id.endsWith("ite") || id.endsWith("ite-x") || id.endsWith("ite-y");

    // Map PokeAPI category to our simplified categories
    let ourCategory: string;
    if (category === "mega-stones" || isMegaStone) {
      ourCategory = "mega-stone";
    } else if (category.includes("berries")) {
      ourCategory = "berry";
    } else if (category === "evolution") {
      ourCategory = "evolution";
    } else if (category.includes("medicine") || category.includes("healing") || category.includes("revival") || category.includes("status-cures") || category.includes("pp-recovery")) {
      ourCategory = "medicine";
    } else if (category.includes("held") || category.includes("choice") || category.includes("type-enhancement") || category.includes("type-protection") || category.includes("stat-boosts") || category.includes("effort") || category.includes("species-specific") || category.includes("in-a-pinch")) {
      ourCategory = "heldItem";
    } else if (category.includes("battle")) {
      ourCategory = "battle";
    } else {
      ourCategory = "other";
    }

    entries.push({
      id,
      generation,
      names: { en: enName, fr: frName ?? enName },
      category: ourCategory,
      shortDescription: { en: enEffect?.short_effect ?? null, fr: frFlavor },
      longDescription: { en: enEffect?.effect ?? null, fr: frFlavor },
      flingPower: flingPower ?? null,
      flingEffect: flingEffect?.name ?? null,
      naturalGift: null, // PokeAPI doesn't expose natural gift data structured easily
      consumable,
      price: cost > 0 ? cost : null,
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  console.log(`  Generated ${entries.length} item entries`);
  return entries;
}

// --- Type Chart ---

interface TypeChartEntry {
  types: string[];
  effectiveness: Record<string, Record<string, number>>;
}

function transformTypeChart(
  pokeapiTypes: Map<number, Record<string, unknown>>,
): TypeChartEntry {
  console.log("Transforming type chart from PokeAPI...");

  const types: string[] = [];
  // effectiveness[attackingType][defendingType] = multiplier
  const effectiveness: Record<string, Record<string, number>> = {};

  for (const [, typeData] of pokeapiTypes) {
    const typeName = (typeData.name as string).toLowerCase();
    types.push(typeName);

    const damageRelations = typeData.damage_relations as {
      double_damage_to: Array<{ name: string }>;
      half_damage_to: Array<{ name: string }>;
      no_damage_to: Array<{ name: string }>;
    };

    effectiveness[typeName] = {};
    // Default is 1x (neutral)
    for (const other of types) {
      effectiveness[typeName][other] = 1;
    }
    for (const t of damageRelations.double_damage_to) {
      effectiveness[typeName][t.name] = 2;
    }
    for (const t of damageRelations.half_damage_to) {
      effectiveness[typeName][t.name] = 0.5;
    }
    for (const t of damageRelations.no_damage_to) {
      effectiveness[typeName][t.name] = 0;
    }
  }

  // Second pass: fill in 1x for any missing pairs (types loaded in order)
  for (const atk of types) {
    for (const def of types) {
      if (effectiveness[atk][def] === undefined) {
        effectiveness[atk][def] = 1;
      }
    }
  }

  types.sort();
  console.log(`  Generated type chart with ${types.length} types`);
  return { types, effectiveness };
}

// ─── Index Generators ────────────────────────────────────────────────────────

type Index = Record<string, string[]>;

function addToIndex(index: Index, key: string, value: string): void {
  if (!index[key]) index[key] = [];
  if (!index[key].includes(value)) index[key].push(value);
}

function generateMoveIndexes(moves: MoveEntry[]): Record<string, Index> {
  console.log("Generating move indexes...");

  const byType: Index = {};
  const byCategory: Index = {};
  const byFlag: Index = {};
  const byTarget: Index = {};
  const bySecondaryStatus: Index = {};
  const byStatChange: Index = {};
  const byPowerBracket: Index = {};
  const byPriority: Index = {};
  const byGeneration: Index = {};

  for (const move of moves) {
    // by-type
    addToIndex(byType, move.type, move.id);

    // by-category
    addToIndex(byCategory, move.category, move.id);

    // by-flag
    for (const [flag, active] of Object.entries(move.flags)) {
      if (active) addToIndex(byFlag, flag, move.id);
    }

    // by-target
    addToIndex(byTarget, move.target, move.id);

    // by-secondary-status
    if (move.secondary?.status) {
      const statusMap: Record<string, string> = {
        brn: "burn", par: "paralysis", slp: "sleep", frz: "freeze",
        psn: "poison", tox: "toxic",
      };
      addToIndex(bySecondaryStatus, statusMap[move.secondary.status] ?? move.secondary.status, move.id);
    }
    if (move.secondary?.volatileStatus) {
      const volatileMap: Record<string, string> = {
        flinch: "flinch", confusion: "confusion",
      };
      addToIndex(bySecondaryStatus, volatileMap[move.secondary.volatileStatus] ?? move.secondary.volatileStatus, move.id);
    }

    // by-stat-change
    if (move.secondary?.boosts) {
      for (const [stat, amount] of Object.entries(move.secondary.boosts)) {
        const sign = amount > 0 ? "+" : "";
        addToIndex(byStatChange, `${stat}${sign}${amount}`, move.id);
      }
    }

    // by-power-bracket
    if (move.power === null) {
      addToIndex(byPowerBracket, "status", move.id);
    } else if (move.power === 0) {
      addToIndex(byPowerBracket, "status", move.id);
    } else if (move.power <= 40) {
      addToIndex(byPowerBracket, "1-40", move.id);
    } else if (move.power <= 70) {
      addToIndex(byPowerBracket, "41-70", move.id);
    } else if (move.power <= 90) {
      addToIndex(byPowerBracket, "71-90", move.id);
    } else if (move.power <= 110) {
      addToIndex(byPowerBracket, "91-110", move.id);
    } else {
      addToIndex(byPowerBracket, "111+", move.id);
    }
    // Variable power moves (basePowerCallback in Showdown) would need special handling
    // For now they go in their nominal bracket

    // by-priority
    addToIndex(byPriority, `${move.priority >= 0 ? "+" : ""}${move.priority}`, move.id);

    // by-generation
    addToIndex(byGeneration, String(move.generation), move.id);
  }

  return {
    "moves-by-type": byType,
    "moves-by-category": byCategory,
    "moves-by-flag": byFlag,
    "moves-by-target": byTarget,
    "moves-by-secondary-status": bySecondaryStatus,
    "moves-by-stat-change": byStatChange,
    "moves-by-power-bracket": byPowerBracket,
    "moves-by-priority": byPriority,
    "moves-by-generation": byGeneration,
  };
}

function generatePokemonIndexes(pokemon: PokemonEntry[]): Record<string, Index | string[]> {
  console.log("Generating Pokemon indexes...");

  const byType: Index = {};
  const byAbility: Index = {};
  const byMove: Index = {};
  const byGeneration: Index = {};
  const byFlag: Index = {};
  const byTopStat: Index = {};
  const byBstBracket: Index = {};
  const withMega: string[] = [];

  for (const pkmn of pokemon) {
    // by-type (base + forms)
    for (const type of pkmn.types) {
      addToIndex(byType, type, pkmn.id);
    }
    for (const form of pkmn.forms) {
      for (const type of form.types) {
        addToIndex(byType, type, form.id);
      }
    }

    // by-ability (base + forms)
    const abilities = [pkmn.abilities.ability1, pkmn.abilities.ability2, pkmn.abilities.hidden];
    for (const ability of abilities) {
      if (ability) addToIndex(byAbility, ability, pkmn.id);
    }
    for (const form of pkmn.forms) {
      const fAbilities = [form.abilities.ability1, form.abilities.ability2, form.abilities.hidden];
      for (const ability of fAbilities) {
        if (ability) addToIndex(byAbility, ability, form.id);
      }
    }

    // by-move (learnset inversé)
    const allMoves = [
      ...pkmn.learnset.levelUp.map((e) => e.move),
      ...pkmn.learnset.tm,
      ...pkmn.learnset.tutor,
    ];
    for (const move of allMoves) {
      addToIndex(byMove, move, pkmn.id);
    }

    // by-generation
    addToIndex(byGeneration, String(pkmn.generation), pkmn.id);

    // by-flag
    if (pkmn.flags.isLegendary) addToIndex(byFlag, "legendary", pkmn.id);
    if (pkmn.flags.isMythical) addToIndex(byFlag, "mythical", pkmn.id);
    if (pkmn.flags.isUltraBeast) addToIndex(byFlag, "ultraBeast", pkmn.id);
    if (pkmn.flags.isParadox) addToIndex(byFlag, "paradox", pkmn.id);

    // by-top-stat (base form only)
    const stats = pkmn.baseStats;
    let topStat = "hp";
    let topValue = 0;
    for (const [stat, value] of Object.entries(stats)) {
      if (value > topValue) {
        topValue = value;
        topStat = stat;
      }
    }
    addToIndex(byTopStat, topStat, pkmn.id);

    // by-bst-bracket
    const bst = Object.values(pkmn.baseStats).reduce((sum, v) => sum + v, 0);
    let bracket: string;
    if (bst < 350) bracket = "<350";
    else if (bst <= 450) bracket = "350-450";
    else if (bst <= 525) bracket = "450-525";
    else if (bst <= 600) bracket = "525-600";
    else bracket = "600+";
    addToIndex(byBstBracket, bracket, pkmn.id);

    // pokemon-with-mega
    if (pkmn.forms.some((f) => f.formType === "mega")) {
      withMega.push(pkmn.id);
    }
  }

  return {
    "pokemon-by-type": byType,
    "pokemon-by-ability": byAbility,
    "pokemon-by-move": byMove,
    "pokemon-by-generation": byGeneration,
    "pokemon-by-flag": byFlag,
    "pokemon-by-top-stat": byTopStat,
    "pokemon-by-bst-bracket": byBstBracket,
    "pokemon-with-mega": withMega,
  };
}

function generateItemIndexes(items: ItemEntry[]): Record<string, Index> {
  const byCategory: Index = {};
  for (const item of items) {
    addToIndex(byCategory, item.category, item.id);
  }
  return { "items-by-category": byCategory };
}

function generateAbilityIndexes(abilities: AbilityEntry[]): Record<string, Index> {
  const byFlag: Index = {};
  for (const ability of abilities) {
    if (ability.flags.breakable) addToIndex(byFlag, "breakable", ability.id);
    if (ability.flags.ignorable) addToIndex(byFlag, "ignorable", ability.id);
    if (ability.flags.unsuppressable) addToIndex(byFlag, "unsuppressable", ability.id);
  }
  return { "abilities-by-flag": byFlag };
}

// ─── Champions Overrides Application ─────────────────────────────────────────

interface ApplyOverrideSummary {
  moves: number;
  abilities: number;
  items: number;
  learnsets: number;
  skippedUnknownIds: string[];
}

/**
 * Applique les overrides Champions aux entrées transformées.
 *
 * Mutation in-place des entrées. Les champs non overridés sont préservés.
 * `maxPp` est recalculé automatiquement quand `pp` change.
 * Lance une erreur si un override cible un ID inexistant dans la base Showdown
 * (protection contre les typos).
 */
/**
 * Convertit un ID kebab-case ("aurora-beam") vers le format Showdown
 * lowercase-concatenated ("aurorabeam") utilisé comme clé dans les mods Champions.
 */
function toShowdownId(kebabId: string): string {
  return kebabId.replace(/-/g, "");
}

export function applyChampionsOverrides(
  moves: MoveEntry[],
  abilities: AbilityEntry[],
  items: ItemEntry[],
  pokemonEntries: PokemonEntry[],
  overrides: ChampionsOverride,
): ApplyOverrideSummary {
  const summary: ApplyOverrideSummary = {
    moves: 0,
    abilities: 0,
    items: 0,
    learnsets: 0,
    skippedUnknownIds: [],
  };

  // Les overrides Champions utilisent les IDs Showdown (lowercase-concat).
  // Nos entries utilisent kebab-case. On indexe par le format Showdown pour matcher.
  const moveById = new Map(moves.map((m) => [toShowdownId(m.id), m]));
  const abilityById = new Map(abilities.map((a) => [toShowdownId(a.id), a]));
  const itemById = new Map(items.map((i) => [toShowdownId(i.id), i]));
  const pokemonById = new Map(pokemonEntries.map((p) => [toShowdownId(p.id), p]));

  // Moves
  for (const [id, override] of Object.entries(overrides.moves)) {
    const entry = moveById.get(id);
    if (entry === undefined) {
      summary.skippedUnknownIds.push(`move:${id}`);
      continue;
    }
    if (applyMoveOverride(entry, override)) summary.moves++;
  }

  // Abilities
  for (const [id, override] of Object.entries(overrides.abilities)) {
    const entry = abilityById.get(id);
    if (entry === undefined) {
      summary.skippedUnknownIds.push(`ability:${id}`);
      continue;
    }
    if (applyAbilityOverride(entry, override)) summary.abilities++;
  }

  // Items
  for (const [id, override] of Object.entries(overrides.items)) {
    const entry = itemById.get(id);
    if (entry === undefined) {
      summary.skippedUnknownIds.push(`item:${id}`);
      continue;
    }
    if (applyItemOverride(entry, override)) summary.items++;
  }

  // Learnsets — remplacement total pour les Pokemon présents dans l'override
  for (const [id, override] of Object.entries(overrides.learnsets)) {
    const entry = pokemonById.get(id);
    if (entry === undefined) {
      summary.skippedUnknownIds.push(`learnset:${id}`);
      continue;
    }
    applyLearnsetOverride(entry, override);
    summary.learnsets++;
  }

  return summary;
}

function applyMoveOverride(
  entry: MoveEntry,
  override: ChampionsOverride["moves"][string],
): boolean {
  let mutated = false;

  if (override.basePower !== undefined) {
    entry.power = override.basePower > 0 ? override.basePower : null;
    mutated = true;
  }
  if (override.pp !== undefined) {
    entry.pp = override.pp;
    entry.maxPp = Math.floor(override.pp * 1.6);
    mutated = true;
  }
  if (override.accuracy !== undefined) {
    entry.accuracy = override.accuracy === true ? null : override.accuracy;
    mutated = true;
  }
  if (override.type !== undefined) {
    entry.type = override.type.toLowerCase();
    mutated = true;
  }
  if (override.category !== undefined) {
    entry.category = override.category.toLowerCase();
    mutated = true;
  }
  if (override.priority !== undefined) {
    entry.priority = override.priority;
    mutated = true;
  }
  if (override.target !== undefined) {
    entry.target = override.target;
    mutated = true;
  }
  if (override.shortDesc !== undefined) {
    entry.shortDescription = { en: override.shortDesc, fr: entry.shortDescription.fr };
    mutated = true;
  }
  if (override.desc !== undefined) {
    entry.longDescription = { en: override.desc, fr: entry.longDescription.fr };
    mutated = true;
  }
  if (override.flags !== undefined) {
    const newFlags: Record<string, boolean> = {};
    for (const [flagKey, flagValue] of Object.entries(override.flags)) {
      newFlags[flagKey] = flagValue === 1;
    }
    entry.flags = newFlags;
    mutated = true;
  }
  if (override.secondary === null) {
    entry.secondary = null;
    mutated = true;
  } else if (override.secondary !== undefined) {
    entry.secondary = {
      chance: override.secondary.chance,
      status: override.secondary.status ?? null,
      boosts: (override.secondary.boosts as Record<string, number> | undefined) ?? null,
      volatileStatus: override.secondary.volatileStatus ?? null,
    };
    mutated = true;
  }

  return mutated;
}

function applyAbilityOverride(
  entry: AbilityEntry,
  override: ChampionsOverride["abilities"][string],
): boolean {
  let mutated = false;
  if (override.shortDesc !== undefined) {
    entry.shortDescription = { en: override.shortDesc, fr: entry.shortDescription.fr };
    mutated = true;
  }
  if (override.desc !== undefined) {
    entry.longDescription = { en: override.desc, fr: entry.longDescription.fr };
    mutated = true;
  }
  // isNonstandard n'est pas stocké dans AbilityEntry — ignoré silencieusement
  return mutated;
}

function applyItemOverride(
  entry: ItemEntry,
  override: ChampionsOverride["items"][string],
): boolean {
  let mutated = false;
  if (override.shortDesc !== undefined) {
    entry.shortDescription = { en: override.shortDesc, fr: entry.shortDescription.fr };
    mutated = true;
  }
  if (override.desc !== undefined) {
    entry.longDescription = { en: override.desc, fr: entry.longDescription.fr };
    mutated = true;
  }
  return mutated;
}

/**
 * Remplace entièrement le learnset du Pokemon par celui de Champions.
 * Convertit les codes Showdown ("9M", "9L15", "9T") vers notre structure
 * { levelUp, tm, tutor }.
 */
function applyLearnsetOverride(
  entry: PokemonEntry,
  override: ChampionsOverride["learnsets"][string],
): void {
  const levelUp: Array<{ level: number; move: string }> = [];
  const tm: string[] = [];
  const tutor: string[] = [];

  for (const [moveId, codes] of Object.entries(override.learnset)) {
    for (const code of codes) {
      // Format : "9M" = TM gen 9, "9L15" = level-up at 15, "9T" = tutor
      // On ignore la génération (toujours 9 pour Champions)
      const body = code.slice(1); // retire le préfixe gen
      if (body.startsWith("M")) {
        tm.push(moveId);
        break; // un seul M suffit
      } else if (body.startsWith("L")) {
        const level = Number(body.slice(1)) || 1;
        levelUp.push({ level, move: moveId });
      } else if (body.startsWith("T")) {
        tutor.push(moveId);
        break;
      }
    }
  }

  // Dédoublonne TM et tutor
  entry.learnset = {
    levelUp: levelUp.sort((a, b) => a.level - b.level),
    tm: [...new Set(tm)],
    tutor: [...new Set(tutor)],
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("=== Pokemon Reference Knowledge Base Builder ===\n");

  await ensureDir(CACHE_DIR);
  await ensureDir(REFERENCE_DIR);
  await ensureDir(INDEXES_DIR);

  // Step 1: Fetch data
  let showdown: ShowdownData;
  let pokeapi: Awaited<ReturnType<typeof fetchAllPokeApiData>>;

  if (SKIP_FETCH) {
    console.log("Loading cached data (--skip-fetch)...");
    // Read from cache
    const abilitiesTsRaw = await readFile(join(CACHE_DIR, "showdown/abilities.ts"), "utf-8");
    showdown = {
      pokedex: JSON.parse(await readFile(join(CACHE_DIR, "showdown/pokedex.json"), "utf-8")),
      moves: JSON.parse(await readFile(join(CACHE_DIR, "showdown/moves.json"), "utf-8")),
      learnsets: JSON.parse(await readFile(join(CACHE_DIR, "showdown/learnsets.json"), "utf-8")),
      abilityFlags: parseShowdownAbilityFlags(abilitiesTsRaw),
    };
    // For --skip-fetch, we still need PokeAPI data from cache
    // This will read from cache since files exist
    pokeapi = await fetchAllPokeApiData(showdown);
  } else {
    showdown = await fetchShowdownData();
    if (FETCH_ONLY) {
      console.log("\nFetch-only mode. Running PokeAPI fetch...");
    }
    pokeapi = await fetchAllPokeApiData(showdown);
    if (FETCH_ONLY) {
      console.log(`\nFetch complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      return;
    }
  }

  // Step 2: Transform
  console.log("\n--- Transforming data ---\n");

  const pokemonEntries = transformPokemon(showdown, pokeapi);
  const moveEntries = transformMoves(showdown, pokeapi.moves);
  const abilityEntries = transformAbilities(pokeapi.abilities, showdown.abilityFlags);
  const itemEntries = transformItems(pokeapi.items);
  const typeChart = transformTypeChart(pokeapi.types);

  // Step 2b: Apply Champions overrides
  console.log("\n--- Applying Champions overrides ---\n");
  const championsOverride = await fetchChampionsData();
  const overrideSummary = applyChampionsOverrides(
    moveEntries,
    abilityEntries,
    itemEntries,
    pokemonEntries,
    championsOverride,
  );
  console.log(
    `  Applied: ${overrideSummary.moves} moves, ${overrideSummary.abilities} abilities, ${overrideSummary.items} items, ${overrideSummary.learnsets} learnsets`,
  );
  if (overrideSummary.skippedUnknownIds.length > 0) {
    // Groupe les IDs inconnus par catégorie (move:, ability:, item:, learnset:)
    const byCategory = new Map<string, string[]>();
    for (const prefixed of overrideSummary.skippedUnknownIds) {
      const colonIdx = prefixed.indexOf(":");
      const category = prefixed.slice(0, colonIdx);
      const id = prefixed.slice(colonIdx + 1);
      const existing = byCategory.get(category) ?? [];
      existing.push(id);
      byCategory.set(category, existing);
    }
    console.log(
      `  Info: ${overrideSummary.skippedUnknownIds.length} override(s) target IDs not in our base (new to Champions, skipped):`,
    );
    for (const [category, ids] of byCategory) {
      const preview = ids.slice(0, 3).join(", ");
      const suffix = ids.length > 3 ? `, … (${ids.length} total)` : "";
      console.log(`    ${category}: ${preview}${suffix}`);
    }
  }

  // Step 3: Write main files
  console.log("\n--- Writing output files ---\n");

  const writeJson = async (filename: string, data: unknown): Promise<void> => {
    const path = join(REFERENCE_DIR, filename);
    const json = JSON.stringify(data, null, 2);
    await writeFile(path, json, "utf-8");
    const sizeMb = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
    console.log(`  ${filename}: ${sizeMb} MB`);
  };

  await writeJson("pokemon.json", pokemonEntries);
  await writeJson("moves.json", moveEntries);
  await writeJson("abilities.json", abilityEntries);
  await writeJson("items.json", itemEntries);
  await writeJson("type-chart.json", typeChart);
  await writeJson("champions-status.json", {
    source: championsOverride.source,
    fetchedAt: championsOverride.fetchedAt,
    status: championsOverride.status,
  });

  // Step 4: Generate indexes
  console.log("\n--- Generating indexes ---\n");

  const moveIndexes = generateMoveIndexes(moveEntries);
  const pokemonIndexes = generatePokemonIndexes(pokemonEntries);
  const itemIndexes = generateItemIndexes(itemEntries);
  const abilityIndexes = generateAbilityIndexes(abilityEntries);

  const allIndexes = { ...moveIndexes, ...pokemonIndexes, ...itemIndexes, ...abilityIndexes };
  let indexCount = 0;
  for (const [name, data] of Object.entries(allIndexes)) {
    const path = join(INDEXES_DIR, `${name}.json`);
    const json = JSON.stringify(data, null, 2);
    await writeFile(path, json, "utf-8");
    indexCount++;
  }
  console.log(`  Generated ${indexCount} index files`);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`  Pokemon: ${pokemonEntries.length} species + ${pokemonEntries.reduce((s, e) => s + e.forms.length, 0)} forms`);
  console.log(`  Moves: ${moveEntries.length}`);
  console.log(`  Abilities: ${abilityEntries.length}`);
  console.log(`  Items: ${itemEntries.length}`);
  console.log(`  Type chart: ${typeChart.types.length} types`);
  console.log(`  Indexes: ${indexCount} files`);
}

// Ne lance main() que quand le fichier est exécuté directement (via tsx build-reference.ts),
// pas quand il est importé par un test ou un autre module.
if (process.argv[1]?.endsWith("build-reference.ts")) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
