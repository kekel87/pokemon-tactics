/**
 * fetch-champions.ts — Fetch + parse de l'override Pokemon Champions depuis Showdown.
 *
 * Source : https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions
 *
 * Format Showdown : chaque entrée `moveId: { inherit: true, ...overrides }`.
 * On parse les champs data (basePower, pp, accuracy…) et on ignore les overrides
 * de logique (onHit, onTry, onDamage…) car on ne peut pas transférer la logique
 * TypeScript Showdown dans notre moteur.
 *
 * Pour les statuts (conditions.ts), on utilise une transcription manuelle dans
 * CHAMPIONS_STATUS_MANUAL — changement rare, ~10 lignes à maintenir.
 */

import type {
  AbilityOverride,
  ChampionsOverride,
  ItemOverride,
  LearnsetOverride,
  MoveOverride,
  PokemonOverride,
  SecondaryOverride,
  StatusOverrides,
} from "./champions-override.types";
import { cachedFetchText } from "./fetch-utils";

const CHAMPIONS_BASE =
  "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions";

/**
 * Statuts Champions — transcription manuelle depuis conditions.ts.
 *
 * Source : https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/conditions.ts
 * Dernière MAJ : 2026-04-15
 *
 * À mettre à jour manuellement lors d'un patch Champions qui touche par/slp/frz.
 */
export const CHAMPIONS_STATUS_MANUAL: StatusOverrides = {
  paralysis: {
    // conditions.ts `par`: `randomChance(1, 8)` → 12.5% de skip
    skipRate: 1 / 8,
    speedMult: 0.5,
  },
  freeze: {
    // conditions.ts `frz`: `randomChance(1, 4)` + `startTime = 3` → 25% thaw, max 3 tours
    thawRate: 1 / 4,
    maxTurns: 3,
  },
  sleep: {
    // conditions.ts `slp`: `sample([2, 3, 3])` → 1/3 chance de 2 tours, 2/3 chance de 3 tours
    minTurns: 2,
    maxTurns: 3,
    sampleTurns: [2, 3, 3],
  },
};

export async function fetchChampionsData(): Promise<ChampionsOverride> {
  const [movesTs, abilitiesTs, itemsTs, learnsetsTs, formatsDataTs, conditionsTs] =
    await Promise.all([
      cachedFetchText(`${CHAMPIONS_BASE}/moves.ts`, "champions/moves.ts"),
      cachedFetchText(`${CHAMPIONS_BASE}/abilities.ts`, "champions/abilities.ts"),
      cachedFetchText(`${CHAMPIONS_BASE}/items.ts`, "champions/items.ts"),
      cachedFetchText(`${CHAMPIONS_BASE}/learnsets.ts`, "champions/learnsets.ts"),
      // formats-data.ts et conditions.ts fetchés pour traçabilité du cache,
      // mais non parsés (décision : tiers ignorés, statuts transcrits manuellement)
      cachedFetchText(`${CHAMPIONS_BASE}/formats-data.ts`, "champions/formats-data.ts"),
      cachedFetchText(`${CHAMPIONS_BASE}/conditions.ts`, "champions/conditions.ts"),
    ]);

  // Réduire le warning TS "variable jamais lue" — on garde le fetch pour le cache
  void formatsDataTs;
  void conditionsTs;

  return {
    version: "showdown-champions",
    fetchedAt: new Date().toISOString(),
    source: CHAMPIONS_BASE,
    moves: parseChampionsMoves(movesTs),
    pokemon: {}, // Champions n'override pas les stats des espèces aujourd'hui
    abilities: parseChampionsAbilities(abilitiesTs),
    items: parseChampionsItems(itemsTs),
    learnsets: parseChampionsLearnsets(learnsetsTs),
    status: CHAMPIONS_STATUS_MANUAL,
  };
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

/**
 * Extrait les blocs `entryId: { ... }` d'un fichier Showdown mod.
 *
 * Retourne un Map<id, string> où string est le contenu brut du bloc
 * (entre accolades, accolades non incluses).
 *
 * Gère la profondeur d'accolades pour ne pas couper au premier `}` imbriqué
 * (ex: `secondary: { chance: 10, boosts: { atk: -1 } }`).
 */
function extractEntries(tsSource: string): Map<string, string> {
  const result = new Map<string, string>();

  // Repère les entrées au niveau supérieur du fichier (indentées par un seul tab).
  // Exemple : "\tabsorb: {"
  const entryHeaderRegex = /^\t([a-z][a-z0-9]*):\s*\{/gm;

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
  while ((match = entryHeaderRegex.exec(tsSource)) !== null) {
    const id = match[1];
    const bodyStart = match.index + match[0].length;

    // Scan jusqu'à l'accolade fermante correspondante
    let depth = 1;
    let pos = bodyStart;
    while (pos < tsSource.length && depth > 0) {
      const ch = tsSource[pos];
      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
      }
      pos++;
    }

    if (depth === 0 && id !== undefined) {
      const body = tsSource.slice(bodyStart, pos - 1);
      result.set(id, body);
    }
  }

  return result;
}

/**
 * Lit une valeur simple (nombre, string, booléen) depuis un bloc d'entrée Showdown.
 * Retourne undefined si le champ n'existe pas.
 */
function readSimpleField(body: string, field: string): string | undefined {
  // Pattern : `\tfieldName: <value>,` — tolère espaces, tabs, pas de virgule finale
  const regex = new RegExp(`^\\s*${field}:\\s*([^,\\n]+?)\\s*,?\\s*$`, "m");
  const match = regex.exec(body);
  return match?.[1];
}

function readNumberField(body: string, field: string): number | undefined {
  const raw = readSimpleField(body, field);
  if (raw === undefined) {
    return undefined;
  }
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

function readStringField(body: string, field: string): string | undefined {
  const raw = readSimpleField(body, field);
  if (raw === undefined) {
    return undefined;
  }
  // Enlève les quotes
  return raw.replace(/^["']|["']$/g, "");
}

function readNonstandard(body: string): "Past" | null | undefined {
  const raw = readSimpleField(body, "isNonstandard");
  if (raw === undefined) {
    return undefined;
  }
  if (raw === "null") {
    return null;
  }
  const stripped = raw.replace(/^["']|["']$/g, "");
  if (stripped === "Past") {
    return "Past";
  }
  return undefined;
}

// ─── Moves ───────────────────────────────────────────────────────────────────

function parseChampionsMoves(tsSource: string): Record<string, MoveOverride> {
  const result: Record<string, MoveOverride> = {};
  const entries = extractEntries(tsSource);

  for (const [id, body] of entries) {
    const override: MoveOverride = {};

    const basePower = readNumberField(body, "basePower");
    if (basePower !== undefined) {
      override.basePower = basePower;
    }

    const pp = readNumberField(body, "pp");
    if (pp !== undefined) {
      override.pp = pp;
    }

    const accuracy = readNumberField(body, "accuracy");
    if (accuracy !== undefined) {
      override.accuracy = accuracy;
    }

    const type = readStringField(body, "type");
    if (type !== undefined) {
      override.type = type;
    }

    const category = readStringField(body, "category");
    if (category === "Physical" || category === "Special" || category === "Status") {
      override.category = category;
    }

    const priority = readNumberField(body, "priority");
    if (priority !== undefined) {
      override.priority = priority;
    }

    const nonstandard = readNonstandard(body);
    if (nonstandard !== undefined) {
      override.isNonstandard = nonstandard;
    }

    const shortDesc = readStringField(body, "shortDesc");
    if (shortDesc !== undefined) {
      override.shortDesc = shortDesc;
    }

    const secondary = parseSecondary(body);
    if (secondary !== undefined) {
      override.secondary = secondary;
    }

    // N'inclut l'entrée que si au moins un champ data a été trouvé
    if (Object.keys(override).length > 0) {
      result[id] = override;
    }
  }

  return result;
}

/**
 * Parse le champ `secondary` d'un move.
 * - `secondary: undefined` ou `secondary: null` → null (effet retiré)
 * - `secondary: { chance, status, volatileStatus, boosts, onHit }` → SecondaryOverride sans onHit
 * - absent → undefined
 */
function parseSecondary(body: string): SecondaryOverride | null | undefined {
  // Cas `secondary: undefined,` ou `secondary: null,`
  const simple = readSimpleField(body, "secondary");
  if (simple === "undefined" || simple === "null") {
    return null;
  }

  // Cas bloc : on cherche `secondary: { ... }`
  const blockRegex = /^\s*secondary:\s*\{/m;
  const match = blockRegex.exec(body);
  if (match === null) {
    return undefined;
  }

  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let pos = bodyStart;
  while (pos < body.length && depth > 0) {
    const ch = body[pos];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
    pos++;
  }
  if (depth !== 0) {
    return undefined;
  }

  const secondaryBody = body.slice(bodyStart, pos - 1);

  const chance = readNumberField(secondaryBody, "chance");
  if (chance === undefined) {
    return undefined;
  }

  const override: SecondaryOverride = { chance };

  const status = readStringField(secondaryBody, "status");
  if (status !== undefined) {
    override.status = status;
  }

  const volatileStatus = readStringField(secondaryBody, "volatileStatus");
  if (volatileStatus !== undefined) {
    override.volatileStatus = volatileStatus;
  }

  const boosts = parseBoosts(secondaryBody);
  if (boosts !== undefined) {
    override.boosts = boosts;
  }

  return override;
}

function parseBoosts(body: string): SecondaryOverride["boosts"] | undefined {
  const blockRegex = /^\s*boosts:\s*\{([^}]*)\}/m;
  const match = blockRegex.exec(body);
  if (match?.[1] === undefined) {
    return undefined;
  }

  const boostsBody = match[1];
  const boosts: Record<string, number> = {};
  const boostRegex = /(atk|def|spa|spd|spe|accuracy|evasion):\s*(-?\d+)/g;

  let boostMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
  while ((boostMatch = boostRegex.exec(boostsBody)) !== null) {
    const stat = boostMatch[1];
    const valueRaw = boostMatch[2];
    if (stat !== undefined && valueRaw !== undefined) {
      boosts[stat] = Number(valueRaw);
    }
  }

  return Object.keys(boosts).length > 0 ? (boosts as SecondaryOverride["boosts"]) : undefined;
}

// ─── Abilities ───────────────────────────────────────────────────────────────

function parseChampionsAbilities(tsSource: string): Record<string, AbilityOverride> {
  const result: Record<string, AbilityOverride> = {};
  const entries = extractEntries(tsSource);

  for (const [id, body] of entries) {
    const override: AbilityOverride = {};

    const shortDesc = readStringField(body, "shortDesc");
    if (shortDesc !== undefined) {
      override.shortDesc = shortDesc;
    }

    const desc = readStringField(body, "desc");
    if (desc !== undefined) {
      override.desc = desc;
    }

    const nonstandard = readNonstandard(body);
    if (nonstandard !== undefined) {
      override.isNonstandard = nonstandard;
    }

    if (Object.keys(override).length > 0) {
      result[id] = override;
    }
  }

  return result;
}

// ─── Items ───────────────────────────────────────────────────────────────────

function parseChampionsItems(tsSource: string): Record<string, ItemOverride> {
  // Même logique que les abilities : shortDesc/desc/isNonstandard
  const result: Record<string, ItemOverride> = {};
  const entries = extractEntries(tsSource);

  for (const [id, body] of entries) {
    const override: ItemOverride = {};

    const shortDesc = readStringField(body, "shortDesc");
    if (shortDesc !== undefined) {
      override.shortDesc = shortDesc;
    }

    const desc = readStringField(body, "desc");
    if (desc !== undefined) {
      override.desc = desc;
    }

    const nonstandard = readNonstandard(body);
    if (nonstandard !== undefined) {
      override.isNonstandard = nonstandard;
    }

    if (Object.keys(override).length > 0) {
      result[id] = override;
    }
  }

  return result;
}

// ─── Pokemon (stats) ────────────────────────────────────────────────────────

// Non utilisé aujourd'hui : Champions n'override pas les stats.
// Fonction prête pour le jour où ça change. À activer dans fetchChampionsData()
// en renvoyant `parseChampionsPokemon(pokedexTs)` au lieu de `{}`.
export function parseChampionsPokemon(_tsSource: string): Record<string, PokemonOverride> {
  return {};
}

// ─── Learnsets ───────────────────────────────────────────────────────────────

/**
 * Parse le fichier learnsets.ts Champions.
 *
 * Format : `{ pokemonId: { learnset: { moveId: ["9M"], ... } } }`
 * Le bloc `learnset` est la seule donnée qui nous intéresse ici.
 */
function parseChampionsLearnsets(tsSource: string): Record<string, LearnsetOverride> {
  const result: Record<string, LearnsetOverride> = {};
  const entries = extractEntries(tsSource);

  for (const [id, body] of entries) {
    const learnset = parseLearnsetBlock(body);
    if (learnset !== undefined) {
      result[id] = { learnset };
    }
  }

  return result;
}

function parseLearnsetBlock(body: string): Record<string, string[]> | undefined {
  const blockRegex = /^\s*learnset:\s*\{/m;
  const match = blockRegex.exec(body);
  if (match === null) {
    return undefined;
  }

  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let pos = bodyStart;
  while (pos < body.length && depth > 0) {
    const ch = body[pos];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
    pos++;
  }
  if (depth !== 0) {
    return undefined;
  }

  const learnsetBody = body.slice(bodyStart, pos - 1);
  const result: Record<string, string[]> = {};

  // moveId: ["9M", "9L15", "9T"]
  const entryRegex = /([a-z][a-z0-9]*):\s*\[([^\]]*)\]/g;
  let entryMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
  while ((entryMatch = entryRegex.exec(learnsetBody)) !== null) {
    const moveId = entryMatch[1];
    const codesRaw = entryMatch[2];
    if (moveId === undefined || codesRaw === undefined) {
      continue;
    }

    const codes = codesRaw
      .split(",")
      .map((c) => c.trim().replace(/^["']|["']$/g, ""))
      .filter((c) => c.length > 0);

    if (codes.length > 0) {
      result[moveId] = codes;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
