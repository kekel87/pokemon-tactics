export interface ActiveLink {
  sourceId: string;
  targetId: string;
  linkType: string;
  remainingTurns: number;
  maxRange: number;
  drainFraction: number;
}
