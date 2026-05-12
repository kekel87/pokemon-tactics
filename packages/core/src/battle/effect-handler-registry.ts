import type { EffectKind } from "../enums/effect-kind";
import type { PokemonType } from "../enums/pokemon-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { Effect } from "../types/effect";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { StatusRules } from "../types/status-rules";
import type { TypeChart } from "../types/type-chart";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";

export type { TypeChart };

export interface SharedEffectState {
  lastDamageDealt: number;
  loweredPokemonIds?: Set<string>;
}

export interface EffectContext {
  attacker: PokemonInstance;
  targets: PokemonInstance[];
  move: MoveDefinition;
  effect: Effect;
  state: BattleState;
  typeChart: TypeChart;
  attackerTypes: PokemonType[];
  targetTypesMap: Map<string, PokemonType[]>;
  targetPosition: Position;
  random: RandomFn;
  heightModifier: number;
  terrainModifier: number;
  facingModifierMap: Map<string, number>;
  statusRules?: StatusRules;
  abilityRegistry?: AbilityHandlerRegistry;
  itemRegistry?: HeldItemHandlerRegistry;
  shared: SharedEffectState;
}

export type EffectHandler = (context: EffectContext) => BattleEvent[];

export class EffectHandlerRegistry {
  private readonly handlers = new Map<EffectKind, EffectHandler>();

  register(kind: EffectKind, handler: EffectHandler): void {
    this.handlers.set(kind, handler);
  }

  process(context: EffectContext): BattleEvent[] {
    const handler = this.handlers.get(context.effect.kind);
    if (!handler) {
      return [];
    }
    return handler(context);
  }

  has(kind: EffectKind): boolean {
    return this.handlers.has(kind);
  }
}
