import { EffectKind } from "../enums/effect-kind";
import type { PokemonType } from "../enums/pokemon-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { getTypeEffectiveness } from "./damage-calculator";
import type { EffectContext, TypeChart } from "./effect-handler-registry";
import { EffectHandlerRegistry } from "./effect-handler-registry";
import { handleDamage } from "./handlers/handle-damage";
import { handleDefensive } from "./handlers/handle-defensive";
import { handleLink } from "./handlers/handle-link";
import { handleStatChange } from "./handlers/handle-stat-change";
import { handleStatus } from "./handlers/handle-status";

interface ProcessContext {
  attacker: PokemonInstance;
  targets: PokemonInstance[];
  move: MoveDefinition;
  state: BattleState;
  typeChart: TypeChart;
  attackerTypes: PokemonType[];
  targetTypesMap: Map<string, PokemonType[]>;
  targetPosition: Position;
}

export function createDefaultEffectRegistry(): EffectHandlerRegistry {
  const registry = new EffectHandlerRegistry();
  registry.register(EffectKind.Damage, handleDamage);
  registry.register(EffectKind.Status, handleStatus);
  registry.register(EffectKind.StatChange, handleStatChange);
  registry.register(EffectKind.Link, handleLink);
  registry.register(EffectKind.Defensive, handleDefensive);
  return registry;
}

export function processEffects(
  context: ProcessContext,
  registry?: EffectHandlerRegistry,
): BattleEvent[] {
  const effectRegistry = registry ?? createDefaultEffectRegistry();
  const events: BattleEvent[] = [];

  const nonImmuneTargets = context.targets.filter((target) => {
    const defenderTypes = context.targetTypesMap.get(target.id) ?? [];
    const effectiveness = getTypeEffectiveness(context.move.type, defenderTypes, context.typeChart);
    return effectiveness !== 0;
  });

  for (const effect of context.move.effects) {
    const effectContext: EffectContext = {
      ...context,
      targets: nonImmuneTargets,
      effect,
    };
    events.push(...effectRegistry.process(effectContext));
  }

  return events;
}
