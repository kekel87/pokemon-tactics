import type { Category } from "../enums/category";
import type { PokemonType } from "../enums/pokemon-type";
import type { Effect } from "./effect";
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
}
