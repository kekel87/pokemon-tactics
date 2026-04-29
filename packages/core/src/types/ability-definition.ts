import type { PokemonType } from "../enums/pokemon-type";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";
import type { BattleEvent } from "./battle-event";
import type { BattleState } from "./battle-state";
import type { MoveDefinition } from "./move-definition";
import type { PokemonInstance } from "./pokemon-instance";

export interface DamageModifyContext {
  self: PokemonInstance;
  opponent: PokemonInstance;
  move: MoveDefinition;
  isAttacker: boolean;
  attackerTypes: PokemonType[];
  defenderTypes: PokemonType[];
}

export interface AfterDamageContext {
  self: PokemonInstance;
  attacker: PokemonInstance;
  move: MoveDefinition;
  damageDealt: number;
  wasAtMaxHp: boolean;
  state: BattleState;
  selfTypes: PokemonType[];
  attackerTypes: PokemonType[];
  random: () => number;
}

export interface AfterStatusContext {
  self: PokemonInstance;
  source: PokemonInstance | null;
  status: StatusType;
  state: BattleState;
  selfTypes: PokemonType[];
  sourceTypes: PokemonType[];
  random: () => number;
}

export interface StatusBlockContext {
  self: PokemonInstance;
  status: StatusType;
  source: PokemonInstance | null;
}

export interface StatusDurationContext {
  self: PokemonInstance;
  status: StatusType;
  duration: number;
}

export interface StatChangeBlockContext {
  self: PokemonInstance;
  stat: StatName;
  stages: number;
  source: PokemonInstance | null;
}

export interface TypeImmunityContext {
  self: PokemonInstance;
  moveType: PokemonType;
}

export interface BattleStartContext {
  self: PokemonInstance;
  state: BattleState;
  pokemonTypesMap: Map<string, PokemonType[]>;
}

export interface AuraCheckContext {
  self: PokemonInstance;
  state: BattleState;
  pokemonTypesMap: Map<string, PokemonType[]>;
}

export interface BlockResult {
  blocked: boolean;
  events: BattleEvent[];
}

export interface DurationModifyResult {
  duration: number;
  events: BattleEvent[];
}

export interface AbilityHandler {
  id: string;
  onDamageModify?: (context: DamageModifyContext) => number;
  onAfterDamageReceived?: (context: AfterDamageContext) => BattleEvent[];
  onAfterStatusReceived?: (context: AfterStatusContext) => BattleEvent[];
  onStatusBlocked?: (context: StatusBlockContext) => BlockResult;
  onStatusDurationModify?: (context: StatusDurationContext) => DurationModifyResult;
  onStatChangeBlocked?: (context: StatChangeBlockContext) => BlockResult;
  onTypeImmunity?: (context: TypeImmunityContext) => BlockResult;
  onBattleStart?: (context: BattleStartContext) => BattleEvent[];
  onAuraCheck?: (context: AuraCheckContext) => BattleEvent[];
}

export interface AbilityDefinition extends AbilityHandler {
  name: { fr: string; en: string };
  shortDescription: { fr: string; en: string };
}
