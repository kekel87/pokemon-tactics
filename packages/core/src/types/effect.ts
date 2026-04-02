import type { DefensiveKind } from "../enums/defensive-kind";
import type { EffectKind } from "../enums/effect-kind";
import type { EffectTarget } from "../enums/effect-target";
import type { LinkType } from "../enums/link-type";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";

export type Effect =
  | { kind: typeof EffectKind.Damage; hits?: number | { min: number; max: number } }
  | { kind: typeof EffectKind.Status; status: StatusType; chance: number }
  | {
      kind: typeof EffectKind.StatChange;
      stat: StatName;
      stages: number;
      target: EffectTarget;
    }
  | {
      kind: typeof EffectKind.Link;
      linkType: LinkType;
      duration: number | null;
      maxRange: number;
      drainFraction: number;
      immobilize?: boolean;
      drainToSource?: boolean;
    }
  | {
      kind: typeof EffectKind.Defensive;
      defenseKind: DefensiveKind;
    }
  | {
      kind: typeof EffectKind.Knockback;
      distance: number;
    };
