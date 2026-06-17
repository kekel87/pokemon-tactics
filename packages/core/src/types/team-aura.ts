import type { AuraKind } from "../enums/aura-kind";

export interface TeamAura {
  kind: AuraKind;
  casterPokemonId: string;
  remainingRounds: number;
  /** `actionCounter` at post time — stable ordering for badge rendering. */
  postedAtAction: number;
}
