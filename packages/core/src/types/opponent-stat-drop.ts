import type { AbilityHandlerRegistry } from "../battle/ability-handler-registry";
import type { HeldItemHandlerRegistry } from "../battle/held-item-handler-registry";
import type { StatName } from "../enums/stat-name";
import type { BattleState } from "./battle-state";
import type { PokemonInstance } from "./pokemon-instance";

/** A stat drop inflicted on `target` by an opponent (`source`): by a move, or by Intimidation. */
export interface OpponentStatDrop {
  state: BattleState;
  abilityRegistry: AbilityHandlerRegistry | undefined;
  itemRegistry: HeldItemHandlerRegistry | undefined;
  target: PokemonInstance;
  source: PokemonInstance;
  stat: StatName;
  stages: number;
}
