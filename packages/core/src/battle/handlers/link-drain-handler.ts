import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { manhattanDistance } from "../../utils/manhattan-distance";
import type { PhaseResult } from "../turn-pipeline";

export function linkDrainHandler(pokemonId: string, state: BattleState): PhaseResult {
  const events: BattleEvent[] = [];
  let pokemonFainted = false;
  const linksToRemove: number[] = [];

  for (let i = 0; i < state.activeLinks.length; i++) {
    const link = state.activeLinks[i];
    if (!link || link.targetId !== pokemonId) {
      continue;
    }

    const source = state.pokemon.get(link.sourceId);
    const target = state.pokemon.get(link.targetId);
    if (!source || !target) {
      continue;
    }

    if (source.currentHp <= 0) {
      linksToRemove.push(i);
      events.push({
        type: BattleEventType.LinkBroken,
        sourceId: link.sourceId,
        targetId: link.targetId,
      });
      continue;
    }

    const distance = manhattanDistance(source.position, target.position);
    if (distance > link.maxRange) {
      linksToRemove.push(i);
      events.push({
        type: BattleEventType.LinkBroken,
        sourceId: link.sourceId,
        targetId: link.targetId,
      });
      continue;
    }

    const drainAmount = Math.max(1, Math.floor(target.maxHp * link.drainFraction));
    target.currentHp = Math.max(0, target.currentHp - drainAmount);
    source.currentHp = Math.min(source.maxHp, source.currentHp + drainAmount);
    events.push({
      type: BattleEventType.LinkDrained,
      sourceId: link.sourceId,
      targetId: link.targetId,
      amount: drainAmount,
    });

    if (target.currentHp <= 0) {
      events.push({ type: BattleEventType.PokemonKo, pokemonId: target.id, countdownStart: 0 });
      pokemonFainted = true;
      break;
    }
  }

  for (let i = linksToRemove.length - 1; i >= 0; i--) {
    const index = linksToRemove[i];
    if (index !== undefined) {
      state.activeLinks.splice(index, 1);
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted };
}
