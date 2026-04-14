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
import { calculateFallDamage } from "../fall-damage";
import { isTerrainImmune } from "../terrain-effects";

const ICE_SLIDE_COLLISION_HEIGHT = 2;

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

function performIceSlide(
  slider: PokemonInstance,
  slideStart: Position,
  direction: { dx: number; dy: number },
  grid: Grid,
  state: BattleState,
): BattleEvent[] {
  let current = slideStart;
  let slideEnd = slideStart;
  const endEvents: BattleEvent[] = [];

  while (true) {
    const next: Position = { x: current.x + direction.dx, y: current.y + direction.dy };

    if (!grid.isInBounds(next)) {
      break;
    }

    const nextTile = grid.getTile(next);
    if (!nextTile) {
      break;
    }

    if (!isTerrainPassable(nextTile.terrain)) {
      const wallHeightDiff = Math.max(0, nextTile.height - (grid.getTile(current)?.height ?? 0));
      endEvents.push(...applyImpactDamage(slider, wallHeightDiff));
      break;
    }

    const occupantId = grid.getOccupant(next);
    if (occupantId !== null) {
      const collidee = state.pokemon.get(occupantId);
      if (collidee && collidee.currentHp > 0) {
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
        break;
      }
    }

    slideEnd = next;
    current = next;

    if (nextTile.terrain !== TerrainType.Ice) {
      break;
    }
  }

  if (slideEnd.x === slideStart.x && slideEnd.y === slideStart.y) {
    return endEvents;
  }

  grid.setOccupant(slideStart, null);
  grid.setOccupant(slideEnd, slider.id);
  slider.position = slideEnd;

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

      const candidateTile = grid.getTile(candidate);
      if (candidateTile && !isTerrainPassable(candidateTile.terrain)) {
        const targetTypes = context.targetTypesMap.get(target.id) ?? [];
        if (isTerrainImmune(candidateTile.terrain, targetTypes)) {
          events.push({
            type: BattleEventType.KnockbackBlocked,
            pokemonId: target.id,
            reason: "terrain",
          });
          break;
        }
        destination = candidate;
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

      const targetTypes = context.targetTypesMap.get(target.id) ?? [];
      const isFlying = targetTypes.includes(PokemonType.Flying);

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
