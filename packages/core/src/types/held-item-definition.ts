import type { TerrainType } from "../enums/terrain-type";
import type { DamageModifyContext } from "./ability-definition";
import type { BattleEvent } from "./battle-event";
import type { BattleState } from "./battle-state";
import type { MoveDefinition } from "./move-definition";
import type { PokemonInstance } from "./pokemon-instance";

export interface ItemReactionResult {
  events: BattleEvent[];
  consumeItem: boolean;
}

export interface ItemBlockResult {
  blocked: boolean;
  events: BattleEvent[];
}

export interface CritStageContext {
  self: PokemonInstance;
  move: MoveDefinition;
}

export interface AfterMoveDamageDealtContext {
  attacker: PokemonInstance;
  damageDealt: number;
}

export interface AfterItemDamageContext {
  target: PokemonInstance;
  attacker: PokemonInstance;
  move: MoveDefinition;
  damageDealt: number;
  wasAtMaxHp: boolean;
  isSuperEffective: boolean;
  isContact: boolean;
}

export interface ItemEndTurnContext {
  pokemon: PokemonInstance;
  state: BattleState;
}

export interface ItemTerrainContext {
  pokemon: PokemonInstance;
  terrain: TerrainType;
}

export interface ItemCtGainContext {
  pokemon: PokemonInstance;
}

export interface HeldItemHandler {
  id: string;
  onDamageModify?: (context: DamageModifyContext) => number;
  onCritStageBoost?: (context: CritStageContext) => number;
  onAfterMoveDamageDealt?: (context: AfterMoveDamageDealtContext) => BattleEvent[];
  onAfterDamageReceived?: (context: AfterItemDamageContext) => ItemReactionResult;
  onEndTurn?: (context: ItemEndTurnContext) => BattleEvent[];
  onTerrainTick?: (context: ItemTerrainContext) => ItemBlockResult;
  onCtGainModify?: (context: ItemCtGainContext) => number;
  onMoveLock?: () => boolean;
}

export interface HeldItemDefinition extends HeldItemHandler {
  name: { fr: string; en: string };
  shortDescription: { fr: string; en: string };
}
