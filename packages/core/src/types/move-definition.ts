import type { Category } from "../enums/category";
import type { EffectTier } from "../enums/effect-tier";
import type { PokemonType } from "../enums/pokemon-type";
import type { Effect } from "./effect";
import type { MoveFlags } from "./move-flags";
import type { TargetingPattern } from "./targeting-pattern";

export interface MoveDefinition {
  id: string;
  name: string;
  type: PokemonType;
  category: Category;
  power: number;
  accuracy: number;
  pp: number;
  targeting: TargetingPattern;
  effects: Effect[];
  recharge?: boolean;
  ignoresHeight?: boolean;
  flags?: MoveFlags;
  effectTier?: EffectTier;
}
