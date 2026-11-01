import type { Action } from "./action";
import type { ReplayForfeit } from "./replay-forfeit";

export interface BattleReplay {
  seed: number;
  actions: Action[];
  /** Absent quand personne n'a abandonné, pour que le replay d'une partie sans abandon ne change pas. */
  forfeits?: ReplayForfeit[];
}
