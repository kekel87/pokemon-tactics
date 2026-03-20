import type { EffectKind } from "../enums/effect-kind";
import type { EffectTarget } from "../enums/effect-target";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";

export type Effect =
  | { kind: typeof EffectKind.Damage }
  | { kind: typeof EffectKind.Status; status: StatusType; chance: number }
  | {
      kind: typeof EffectKind.StatChange;
      stat: StatName;
      stages: number;
      target: EffectTarget;
    }
  | {
      kind: typeof EffectKind.Link;
      linkType: string;
      duration: number;
      maxRange: number;
      drainFraction: number;
    };
