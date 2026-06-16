import type { BattleEvent, BattleState } from "@pokemon-tactic/core";
import { BATTLE_TEXT_QUEUE_DELAY_MS } from "./constants.js";
import { type FloatingTextContext, floatingTextsFor } from "./floating-text-content.js";

/**
 * Minimal structural surface the spawner needs from a renderer's combat scene:
 * spawn a short drifting label over a tile. Any engine adapter's
 * `CombatScene` satisfies this, so the staggering logic lives here once (plan 126).
 */
export interface FloatingTextSink {
  spawnFloatingText(
    tile: { x: number; y: number },
    text: string,
    color: string,
    options?: { delayMs?: number; secondary?: boolean },
  ): void;
}

/**
 * Bridges core battle events to a combat scene's floating labels (plan 122 step
 * 4c-1, hoisted in plan 126). Maps each event to its short texts
 * (`floatingTextsFor`), looks up the target's current tile in the engine state,
 * and spawns them on the scene with a per-target stagger so a beat's labels scroll
 * up one after another (a queue delay so stacked floats read sequentially).
 * Engine-agnostic: the scene is injected as a
 * `FloatingTextSink`.
 */
export function createFloatingTextSpawner(
  combat: FloatingTextSink,
  state: BattleState,
  context: FloatingTextContext,
): (event: BattleEvent) => void {
  const nextSpawnAt = new Map<string, number>();

  const acquireDelay = (pokemonId: string): number => {
    const now = performance.now();
    const earliest = nextSpawnAt.get(pokemonId) ?? now;
    nextSpawnAt.set(pokemonId, Math.max(earliest, now) + BATTLE_TEXT_QUEUE_DELAY_MS);
    return Math.max(0, earliest - now);
  };

  return (event: BattleEvent) => {
    let primaryDelay = 0;
    for (const spec of floatingTextsFor(event, context)) {
      const pokemon = state.pokemon.get(spec.pokemonId);
      if (!pokemon) {
        continue;
      }
      let delayMs: number;
      if (spec.secondary) {
        delayMs = primaryDelay;
      } else {
        delayMs = acquireDelay(spec.pokemonId);
        primaryDelay = delayMs;
      }
      combat.spawnFloatingText(pokemon.position, spec.text, spec.color, {
        delayMs,
        secondary: spec.secondary,
      });
    }
  };
}
