import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Requiem (perish-song): activates a mobile death aura on the caster. The aura is a Manhattan-`radius`
 * zone centred on the caster (it follows the caster — recomputed from its live position). After
 * `turns` of the caster's own turns it detonates: every living mon inside the zone faints, the caster
 * included (it always sits at the centre — a true sacrifice). Allies must flee; enemies can be herded
 * in. Re-casting refreshes the caster's aura.
 */
export function handlePerishSong(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostPerishSong }>;
  context.attacker.perishAura = { turnsRemaining: effect.turns, radius: effect.radius };
  return [
    {
      type: BattleEventType.PerishAuraPosted,
      casterId: context.attacker.id,
      radius: effect.radius,
      turns: effect.turns,
    },
  ];
}
