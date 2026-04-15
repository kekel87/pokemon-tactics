/**
 * Types pour l'override Pokemon Champions appliqué par-dessus la base Showdown Gen 9.
 *
 * Source : https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions
 * Format : `inherit: true` + champs modifiés — on mirrore cette structure.
 *
 * Les noms de champs suivent la convention Showdown (basePower, pp, accuracy…) pour
 * rester 1:1 avec la source. Le mapping vers notre schéma interne (power, pp…) est
 * fait dans les fonctions applyChampions*Override de build-reference.ts.
 *
 * Les champs sont optionnels partout : l'override ne liste que ce qui change.
 */

export interface ChampionsOverride {
  version: string;
  fetchedAt: string;
  source: string;
  moves: Record<string, MoveOverride>;
  pokemon: Record<string, PokemonOverride>;
  abilities: Record<string, AbilityOverride>;
  items: Record<string, ItemOverride>;
  learnsets: Record<string, LearnsetOverride>;
  status: StatusOverrides;
}

/**
 * Override d'un move. Champs Showdown-natifs.
 *
 * `maxPp` n'est PAS listé : dérivé de `pp` par applyChampionsMovesOverride
 * (maxPp = floor(pp * 1.6)).
 *
 * Les overrides de logique (onHit, onTry, onDamage…) sont filtrés au parsing
 * — on ne transfère que la data.
 */
export interface MoveOverride {
  basePower?: number;
  pp?: number;
  accuracy?: number | true;
  type?: string;
  category?: "Physical" | "Special" | "Status";
  priority?: number;
  target?: string;
  flags?: Record<string, 0 | 1>;
  secondary?: SecondaryOverride | null;
  /** "Past" = retiré de Champions, null = explicitement re-enabled */
  isNonstandard?: "Past" | null;
  shortDesc?: string;
  desc?: string;
}

/**
 * Effet secondaire. On conserve la data (chance, status, boosts), on ignore `onHit`.
 */
export interface SecondaryOverride {
  chance: number;
  status?: string;
  volatileStatus?: string;
  boosts?: Partial<Record<"atk" | "def" | "spa" | "spd" | "spe" | "accuracy" | "evasion", number>>;
}

export interface PokemonOverride {
  baseStats?: Partial<Record<"hp" | "atk" | "def" | "spa" | "spd" | "spe", number>>;
  types?: string[];
  abilities?: Record<string, string>;
  isNonstandard?: "Past" | null;
}

export interface AbilityOverride {
  shortDesc?: string;
  desc?: string;
  isNonstandard?: "Past" | null;
}

export interface ItemOverride {
  shortDesc?: string;
  desc?: string;
  isNonstandard?: "Past" | null;
}

/**
 * Learnset Champions — remplace entièrement celui de Showdown pour ce Pokemon.
 * Les codes ("9M", "9L15", "9T") encodent la source : M = TM, L = level-up, T = tutor.
 */
export interface LearnsetOverride {
  learnset: Record<string, string[]>;
}

/**
 * Règles de mécaniques Champions — transcrites à la main depuis
 * data/mods/champions/conditions.ts. À mettre à jour lors des patches majeurs.
 *
 * Consommé par le plan 057 (runtime) pour aligner le comportement du core.
 */
export interface StatusOverrides {
  paralysis?: {
    /** Probabilité qu'un Pokemon paralysé skip son action (Champions : 1/8 = 0.125) */
    skipRate?: number;
    /** Multiplicateur de vitesse (Champions : 0.5, inchangé) */
    speedMult?: number;
  };
  freeze?: {
    /** Probabilité de dégeler chaque tour (Champions : 1/4 = 0.25) */
    thawRate?: number;
    /** Durée max garantie avant dégel forcé (Champions : 3) */
    maxTurns?: number;
  };
  sleep?: {
    /** Minimum de tours de sommeil (Champions : 2) */
    minTurns?: number;
    /** Maximum de tours de sommeil (Champions : 3) */
    maxTurns?: number;
    /**
     * Distribution exacte du sample Showdown.
     * Champions utilise `sample([2, 3, 3])` → 1/3 de 2 tours, 2/3 de 3 tours.
     * Cette liste est la source de vérité ; minTurns/maxTurns sont dérivés pour info.
     */
    sampleTurns?: number[];
  };
  // burn / poison / badly-poisoned : inchangés en Champions, pas d'entry
}
