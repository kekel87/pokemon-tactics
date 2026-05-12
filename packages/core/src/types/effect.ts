import type { DefensiveKind } from "../enums/defensive-kind";
import type { EffectKind } from "../enums/effect-kind";
import type { EffectTarget } from "../enums/effect-target";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";

export type Effect =
  | { kind: typeof EffectKind.Damage; hits?: number | { min: number; max: number } }
  | {
      kind: typeof EffectKind.Status;
      status: StatusType;
      chance: number;
      damagePerTurn?: number;
      target?: typeof EffectTarget.Self;
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
  | { kind: typeof EffectKind.Drain; fraction: number };
