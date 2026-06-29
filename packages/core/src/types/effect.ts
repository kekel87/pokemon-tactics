import type { AuraKind } from "../enums/aura-kind";
import type { ConditionKind } from "../enums/condition-kind";
import type { DefensiveKind } from "../enums/defensive-kind";
import type { EffectKind } from "../enums/effect-kind";
import type { EffectTarget } from "../enums/effect-target";
import type { EntryHazardKind } from "../enums/entry-hazard-kind";
import type { FieldTerrain } from "../enums/field-terrain";
import type { PokemonType } from "../enums/pokemon-type";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";
import type { Weather } from "../enums/weather";

export type Effect =
  | {
      kind: typeof EffectKind.Damage;
      hits?: number | { min: number; max: number };
      /** Per-hit base power for escalating multi-hit moves (triple-axel: [20, 40, 60]). Length = hit count. */
      escalatingHitPower?: number[];
      /** Multi-hit driven by the user's team: one hit per healthy ally, power from each ally's base Attack (beat-up). */
      teamBeatUp?: boolean;
      /** Only deal damage when the predicate holds (pollen-puff: target_is_enemy). */
      appliesIf?: ConditionKind;
    }
  | {
      kind: typeof EffectKind.Status;
      status: StatusType;
      chance: number;
      damagePerTurn?: number;
      /**
       * Position-linked trap (Trapped only): roots the target with remainingTurns -1 while the
       * caster stays adjacent — released when the caster faints or moves away (mean-look, block).
       * Mirrors the Magnépik (magnet-pull) ability state. Mutually exclusive with damagePerTurn.
       */
      positionLinked?: boolean;
      target?: typeof EffectTarget.Self;
      /** Only apply this effect when the predicate holds (alluring-voice, burning-jealousy). */
      appliesIf?: ConditionKind;
    }
  | {
      kind: typeof EffectKind.Status;
      statuses: [StatusType, ...StatusType[]];
      chance: number;
      target?: typeof EffectTarget.Self;
    }
  | {
      kind: typeof EffectKind.StatChange;
      stat: StatName;
      stages: number;
      target: EffectTarget;
      chance?: number;
      chanceGroup?: number;
    }
  | {
      kind: typeof EffectKind.Defensive;
      defenseKind: DefensiveKind;
    }
  | {
      kind: typeof EffectKind.Knockback;
      distance: number;
    }
  | { kind: typeof EffectKind.HealSelf; percent: number }
  | { kind: typeof EffectKind.Recoil; fraction: number }
  | { kind: typeof EffectKind.Drain; fraction: number }
  | { kind: typeof EffectKind.SetWeather; weather: Weather; turns: number }
  | { kind: typeof EffectKind.TransferStatStages }
  | { kind: typeof EffectKind.PostAura; aura: AuraKind }
  | { kind: typeof EffectKind.PostSubstitute }
  | { kind: typeof EffectKind.Disable }
  | { kind: typeof EffectKind.Encore }
  | {
      kind: typeof EffectKind.HealTarget;
      percent: number;
      /** Only heal when the predicate holds (pollen-puff: target_is_ally). */
      appliesIf?: ConditionKind;
      /** When set, heal all living allies within this Manhattan radius of the caster (life-dew). */
      radius?: number;
    }
  | { kind: typeof EffectKind.CureTeamStatus; radius: number }
  | { kind: typeof EffectKind.HealByTargetStat; stat: StatName }
  | { kind: typeof EffectKind.PostHealOverTime; status: StatusType }
  | { kind: typeof EffectKind.PostWish; percent: number }
  | { kind: typeof EffectKind.PostFieldTerrain; terrain: FieldTerrain }
  | { kind: typeof EffectKind.PostDistortion }
  | { kind: typeof EffectKind.PostEntryHazard; hazardKind: EntryHazardKind }
  | { kind: typeof EffectKind.RemoveEntryHazards; radius: number }
  | { kind: typeof EffectKind.PostImprison }
  | { kind: typeof EffectKind.SpiteCtTax }
  | {
      kind: typeof EffectKind.PostFutureSight;
      /** Manhattan radius of the area struck when the delayed move lands. */
      radius: number;
      /** Number of the caster's own turns before the strike lands. */
      delayTurns: number;
      /** Base power frozen at cast and used to compute damage at landing. */
      power: number;
    }
  | {
      kind: typeof EffectKind.PostPerishSong;
      /** Number of the caster's own turns before the death aura detonates. */
      turns: number;
      /** Manhattan radius of the mobile death aura centred on the caster. */
      radius: number;
    }
  | { kind: typeof EffectKind.PainSplit }
  | { kind: typeof EffectKind.Endeavor }
  | { kind: typeof EffectKind.HelpingHand; multiplier: number }
  | { kind: typeof EffectKind.RemoveItem }
  | { kind: typeof EffectKind.StealItem }
  | { kind: typeof EffectKind.SwapItems }
  | { kind: typeof EffectKind.FlingItem }
  | { kind: typeof EffectKind.EatTargetBerry }
  | { kind: typeof EffectKind.BurnTargetItem }
  | { kind: typeof EffectKind.RecycleItem }
  | { kind: typeof EffectKind.ConvertSelfType }
  | { kind: typeof EffectKind.ConvertResistType }
  | { kind: typeof EffectKind.CopyTargetType }
  | { kind: typeof EffectKind.SoakType; pureType: PokemonType }
  | { kind: typeof EffectKind.RemoveType; removedType: PokemonType }
  | { kind: typeof EffectKind.CopyMoveToSlot };
