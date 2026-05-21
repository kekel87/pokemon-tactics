import type { MoveDefinition } from "../types/move-definition";
import { SemiInvulnerableState } from "../types/semi-invulnerable-state";

const VULNERABLE_MOVES_FLYING: ReadonlySet<string> = new Set([
  "thunder",
  "hurricane",
  "twister",
  "gust",
  "smack-down",
  "sky-uppercut",
  "whirlwind",
  "thousand-arrows",
]);

const VULNERABLE_MOVES_BURROWING: ReadonlySet<string> = new Set([
  "earthquake",
  "magnitude",
  "fissure",
]);

const VULNERABLE_MOVES_DIVING: ReadonlySet<string> = new Set(["surf", "whirlpool"]);

const DOUBLE_DAMAGE_FLYING: ReadonlySet<string> = new Set(["thunder", "twister", "gust"]);
const DOUBLE_DAMAGE_BURROWING: ReadonlySet<string> = new Set(["earthquake", "magnitude"]);
const DOUBLE_DAMAGE_DIVING: ReadonlySet<string> = new Set(["surf", "whirlpool"]);

export function canMoveHitSemiInvulnerable(
  move: MoveDefinition,
  state: SemiInvulnerableState,
): boolean {
  switch (state) {
    case SemiInvulnerableState.Flying:
      return VULNERABLE_MOVES_FLYING.has(move.id);
    case SemiInvulnerableState.Burrowing:
      return VULNERABLE_MOVES_BURROWING.has(move.id);
    case SemiInvulnerableState.Diving:
      return VULNERABLE_MOVES_DIVING.has(move.id);
    case SemiInvulnerableState.Vanished:
      return false;
  }
}

export function getSemiInvulnerableDamageMultiplier(
  move: MoveDefinition,
  state: SemiInvulnerableState,
): number {
  switch (state) {
    case SemiInvulnerableState.Flying:
      return DOUBLE_DAMAGE_FLYING.has(move.id) ? 2 : 1;
    case SemiInvulnerableState.Burrowing:
      return DOUBLE_DAMAGE_BURROWING.has(move.id) ? 2 : 1;
    case SemiInvulnerableState.Diving:
      return DOUBLE_DAMAGE_DIVING.has(move.id) ? 2 : 1;
    case SemiInvulnerableState.Vanished:
      return 1;
  }
}
