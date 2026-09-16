import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * La pondération de cible par camp, en mêlée générale (plan 213, lot G).
 *
 * 🔴 **Le problème qu'elle corrige** : le ciblage traitait tout camp adverse à égalité, sans rien
 * pour celui qui mène ni pour le plus faible. À trois camps et plus, celui qui prenait l'avance ne
 * la perdait plus — rien ne concentrait le feu sur lui. Or la dynamique classique de la mêlée
 * générale est que tout le monde tape le premier qui dépasse.
 *
 * 🔴 **Ce qu'elle N'EST PAS, et c'est un arbitrage de l'humain (2026-09-16)** : une coalition. Le
 * biais est DOUX, et la létalité comme l'efficacité de type restent dominantes — une simple
 * résistance suffit à l'annuler. Punir le meneur au point que mener devienne un handicap
 * retournerait le problème au lieu de le résoudre.
 *
 * 🔴 **Sans effet dès qu'il n'y a qu'un seul camp adverse**, ce qui couvre TOUT format à deux camps
 * — 1v1, mais aussi 2v6 et 4v4, soit 21 parties sur 22 du trafic réel. Ce n'est pas une propriété
 * approximative du réglage : le rang meneur/traînard n'a aucun sens à définir face à un seul camp,
 * et le calcul se court-circuite avant même de commencer.
 */

/** Le meneur encaisse un peu plus. */
const LEADER_FACTOR = 1.2;
/** Le traînard est un peu épargné. */
const TRAILER_FACTOR = 0.9;
/** Ni l'un ni l'autre. */
const NEUTRAL_FACTOR = 1;

/**
 * En deçà de cet écart de vigueur, personne ne mène.
 *
 * 🔴 Sans ce garde, un début de partie où tous les camps sont intacts ferait élire un « meneur » par
 * l'ordre d'itération de la `Map` — donc au hasard, et différemment d'une machine à l'autre.
 */
const TIE_EPSILON = 0.05;

/**
 * Vigueur d'un camp : ses points de vie restants sur son total, entre 0 et 1.
 *
 * 🔴 Une FRACTION et non un décompte brut, pour deux raisons mesurées. Un camp de six Pokemon tous
 * blessés ne « mène » pas sur un camp de deux Pokemon intacts — les PV bruts diraient l'inverse. Et
 * aux formats à douze camps, où chacun n'a qu'un Pokemon, un décompte de vivants ne vaudrait que 0
 * ou 1 : aucune granularité, précisément là où la question est la plus fine.
 */
export function campStrengths(pokemon: Iterable<PokemonInstance>): Map<string, number> {
  const current = new Map<string, number>();
  const maximum = new Map<string, number>();
  for (const mon of pokemon) {
    current.set(mon.playerId, (current.get(mon.playerId) ?? 0) + Math.max(0, mon.currentHp));
    maximum.set(mon.playerId, (maximum.get(mon.playerId) ?? 0) + mon.maxHp);
  }
  const strengths = new Map<string, number>();
  for (const [playerId, total] of maximum) {
    if (total > 0) {
      strengths.set(playerId, (current.get(playerId) ?? 0) / total);
    }
  }
  return strengths;
}

/**
 * Le facteur à appliquer au sous-total de chaque cible, par camp.
 *
 * Rend une carte **vide** quand il n'y a rien à départager — un seul camp adverse, ou tous à égalité.
 * L'appelant lit alors `NEUTRAL_FACTOR` partout, donc ne change rien à son score.
 *
 * @param pokemon tous les Pokemon du combat, vivants ou non — les tombés comptent 0 et tirent la
 *   vigueur de leur camp vers le bas, ce qui est exactement ce qu'on veut dire.
 * @param selfPlayerId le camp de celui qui joue : il n'est jamais sa propre cible.
 */
export function campBiasFactors(
  pokemon: Iterable<PokemonInstance>,
  selfPlayerId: string,
): Map<string, number> {
  /*
   * 🔴 Matérialisé UNE fois, et c'est indispensable : l'appelant passe `state.pokemon.values()`, un
   * itérateur à usage unique. Le parcourir deux fois laissait le second passage vide — donc des
   * vigueurs toutes nulles, donc aucun facteur, donc un biais silencieusement MORT. Trouvé par le
   * test d'intégration du scoreur, pas par le typage : `Iterable` ne dit pas « réutilisable ».
   */
  const all = [...pokemon];
  const alive = all.filter((mon) => mon.currentHp > 0);
  const enemyCamps = new Set(
    alive.filter((mon) => mon.playerId !== selfPlayerId).map((mon) => mon.playerId),
  );
  // Un seul camp adverse : il est à la fois le meneur et le traînard, donc il n'y a pas de rang.
  // C'est la garde qui rend TOUT format à deux camps strictement inchangé.
  if (enemyCamps.size < 2) {
    return new Map();
  }

  const strengths = campStrengths(all);
  const enemyStrengths = [...enemyCamps]
    .map((playerId) => ({ playerId, strength: strengths.get(playerId) ?? 0 }))
    .sort((left, right) => right.strength - left.strength);

  const leader = enemyStrengths[0];
  const trailer = enemyStrengths[enemyStrengths.length - 1];
  if (leader === undefined || trailer === undefined) {
    return new Map();
  }
  if (leader.strength - trailer.strength < TIE_EPSILON) {
    return new Map();
  }

  const factors = new Map<string, number>();
  factors.set(leader.playerId, LEADER_FACTOR);
  factors.set(trailer.playerId, TRAILER_FACTOR);
  return factors;
}

/** Le facteur d'un camp, ou la neutralité si rien ne le désigne. */
export function campFactorOf(factors: ReadonlyMap<string, number>, playerId: string): number {
  return factors.get(playerId) ?? NEUTRAL_FACTOR;
}
