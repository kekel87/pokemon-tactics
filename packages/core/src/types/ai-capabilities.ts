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
  /**
   * Estime-t-elle vraiment les dégâts ? Fausse = elle lit `readNaiveDamage`, c'est-à-dire la formule du
   * jeu avec un adversaire moyen : rien d'autre que la puissance du move.
   *
   * 🔴 On dégrade ce qu'elle PERÇOIT, pas ce qu'elle CHOISIT, et c'est un patron repris de Freeciv
   * (`H_FOG`, `H_MAP` : l'IA facile ne voit littéralement pas tout) et d'OpenXcom (`intelligence` :
   * combien de tours elle se souvient d'un ennemi repéré).
   *
   * Pourquoi pas un simple poids faible sur l'avantage de type, ce qu'on faisait avant : un poids reste
   * **correctement orienté en moyenne**, donc l'IA vise toujours un peu mieux que le hasard, elle est
   * juste moins tranchée. Une cécité, elle, produit des erreurs **systémiques et reconnaissables** —
   * elle envoie du Feu sur un Pokemon Eau et le joueur le voit. C'est la différence entre « elle est
   * bête » et « elle a eu un coup de moins bien ».
   *
   * ⚠️ Remplace `typeBlindChance` (une cécité TIRÉE au hasard une fois par décision), jugée trop douce
   * par l'humain : « c'est déjà plus que ce que j'attends du niveau facile ». La cécité n'est plus un
   * tirage, elle est structurelle — sans estimation de dégâts, l'efficacité de type n'existe tout
   * simplement plus, puisqu'elle sortait de `estimateDamage`.
   */
  readonly readsDamage: boolean;
  /**
   * Voit-elle ce que le brouillard cache au joueur — objet tenu et talent d'un adversaire, tant qu'ils
   * n'ont pas été révélés ?
   *
   * 🔴 **Vraie pour Difficile SEULE**, et c'est une remise à niveau, pas un cadeau : avant le plan 214
   * les trois paliers lisaient `heldItemId` et le talent effectif directement dans l'état, alors que le
   * joueur voyait `???`. L'IA basse ne jouait donc pas la même partie que lui. Détail et périmètre :
   * `ai/hidden-info.ts`.
   */
  readonly seesHiddenInfo: boolean;
}
