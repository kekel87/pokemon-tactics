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

/**
 * Le niveau d'une place IA que personne n'a réglée : une place « libre » qui part en IA au
 * lancement, une sauvegarde d'avant le plan 214, une config sandbox ancienne.
 *
 * 🔴 **Une seule constante, et un seul point d'application** (`resolveAiDifficulty`). Avant le plan
 * 214, deux défauts divergents coexistaient : le jeu était câblé en dur sur `EASY_PROFILE`
 * (`wireScoredAi`) pendant que le studio sandbox repliait sur `"hard"`. Deux réponses à la même
 * question, dans le même binaire.
 *
 * Ce que ça coûterait de le recopier ailleurs : en ligne, deux pairs qui appliquent un défaut
 * différent montent **deux IA différentes, sans erreur et sans trace** — la divergence la plus
 * coûteuse à diagnostiquer du multijoueur, sur le seul chemin où elle est invisible en jeu.
 */
export const DEFAULT_AI_DIFFICULTY: AiDifficulty = AiDifficulty.Medium;

const PROFILE_BY_DIFFICULTY: Record<AiDifficulty, AiProfile> = {
  [AiDifficulty.Easy]: EASY_PROFILE,
  [AiDifficulty.Medium]: MEDIUM_PROFILE,
  [AiDifficulty.Hard]: HARD_PROFILE,
};

/**
 * Le profil d'un niveau. **Fonction totale** : pas de paramètre optionnel, pas de repli interne —
 * c'est `resolveAiDifficulty` qui décide de ce que vaut « pas de niveau », et lui seul.
 */
export function profileForDifficulty(difficulty: AiDifficulty): AiProfile {
  return PROFILE_BY_DIFFICULTY[difficulty];
}

/** Le seul endroit où `DEFAULT_AI_DIFFICULTY` s'applique. Voir la constante. */
export function resolveAiDifficulty(difficulty: AiDifficulty | undefined): AiDifficulty {
  return difficulty ?? DEFAULT_AI_DIFFICULTY;
}
