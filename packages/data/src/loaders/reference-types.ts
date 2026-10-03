import type { LocalizedText } from "@pokemon-tactic/core";
import type { ReferenceLocalizedText } from "../i18n/localized-text";

export interface ReferenceLearnsetEntry {
  level: number;
  move: string;
}

export interface ReferenceLearnset {
  levelUp: ReferenceLearnsetEntry[];
  tm: string[];
  tutor: string[];
}

export interface ReferenceAbilities {
  ability1: string | null;
  ability2: string | null;
  hidden: string | null;
}

export interface ReferencePokemon {
  dexNumber: number;
  id: string;
  generation: number;
  names: LocalizedText;
  types: string[];
  height: number;
  weight: number;
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  genderRatio: { male: number; female: number } | "genderless";
  abilities: ReferenceAbilities;
  learnset: ReferenceLearnset;
  evolvesFrom: string | null;
}

export interface ReferenceMove {
  id: string;
  names: LocalizedText;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  flags: Record<string, boolean>;
}

export interface ReferenceTypeChart {
  types: string[];
  effectiveness: Record<string, Record<string, number>>;
}

export interface ReferenceAbility {
  id: string;
  generation: number;
  names: LocalizedText;
  shortDescription: ReferenceLocalizedText;
  longDescription: ReferenceLocalizedText;
  flags: {
    breakable: boolean;
    ignorable: boolean;
    unsuppressable: boolean;
  };
}
