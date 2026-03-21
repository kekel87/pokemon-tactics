import { LinkType } from "../enums/link-type";
import type { ActiveLink } from "../types/active-link";

export abstract class MockLink {
  static readonly leechSeed: ActiveLink = {
    sourceId: "source",
    targetId: "target",
    linkType: LinkType.LeechSeed,
    remainingTurns: null,
    maxRange: 4,
    drainFraction: 1 / 8,
  };
}
