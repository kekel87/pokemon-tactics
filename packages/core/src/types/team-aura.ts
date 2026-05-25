import type { AuraKind } from "../enums/aura-kind";

export interface TeamAura {
  kind: AuraKind;
  casterPokemonId: string;
  remainingRounds: number;
  postedRound: number;
}
