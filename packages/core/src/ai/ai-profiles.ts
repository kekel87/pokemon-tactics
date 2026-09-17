import { AiDifficulty } from "../enums/ai-difficulty";
import type { AiProfile } from "../types/ai-profile";

/**
 * « Un enfant doit pouvoir la battre » (objectif posé par l'humain, 2026-09-17).
 *
 * 🔴 L'échelle se construit VERS LE BAS, et c'est la leçon de la mesure : le scorer glouton à un coup
 * est à son plafond, donc on ne rend pas Difficile plus fort — on rend Facile plus faible. Avant ce
 * réglage les trois niveaux tournaient tous autour de 50 % les uns contre les autres.
 *
 * Trois leviers, et aucun n'est un poids « au hasard » :
 * - `readsDamage` faux — elle N'ESTIME PAS les dégâts. Elle classe ses attaques par leur puissance de
 *   base et rien d'autre : ni type, ni Défense adverse, ni talent, ni objet, ni cran de stat. Arbitrage
 *   de l'humain (2026-09-17) : « un gamin, c'est plutôt *Dracaufeu, il faut des grosses flammes*, même
 *   contre un Onix » ;
 * - `randomWeight` 0,55 — plus d'une action sur deux est sous-optimale ;
 * - `topN` 4 — et quand elle se trompe, elle pioche plus bas dans le classement.
 */
export const EASY_PROFILE: AiProfile = {
  difficulty: AiDifficulty.Easy,
  randomWeight: 0.55,
  topN: 4,
  scoringWeights: {
    killPotential: 10,
    // INERTE à ce palier, et gardé à sa valeur nominale exprès : sans estimation de dégâts il n'y a
    // pas d'`effectiveness`, donc le terme d'avantage de type ne se déclenche jamais. Le mettre à 0
    // laisserait croire que la faiblesse vient d'un poids, alors qu'elle est structurelle.
    typeAdvantage: 3,
    positioning: 1,
    statChanges: 1,
  },
  // Facile ne regarde RIEN au-delà du coup immédiat : ni le danger de la case où il va, ni les cibles
  // déjà blessées, ni une éjection à préparer. C'est ce qui le rend reconnaissable en jouant.
  capabilities: {
    riskAwareness: false,
    focusFire: false,
    ringOutSetup: false,
    // L'erreur se VOIT : du Feu sur un Pokemon Eau, du Sol sur un Pokemon Vol. Elle ne « vise pas
    // moins bien », elle ne regarde pas.
    readsDamage: false,
    seesHiddenInfo: false,
  },
};

/**
 * Le niveau de référence : « quelqu'un qui connaît les types, qui fait un peu attention au placement,
 * aux talents et aux objets doit la battre » (humain, 2026-09-17). Elle joue juste sans jamais
 * chercher plus loin que le coup en cours.
 */
export const MEDIUM_PROFILE: AiProfile = {
  difficulty: AiDifficulty.Medium,
  randomWeight: 0.2,
  topN: 2,
  scoringWeights: {
    killPotential: 10,
    typeAdvantage: 3,
    positioning: 2,
    statChanges: 1,
  },
  // Moyenne achève ce qui est déjà entamé, mais ne se protège pas et ne prépare rien.
  capabilities: {
    riskAwareness: false,
    focusFire: true,
    ringOutSetup: false,
    readsDamage: true,
    seesHiddenInfo: false,
  },
};

/**
 * Le plafond de ce que le scorer sait faire.
 *
 * 🔴 `killPotential` 20 et `statChanges` 0,5, et ces deux chiffres viennent d'une MESURE, pas d'une
 * intuition. Avec ses anciens poids (`statChanges` 2, le double de Moyenne), Difficile lançait 474
 * capacités de statut pour 486 de dégâts, là où Moyenne en lançait 388 pour 583 : **il se préparait au
 * lieu de frapper, et PERDAIT contre Moyenne** (25 victoires sur 60). Rééquilibré, il repasse devant.
 *
 * ⚠️ Supprimer complètement les montées de stats (`statChanges` 0) donne le PIRE résultat de tous les
 * réglages essayés — 15 victoires sur 60. Ce n'était donc pas le buff qui nuisait, mais sa
 * surpondération relative.
 */
export const HARD_PROFILE: AiProfile = {
  difficulty: AiDifficulty.Hard,
  randomWeight: 0,
  topN: 1,
  scoringWeights: {
    killPotential: 20,
    typeAdvantage: 5,
    positioning: 3,
    statChanges: 0.5,
  },
  // Difficile voit tout : il achève, il se protège, et il prépare ses éjections.
  capabilities: {
    riskAwareness: true,
    focusFire: true,
    ringOutSetup: true,
    readsDamage: true,
    // Difficile SEULE voit ce que le brouillard cache au joueur (objet, talent). Voir
    // `ai/hidden-info.ts` : les deux autres paliers jouent avec les mêmes `???` que lui.
    seesHiddenInfo: true,
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
