export const EntryHazardKind = {
  /** Picots: deals a fixed HP fraction per trapped tile entered, stacks up to 3 layers. Grounded only. */
  Spikes: "spikes",
  /** Pièges de Roc: Rock-type-effective damage per trapped tile entered. Hits everyone, 1 layer. */
  StealthRock: "stealth-rock",
  /** Pics Toxik: poisons (layer 1) / badly poisons (layer 2) on entry. Grounded only; Poison absorbs. */
  ToxicSpikes: "toxic-spikes",
  /** Toile Gluante: Speed -1 per trapped tile entered (cumulative). Grounded only, 1 layer. */
  StickyWeb: "sticky-web",
} as const;

export type EntryHazardKind = (typeof EntryHazardKind)[keyof typeof EntryHazardKind];
