import type { PokemonType } from "../enums/pokemon-type";
import type { StatName } from "../enums/stat-name";
import type { TerrainType } from "../enums/terrain-type";
import type { DamageModifyContext } from "./ability-definition";
import type { BattleEvent } from "./battle-event";
import type { BattleState } from "./battle-state";
import type { MoveDefinition } from "./move-definition";
import type { PokemonInstance } from "./pokemon-instance";

export interface ItemReactionResult {
  events: BattleEvent[];
  consumeItem: boolean;
}

export interface ItemBlockResult {
  blocked: boolean;
  events: BattleEvent[];
}

export interface CritStageContext {
  self: PokemonInstance;
  move: MoveDefinition;
}

export interface AfterMoveDamageDealtContext {
  attacker: PokemonInstance;
  move: MoveDefinition;
  damageDealt: number;
}

export interface AfterItemDamageContext {
  target: PokemonInstance;
  attacker: PokemonInstance;
  move: MoveDefinition;
  damageDealt: number;
  wasAtMaxHp: boolean;
  isSuperEffective: boolean;
  isContact: boolean;
}

export interface ItemEndTurnContext {
  pokemon: PokemonInstance;
  state: BattleState;
  selfTypes: PokemonType[];
}

export interface ItemTerrainContext {
  pokemon: PokemonInstance;
  terrain: TerrainType;
}

export interface ItemCtGainContext {
  pokemon: PokemonInstance;
}

export interface StatLoweredContext {
  pokemon: PokemonInstance;
  stat: StatName;
  stages: number;
}

export interface ItemAccuracyContext {
  self: PokemonInstance;
  target: PokemonInstance;
  move: MoveDefinition;
}

export interface ItemMoveImmunityContext {
  self: PokemonInstance;
  move: MoveDefinition;
}

export interface ItemTypeImmunityContext {
  self: PokemonInstance;
  moveType: PokemonType;
}

export interface ItemStatChangeBlockContext {
  self: PokemonInstance;
  stat: StatName;
  stages: number;
  source: PokemonInstance | null;
}

export interface ItemAfterMoveUseContext {
  self: PokemonInstance;
  move: MoveDefinition;
}

export interface HeldItemHandler {
  id: string;
  /** True for berries. Tension (unnerve) suppresses berry consumption while a living enemy carries it. */
  isBerry?: boolean;
  onDamageModify?: (context: DamageModifyContext) => number;
  onCritStageBoost?: (context: CritStageContext) => number;
  onAfterMoveDamageDealt?: (context: AfterMoveDamageDealtContext) => BattleEvent[];
  onAfterDamageReceived?: (context: AfterItemDamageContext) => ItemReactionResult;
  onEndTurn?: (context: ItemEndTurnContext) => BattleEvent[];
  onTerrainTick?: (context: ItemTerrainContext) => ItemBlockResult;
  onCtGainModify?: (context: ItemCtGainContext) => number;
  onMoveLock?: () => boolean;
  onStatLowered?: (context: StatLoweredContext) => ItemReactionResult;
  onAccuracyModify?: (context: ItemAccuracyContext) => number;
  onEvasionModify?: (context: ItemAccuracyContext) => number;
  onFlinchChance?: (context: ItemAccuracyContext) => number;
  /** Multiplier applied to HP recovered by the holder's draining moves (Big Root). */
  onDrainHealModify?: () => number;
  /** When true, the holder cannot select status-category moves (Assault Vest). */
  forbidsStatusMoves?: boolean;
  /** When true, a move-restricting volatile inflicted on the holder is cured at once (Mental Herb). */
  curesMoveRestriction?: boolean;
  /** Blocks an incoming move by a move-property (Lunettes Filtre vs moves Poudre). */
  onMoveImmunity?: (context: ItemMoveImmunityContext) => ItemBlockResult;
  /** Grants type immunity to an incoming damaging move (Ballon vs type Sol). */
  onTypeImmunity?: (context: ItemTypeImmunityContext) => ItemBlockResult;
  /** Blocks an opponent-inflicted stat drop on the holder (Talisman Sain). */
  onStatChangeBlocked?: (context: ItemStatChangeBlockContext) => ItemBlockResult;
  /** When true, the holder ignores weather chip damage (Lunettes Filtre). */
  immuneToWeatherDamage?: boolean;
  /** When true, the holder's contact moves ignore the target's contact-triggered effects (Pare-Effet). */
  protectsFromContactEffects?: boolean;
  /** When set, the holder's matching moves lose contact, muting the target's reactions (Gant de Boxe = moves Poing). */
  nullifiesContactForMove?: (move: MoveDefinition) => boolean;
  /** Fired once after the holder uses a move, whatever the move does (Spray Gorge vs moves Son). */
  onAfterMoveUse?: (context: ItemAfterMoveUseContext) => ItemReactionResult;
  /**
   * Unconditional "eat now" effect, applied to whoever eats this berry — the holder when fed via
   * Picore/Piqûre, or the target hit by a thrown berry (Dégommage). Bypasses the berry's normal
   * trigger gate (no HP threshold). Berries with a purely defensive effect (anti-type) leave this
   * unset → eating them does nothing. Returns the events to emit; mutates `eater` in place.
   */
  onEaten?: (eater: PokemonInstance) => BattleEvent[];
  /** Base power when thrown via Dégommage (fling). Items without a value cannot be flung. */
  flingPower?: number;
  /** Secondary effect a thrown non-berry item inflicts on the target (Dégommage): orbs → status… */
  onFling?: (target: PokemonInstance) => BattleEvent[];
}

export interface HeldItemDefinition extends HeldItemHandler {
  name: { fr: string; en: string };
  shortDescription: { fr: string; en: string };
}
