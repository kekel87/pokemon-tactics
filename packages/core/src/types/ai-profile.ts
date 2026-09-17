import type { AiDifficulty } from "../enums/ai-difficulty";
import type { AiCapabilities } from "./ai-capabilities";

export interface ScoringWeights {
  readonly killPotential: number;
  readonly typeAdvantage: number;
  readonly positioning: number;
  readonly statChanges: number;
}

export interface AiProfile {
  readonly difficulty: AiDifficulty;
  readonly randomWeight: number;
  readonly topN: number;
  readonly scoringWeights: ScoringWeights;
  readonly capabilities: AiCapabilities;
}
