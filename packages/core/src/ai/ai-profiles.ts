import { AiDifficulty } from "../enums/ai-difficulty";
import type { AiProfile } from "../types/ai-profile";

export const EASY_PROFILE: AiProfile = {
  difficulty: AiDifficulty.Easy,
  randomWeight: 0.4,
  topN: 3,
  scoringWeights: {
    killPotential: 10,
    typeAdvantage: 3,
    positioning: 2,
    statChanges: 1,
  },
};

export const MEDIUM_PROFILE: AiProfile = {
  difficulty: AiDifficulty.Medium,
  randomWeight: 0.15,
  topN: 2,
  scoringWeights: {
    killPotential: 10,
    typeAdvantage: 3,
    positioning: 2,
    statChanges: 1,
  },
};

export const HARD_PROFILE: AiProfile = {
  difficulty: AiDifficulty.Hard,
  randomWeight: 0,
  topN: 1,
  scoringWeights: {
    killPotential: 10,
    typeAdvantage: 5,
    positioning: 3,
    statChanges: 2,
  },
};
