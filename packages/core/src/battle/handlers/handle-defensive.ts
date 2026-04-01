import { BattleEventType } from "../../enums/battle-event-type";
import { DefensiveKind } from "../../enums/defensive-kind";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

export function handleDefensive(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Defensive }>;
  const attacker = context.attacker;

  if (effect.defenseKind === DefensiveKind.Endure) {
    if (attacker.lastEndureRound === context.state.roundNumber - 1) {
      return [];
    }
    attacker.lastEndureRound = context.state.roundNumber;
  }

  attacker.activeDefense = {
    kind: effect.defenseKind,
    roundApplied: context.state.roundNumber,
    turnIndexApplied: context.state.currentTurnIndex,
  };

  const activatedEvent: BattleEvent = {
    type: BattleEventType.DefenseActivated,
    pokemonId: attacker.id,
    defenseKind: effect.defenseKind,
  };

  return [activatedEvent];
}
