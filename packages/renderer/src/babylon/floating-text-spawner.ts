import type { BattleEvent, BattleState } from "@pokemon-tactic/core";
import { BATTLE_TEXT_QUEUE_DELAY_MS } from "../constants.js";
import { type FloatingTextContext, floatingTextsFor } from "../game/floating-text-content.js";
import type { CombatScene } from "./combat-scene.js";

/**
 * Bridges core battle events to the combat scene's floating labels (plan 122
 * step 4c-1). Maps each event to its short texts (`floatingTextsFor`), looks up
 * the target's current tile in the engine state, and spawns them on the scene
 * with a per-target stagger so a beat's labels scroll up one after another
 * (same queue delay as the Phaser BattleText, so stacked floats read sequentially).
 */

export function createFloatingTextSpawner(
  combat: CombatScene,
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
