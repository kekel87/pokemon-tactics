import type { LinkType } from "../enums/link-type";

export interface ActiveLink {
  sourceId: string;
  targetId: string;
  linkType: LinkType;
  remainingTurns: number | null;
  maxRange: number;
  drainFraction: number;
  immobilize?: boolean;
  drainToSource?: boolean;
}
