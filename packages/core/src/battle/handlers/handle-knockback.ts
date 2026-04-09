import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { Grid } from "../../grid/Grid";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { Position } from "../../types/position";
import type { EffectContext } from "../effect-handler-registry";
import { calculateFallDamage } from "../fall-damage";

function getKnockbackDirection(
  attackerPos: Position,
  targetPos: Position,
): { dx: number; dy: number } {
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx: dx >= 0 ? 1 : -1, dy: 0 };
  }
  return { dx: 0, dy: dy >= 0 ? 1 : -1 };
}

export function handleKnockback(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Knockback }>;
  const grid = new Grid(
    context.state.grid[0]?.length ?? 0,
    context.state.grid.length,
    context.state.grid,
  );

  for (const target of context.targets) {
    if (target.currentHp <= 0) {
      continue;
    }

    const direction = getKnockbackDirection(context.attacker.position, target.position);
    let destination: Position | null = null;

    for (let step = 1; step <= effect.distance; step++) {
      const candidate: Position = {
        x: target.position.x + direction.dx * step,
        y: target.position.y + direction.dy * step,
      };

      if (!grid.isInBounds(candidate)) {
        events.push({
          type: BattleEventType.KnockbackBlocked,
          pokemonId: target.id,
          reason: "edge",
        });
        break;
      }

      const occupant = grid.getOccupant(candidate);
      if (occupant !== null) {
        events.push({
          type: BattleEventType.KnockbackBlocked,
          pokemonId: target.id,
          reason: "occupied",
        });
        break;
      }

      destination = candidate;
    }

    if (destination) {
      const from = { ...target.position };
      const fromTile = grid.getTile(from);
      const destTile = grid.getTile(destination);
      grid.setOccupant(from, null);
      grid.setOccupant(destination, target.id);
      target.position = destination;

      events.push({
        type: BattleEventType.KnockbackApplied,
        pokemonId: target.id,
        from,
        to: destination,
      });

      const fromHeight = fromTile?.height ?? 0;
      const destHeight = destTile?.height ?? 0;
      const heightDiff = fromHeight - destHeight;
      if (heightDiff > 0) {
        const targetTypes = context.targetTypesMap.get(target.id) ?? [];
        const isFlying = targetTypes.includes(PokemonType.Flying);
        if (!isFlying) {
          const fallDamage = calculateFallDamage(heightDiff, target.maxHp);
          if (fallDamage > 0) {
            target.currentHp = Math.max(0, target.currentHp - fallDamage);
            events.push({
              type: BattleEventType.FallDamageDealt,
              pokemonId: target.id,
              amount: fallDamage,
              heightDiff,
            });
            if (target.currentHp <= 0) {
              events.push({
                type: BattleEventType.PokemonKo,
                pokemonId: target.id,
                countdownStart: 0,
              });
            }
          }
        }
      }

      const hadTrapped = target.volatileStatuses.some((v) => v.type === StatusType.Trapped);
      if (hadTrapped) {
        target.volatileStatuses = target.volatileStatuses.filter(
          (v) => v.type !== StatusType.Trapped,
        );
        events.push({
          type: BattleEventType.StatusRemoved,
          targetId: target.id,
          status: StatusType.Trapped,
        });
      }
    }
  }

  return events;
}
