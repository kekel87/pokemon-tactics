import { BattleEventType } from "../../enums/battle-event-type";
import { DefensiveKind } from "../../enums/defensive-kind";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

export function handleDefensive(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Defensive }>;
  const attacker = context.attacker;

  const actionCounter = context.state.actionCounter ?? 0;

  if (effect.defenseKind === DefensiveKind.Endure) {
    // Anti-spam: Endure can't succeed on the user's immediately consecutive turn. `lastActedAtAction`
    // holds this mon's previous-turn clock value (it is bumped at end of turn, so during the current
    // turn it still points at the prior one); if Endure was used then, those two stamps match.
    if (
      attacker.lastEndureAtAction !== null &&
      attacker.lastEndureAtAction === attacker.lastActedAtAction
    ) {
      return [];
    }
    attacker.lastEndureAtAction = actionCounter;
  }

  attacker.activeDefense = {
    kind: effect.defenseKind,
    appliedAtAction: actionCounter,
  };

  const activatedEvent: BattleEvent = {
    type: BattleEventType.DefenseActivated,
    pokemonId: attacker.id,
    defenseKind: effect.defenseKind,
  };

  return [activatedEvent];
}
