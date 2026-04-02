import type { Action } from "./action";

export interface BattleReplay {
  seed: number;
  actions: Action[];
}
