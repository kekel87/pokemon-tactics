export interface ReferencePokemon {
  dexNumber: number;
  id: string;
  names: { en: string; fr: string };
  types: string[];
  height: number;
  weight: number;
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
}

export interface ReferenceMove {
  id: string;
  names: { en: string; fr: string };
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
  names: { en: string; fr: string };
  shortDescription: { en: string; fr: string };
  longDescription: { en: string; fr: string };
  flags: {
    breakable: boolean;
    ignorable: boolean;
    unsuppressable: boolean;
  };
}
