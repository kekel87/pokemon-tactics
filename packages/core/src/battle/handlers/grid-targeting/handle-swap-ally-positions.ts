import { BattleEventType } from "../../../enums/battle-event-type";
import { Grid } from "../../../grid/Grid";
import type { BattleEvent } from "../../../types/battle-event";
import type { Position } from "../../../types/position";
import type { EffectContext } from "../../effect-handler-registry";

/**
 * Interversion (ally-switch, plan 155): the caster swaps grid positions with a target ally. The
 * grid-native reinterpretation of the canon doubles repositioning tool — the most natural of Batch E.
 *
 * The handler mutates the grid occupancy and both `position`s, then emits `AlliesSwapped`. The
 * `BattleEngine` scans for that event post-effect and re-triggers the tile's terrain on each mon
 * (lava / deep water / hazards), so swapping a grounded mon onto lethal terrain has consequences —
 * mirror of the Anti-Air / ability-manip grounding tick. A levitating mon (Vol Magnétik) floats over
 * it. Orientations are kept. No-op if there is no living ally target other than the caster.
 */
export function handleSwapAllyPositions(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const ally = context.targets.find(
    (mon) => mon.id !== caster.id && mon.currentHp > 0 && mon.playerId === caster.playerId,
  );
  if (!ally) {
    return [];
  }

  const grid = new Grid(
    context.state.grid[0]?.length ?? 0,
    context.state.grid.length,
    context.state.grid,
  );

  const casterFrom: Position = { ...caster.position };
  const allyFrom: Position = { ...ally.position };

  grid.setOccupant(casterFrom, ally.id);
  grid.setOccupant(allyFrom, caster.id);
  caster.position = { ...allyFrom };
  ally.position = { ...casterFrom };

  return [
    {
      type: BattleEventType.AlliesSwapped,
      casterId: caster.id,
      allyId: ally.id,
      casterPosition: { ...caster.position },
      allyPosition: { ...ally.position },
    },
  ];
}
