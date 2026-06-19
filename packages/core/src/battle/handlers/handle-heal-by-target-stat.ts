import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { StatName } from "../../enums/stat-name";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { EffectContext } from "../effect-handler-registry";
import { isHealBlocked } from "../heal-block-system";
import { getEffectiveStat } from "../stat-modifier";

const BASE_STAT_KEYS = new Set<string>([
  StatName.Hp,
  StatName.Attack,
  StatName.Defense,
  StatName.SpAttack,
  StatName.SpDefense,
  StatName.Speed,
]);

function effectiveStatValue(pokemon: PokemonInstance, stat: StatName): number {
  if (!BASE_STAT_KEYS.has(stat)) {
    return 0;
  }
  const base = pokemon.combatStats[stat as keyof typeof pokemon.combatStats];
  const stage = pokemon.statStages[stat] ?? 0;
  return getEffectiveStat(base, stage);
}

/**
 * Heals the caster by the target's effective stat value (stat stages included) — strength-sap
 * heals by the target's Attack. The accompanying Attack-drop is a separate StatChange effect.
 */
export function handleHealByTargetStat(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.HealByTargetStat }>;
  const target = context.targets[0];
  if (!target) {
    return [];
  }
  const caster = context.attacker;
  // Anti-Soin (Heal Block): the caster gets no heal (the separate Attack-drop still applies).
  if (isHealBlocked(caster)) {
    return [{ type: BattleEventType.HealPrevented, pokemonId: caster.id }];
  }
  const healed = Math.min(caster.maxHp - caster.currentHp, effectiveStatValue(target, effect.stat));
  if (healed <= 0) {
    return [];
  }
  caster.currentHp += healed;
  return [{ type: BattleEventType.HpRestored, pokemonId: caster.id, amount: healed }];
}
