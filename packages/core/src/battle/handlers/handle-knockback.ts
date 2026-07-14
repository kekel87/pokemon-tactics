import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { isTerrainPassable, TerrainType } from "../../enums/terrain-type";
import { Grid } from "../../grid/Grid";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { Effect } from "../../types/effect";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { Position } from "../../types/position";
import { applyImpactDamage } from "../apply-impact-damage";
import type { EffectContext } from "../effect-handler-registry";
import { isEffectivelyFlying } from "../effective-flying";
import { calculateFallDamage } from "../fall-damage";
import {
  getKnockbackDirection,
  ICE_SLIDE_COLLISION_HEIGHT,
  type KnockbackDirection,
  resolveIceSlide,
  resolveKnockbackDestination,
} from "../knockback-prediction";

function performIceSlide(
  slider: PokemonInstance,
  slideStart: Position,
  direction: KnockbackDirection,
  grid: Grid,
  state: BattleState,
): BattleEvent[] {
  const { slideEnd, wallImpactHeightDiff, collisionId } = resolveIceSlide({
    slideStart,
    direction,
    grid,
    state,
  });

  const endEvents: BattleEvent[] = [];

  if (wallImpactHeightDiff !== null) {
    endEvents.push(...applyImpactDamage(slider, wallImpactHeightDiff));
  }

  if (collisionId !== null) {
    const collidee = state.pokemon.get(collisionId);
    if (collidee) {
      const damage = calculateFallDamage(ICE_SLIDE_COLLISION_HEIGHT, slider.maxHp);
      slider.currentHp = Math.max(0, slider.currentHp - damage);
      collidee.currentHp = Math.max(0, collidee.currentHp - damage);
      endEvents.push({
        type: BattleEventType.IceSlideCollision,
        sliderId: slider.id,
        targetId: collidee.id,
        damage,
      });
      if (slider.currentHp <= 0) {
        endEvents.push({
          type: BattleEventType.PokemonKo,
          pokemonId: slider.id,
          countdownStart: 0,
        });
      }
      if (collidee.currentHp <= 0) {
        endEvents.push({
          type: BattleEventType.PokemonKo,
          pokemonId: collidee.id,
          countdownStart: 0,
        });
      }
    }
  }

  if (slideEnd.x === slideStart.x && slideEnd.y === slideStart.y) {
    return endEvents;
  }

  grid.setOccupant(slideStart, null);
  grid.setOccupant(slideEnd, slider.id);
  slider.position = slideEnd;
  slider.movedThisTurn = true;

  const events: BattleEvent[] = [];
  events.push({
    type: BattleEventType.IceSlideApplied,
    pokemonId: slider.id,
    from: slideStart,
    to: slideEnd,
  });

  const startHeight = grid.getTile(slideStart)?.height ?? 0;
  const endHeight = grid.getTile(slideEnd)?.height ?? 0;
  const heightDiff = startHeight - endHeight;
  if (heightDiff > 0) {
    const fallDamage = calculateFallDamage(heightDiff, slider.maxHp);
    if (fallDamage > 0) {
      slider.currentHp = Math.max(0, slider.currentHp - fallDamage);
      events.push({
        type: BattleEventType.FallDamageDealt,
        pokemonId: slider.id,
        amount: fallDamage,
        heightDiff,
      });
      if (slider.currentHp <= 0) {
        events.push({ type: BattleEventType.PokemonKo, pokemonId: slider.id, countdownStart: 0 });
      }
    }
  }

  events.push(...endEvents);
  return events;
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

    const targetTypes = context.targetTypesMap.get(target.id) ?? [];
    const isFlying = isEffectivelyFlying(target, targetTypes);
    const direction = getKnockbackDirection(context.attacker.position, target.position);
    const { destination, blockedReason } = resolveKnockbackDestination({
      targetPosition: target.position,
      direction,
      distance: effect.distance,
      grid,
      targetTypes,
      targetIsFlying: isFlying,
    });

    if (blockedReason !== null) {
      events.push({
        type: BattleEventType.KnockbackBlocked,
        pokemonId: target.id,
        reason: blockedReason,
      });
    }

    if (destination) {
      const from = { ...target.position };
      const fromTile = grid.getTile(from);
      const destTile = grid.getTile(destination);
      grid.setOccupant(from, null);
      grid.setOccupant(destination, target.id);
      target.position = destination;
      target.movedThisTurn = true;

      events.push({
        type: BattleEventType.KnockbackApplied,
        pokemonId: target.id,
        from,
        to: destination,
      });

      if (destTile && !isTerrainPassable(destTile.terrain)) {
        target.currentHp = 0;
        events.push({
          type: BattleEventType.LethalTerrainKo,
          pokemonId: target.id,
          terrain: destTile.terrain,
        });
        events.push({ type: BattleEventType.PokemonKo, pokemonId: target.id, countdownStart: 0 });
        continue;
      }

      const fromHeight = fromTile?.height ?? 0;
      const destHeight = destTile?.height ?? 0;
      const heightDiff = fromHeight - destHeight;
      if (heightDiff > 0 && !isFlying) {
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

      const isIceImmune = targetTypes.includes(PokemonType.Ice) || isFlying;

      if (destTile?.terrain === TerrainType.Ice && !isIceImmune) {
        const slideEvents = performIceSlide(target, destination, direction, grid, context.state);
        events.push(...slideEvents);
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
