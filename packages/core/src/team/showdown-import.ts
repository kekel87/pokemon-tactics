import type { HeldItemId } from "../enums/held-item-id";
import { Nature } from "../enums/nature";
import { PokemonGender } from "../enums/pokemon-gender";
import type { BaseStats } from "../types/base-stats";
import { type EvSpread, evToSp } from "./sp-ev-conversion";
import type { TeamSet } from "./team-set";
import type { TeamSlot } from "./team-slot";

export interface ShowdownImportRegistry {
  pokemonByShowdownId: ReadonlyMap<string, string>;
  abilityByShowdownId: ReadonlyMap<string, string>;
  itemByShowdownId: ReadonlyMap<string, HeldItemId>;
  moveByShowdownId: ReadonlyMap<string, string>;
  natureByName: ReadonlyMap<string, Nature>;
}

export interface ShowdownImportWarning {
  slotIndex: number;
  kind:
    | "unknown-pokemon"
    | "unknown-move"
    | "unknown-ability"
    | "unknown-item"
    | "unknown-nature"
    | "ev-total-exceeded"
    | "ev-stat-exceeded"
    | "unknown-line";
  detail: string;
}

export interface ShowdownImportResult {
  team: TeamSet | null;
  warnings: ShowdownImportWarning[];
}

const STAT_KEY_BY_LABEL: Record<string, keyof BaseStats> = {
  hp: "hp",
  atk: "attack",
  def: "defense",
  spa: "spAttack",
  spd: "spDefense",
  spe: "speed",
};

const IGNORED_PREFIXES = [
  "iv:",
  "ivs:",
  "tera type:",
  "happiness:",
  "shiny:",
  "pokeball:",
  "dynamax level:",
  "gigantamax:",
];

function toCompressed(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function parseSpeciesLine(line: string): {
  speciesRaw: string;
  gender?: PokemonGender;
  itemRaw?: string;
} {
  let working = line.trim();
  let itemRaw: string | undefined;
  const atIndex = working.indexOf(" @ ");
  if (atIndex !== -1) {
    itemRaw = working.slice(atIndex + 3).trim();
    working = working.slice(0, atIndex).trim();
  }

  let gender: PokemonGender | undefined;
  const genderMatch = working.match(/\s*\((M|F)\)\s*$/i);
  if (genderMatch !== null) {
    const letter = genderMatch[1] ?? "";
    gender = letter.toUpperCase() === "M" ? PokemonGender.Male : PokemonGender.Female;
    working = working.slice(0, genderMatch.index).trim();
  }

  let speciesRaw = working;
  const parenMatch = working.match(/^(.+?)\s+\((.+?)\)$/);
  if (parenMatch !== null) {
    speciesRaw = (parenMatch[2] ?? "").trim();
  }

  return { speciesRaw, gender, itemRaw };
}

function parseEvs(line: string): EvSpread {
  const result: EvSpread = {};
  const parts = line.slice("EVs:".length).split("/");
  for (const part of parts) {
    const match = part.trim().match(/^(\d+)\s+([A-Za-z]+)$/);
    if (!match) {
      continue;
    }
    const value = Number.parseInt(match[1] ?? "0", 10);
    const key = STAT_KEY_BY_LABEL[(match[2] ?? "").toLowerCase()];
    if (key !== undefined && value > 0) {
      result[key] = value;
    }
  }
  return result;
}

function parseSlot(
  block: string,
  slotIndex: number,
  registry: ShowdownImportRegistry,
  warnings: ShowdownImportWarning[],
): TeamSlot | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));
  if (lines.length === 0) {
    return null;
  }

  const { speciesRaw, gender, itemRaw } = parseSpeciesLine(lines[0] ?? "");
  const speciesId = registry.pokemonByShowdownId.get(toCompressed(speciesRaw));
  if (speciesId === undefined) {
    warnings.push({
      slotIndex,
      kind: "unknown-pokemon",
      detail: `Unknown species: "${speciesRaw}"`,
    });
    return null;
  }

  let ability: string | undefined;
  let heldItemId: HeldItemId | undefined;
  let nature: Nature | undefined;
  let evSpread: EvSpread = {};
  const moveIds: string[] = [];

  if (itemRaw !== undefined) {
    const itemId = registry.itemByShowdownId.get(toCompressed(itemRaw));
    if (itemId === undefined) {
      warnings.push({
        slotIndex,
        kind: "unknown-item",
        detail: `Unknown item: "${itemRaw}"`,
      });
    } else {
      heldItemId = itemId;
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lower = line.toLowerCase();

    if (lower.startsWith("ability:")) {
      const raw = line.slice(line.indexOf(":") + 1).trim();
      const abilityId = registry.abilityByShowdownId.get(toCompressed(raw));
      if (abilityId === undefined) {
        warnings.push({
          slotIndex,
          kind: "unknown-ability",
          detail: `Unknown ability: "${raw}"`,
        });
      } else {
        ability = abilityId;
      }
      continue;
    }

    if (lower.startsWith("level:")) {
      continue;
    }

    if (lower.startsWith("evs:")) {
      evSpread = parseEvs(line);
      continue;
    }

    if (IGNORED_PREFIXES.some((p) => lower.startsWith(p))) {
      continue;
    }

    if (lower.endsWith(" nature")) {
      const raw = line.slice(0, -" Nature".length).trim();
      const natureValue = registry.natureByName.get(raw);
      if (natureValue === undefined) {
        warnings.push({
          slotIndex,
          kind: "unknown-nature",
          detail: `Unknown nature: "${raw}"`,
        });
      } else {
        nature = natureValue;
      }
      continue;
    }

    if (line.startsWith("-")) {
      const moveRaw = line.slice(1).trim();
      const moveId = registry.moveByShowdownId.get(toCompressed(moveRaw));
      if (moveId === undefined) {
        warnings.push({
          slotIndex,
          kind: "unknown-move",
          detail: `Unknown move: "${moveRaw}"`,
        });
      } else {
        moveIds.push(moveId);
      }
      continue;
    }

    warnings.push({
      slotIndex,
      kind: "unknown-line",
      detail: `Ignored line: "${line}"`,
    });
  }

  let evTotal = 0;
  let overStat: string | undefined;
  for (const [key, value] of Object.entries(evSpread)) {
    const v = value ?? 0;
    if (v > 252 && overStat === undefined) {
      overStat = key;
    }
    evTotal += v;
  }
  if (overStat !== undefined) {
    warnings.push({
      slotIndex,
      kind: "ev-stat-exceeded",
      detail: `EV ${overStat} > 252 (clamped)`,
    });
  }
  if (evTotal > 510) {
    warnings.push({
      slotIndex,
      kind: "ev-total-exceeded",
      detail: `EV total ${evTotal} > 510 (clamped)`,
    });
  }

  return {
    pokemonId: speciesId,
    ability: ability ?? "",
    heldItemId,
    nature: nature ?? Nature.Hardy,
    moveIds,
    statSpread: evToSp(evSpread),
    gender,
  };
}

export function importShowdownTeam(
  text: string,
  registry: ShowdownImportRegistry,
  teamName = "Imported",
): ShowdownImportResult {
  const warnings: ShowdownImportWarning[] = [];
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  const slots: TeamSlot[] = [];
  for (const [index, block] of blocks.entries()) {
    const slot = parseSlot(block, index, registry, warnings);
    if (slot !== null) {
      slots.push(slot);
    }
  }
  if (slots.length === 0) {
    return { team: null, warnings };
  }
  const now = Date.now();
  return {
    team: {
      id: `imported-${now}`,
      name: teamName,
      slots,
      createdAt: now,
      updatedAt: now,
    },
    warnings,
  };
}
