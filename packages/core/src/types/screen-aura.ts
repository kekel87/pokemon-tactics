import type { ScreenKind } from "../enums/screen-kind";

export interface ScreenAura {
  kind: ScreenKind;
  casterPokemonId: string;
  remainingRounds: number;
  postedRound: number;
}
