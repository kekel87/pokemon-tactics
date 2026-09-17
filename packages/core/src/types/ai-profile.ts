import type { AiDifficulty } from "../enums/ai-difficulty";

export interface ScoringWeights {
  readonly killPotential: number;
  readonly typeAdvantage: number;
  readonly positioning: number;
  readonly statChanges: number;
}

/**
 * Ce que l'IA SAIT regarder, par opposition à l'importance qu'elle y accorde (`ScoringWeights`).
 *
 * 🔴 **C'est LE levier de difficulté**, et il est né d'une mesure puis d'une recherche (plan 214).
 *
 * La mesure : 480 parties IA contre IA ont montré que les trois niveaux étaient **indiscernables** —
 * la marge de victoire, c'est-à-dire les Pokemon encore debout chez le gagnant, valait 3,2/6 quand
 * Facile battait Facile et 3,3/6 quand Difficile battait Facile. Les 6-0 n'arrivaient jamais.
 *
 * La recherche : dans le genre tactique, la difficulté PERÇUE ne vient ni du bruit de sélection ni
 * des poids, mais de la **richesse des considérations**. XCOM et *A Better ADVENT* distinguent des IA
 * qui voient des priorités avancées (flanquement, achèvement, retraite) de celles qui n'en voient
 * qu'un sous-ensemble. Une IA qui ne prépare JAMAIS une éjection se reconnaît en jouant ; une IA qui
 * pioche son deuxième meilleur coup 15 % du temps, non.
 *
 * Wargroove, cité tel quel : *« having smarter AI doesn't necessarily make a game better »*.
 */
export interface AiCapabilities {
  /**
   * Évalue le danger de la case où elle va. Sans elle, l'IA avance sur une case d'où l'adversaire la
   * met K.O. sans jamais le voir venir — le travers pour lequel l'IA de Fire Emblem est moquée.
   */
  readonly riskAwareness: boolean;
  /**
   * Achève une cible déjà blessée plutôt que de répartir les dégâts. Un Pokemon K.O. ne riposte
   * plus : c'est ce qui transforme une victoire 6-3 en 6-0.
   */
  readonly focusFire: boolean;
  /**
   * Se DÉPLACE pour préparer une éjection fatale par recul (volets A3/A4, plan 172), au lieu de ne
   * jouer l'éjection que lorsqu'elle tombe toute seule.
   */
  readonly ringOutSetup: boolean;
}

export interface AiProfile {
  readonly difficulty: AiDifficulty;
  readonly randomWeight: number;
  readonly topN: number;
  readonly scoringWeights: ScoringWeights;
  readonly capabilities: AiCapabilities;
}
