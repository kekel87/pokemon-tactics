import { Grid } from "../../grid/Grid";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { ejectToSpawn } from "../forced-teleport";

/**
 * Phazing (Cyclone / Hurlement / Projection): eject each enemy target back to its own spawn zone.
 *
 * There is no bench in this game, so the canon "force switch-out" is reinterpreted as a forced
 * teleport home — the same reinterpretation the eject items use (Bouton Fuite / Carton Rouge,
 * decisions #564-565). The caster's position is passed as the threat so `ejectToSpawn` prefers the
 * spawn tile farthest from the caster. Stat stages and volatiles are kept (decision: repositioning
 * only, not a full switch reset). Allies and the caster itself are never phazed; a target with no
 * safe spawn tile simply stays put (the move part fizzles for it).
 */
export function handlePhaze(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const grid = new Grid(
    context.state.grid[0]?.length ?? 0,
    context.state.grid.length,
    context.state.grid,
  );

  for (const target of context.targets) {
    if (target.currentHp <= 0 || target.playerId === context.attacker.playerId) {
      continue;
    }
    const targetTypes = context.targetTypesMap.get(target.id) ?? [];
    const event = ejectToSpawn(context.state, grid, target, targetTypes, context.attacker.position);
    if (event) {
      events.push(event);
    }
  }

  return events;
}
