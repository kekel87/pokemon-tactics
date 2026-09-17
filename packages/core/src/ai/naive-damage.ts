import { getEffectivePowerFloor } from "../battle/dynamic-power-system";
import type { DamageEstimate } from "../types/damage-estimate";
import type { MoveDefinition } from "../types/move-definition";

/**
 * Ce que lit une IA qui n'estime PAS les dégâts — les trois seuls champs que le scorer consulte sur un
 * `DamageEstimate`.
 *
 * Dérivé de `DamageEstimate` et non redéclaré : les deux doivent rester structurellement liés, pour
 * qu'un ternaire `readsDamage ? engine.estimateDamage(…) : readNaiveDamage(…)` reste typable le jour
 * où le moteur renommera un de ces champs.
 */
export type DamageReading = Pick<DamageEstimate, "min" | "max" | "effectiveness">;

/**
 * Coefficient de la formule de dégâts du jeu au niveau 50 : `(2 × 50 / 5 + 2) / 50 = 0,44`, appliqué à
 * la puissance. Il vit ici en double de `damage-calculator.ts` À DESSEIN : le modèle naïf n'est pas un
 * appel au moteur qu'on aurait dégradé, c'est une formule à part, et les deux doivent pouvoir bouger
 * indépendamment.
 */
const LEVEL_50_POWER_COEFFICIENT = 0.44;

/** Terme constant de la même formule. */
const FLAT_TERM = 2;

/**
 * Dégâts tels que les estime une IA qui ne sait rien de sa cible (plan 214, palier Facile).
 *
 * 🔴 **C'est la formule du jeu avec un adversaire MOYEN** : rapport Attaque/Défense figé à 1, aucun
 * STAB, aucune efficacité de type, aucun talent, aucun objet, aucun cran de stat, aucun modificateur
 * de hauteur / terrain / dos / météo / mur. Le résultat ne dépend donc QUE de la puissance du move.
 *
 * Objectif posé par l'humain (2026-09-17) : « un gamin, c'est plutôt *Dracaufeu, il faut des grosses
 * flammes*, même contre un Onix ». Une IA qui lit ça choisit ses attaques par leur gros chiffre, se
 * trompe de type au vu et au su du joueur, et cogne dans une immunité sans la voir venir.
 *
 * ⚠️ `effectiveness` vaut 1 et **jamais 0** : c'est ce qui fait disparaître, pour ce palier, la garde
 * « efficacité nulle → action rejetée ». L'erreur doit être JOUÉE pour être visible ; une IA qui
 * s'abstient d'attaquer dans le vide révèle qu'elle a lu la table des types.
 *
 * ⚠️ Pourquoi pas simplement zéro dégât estimé, ce que la formulation « qu'elle n'estime pas du tout »
 * suggérait : parce que le poids `killPotential` (10) est le terme dominant du scorer. Le mettre à
 * zéro ne rend pas l'IA naïve, ça la rend passive — elle se remettrait à empiler des montées de stats
 * devant un adversaire à trois PV, exactement la boucle qu'on vient de corriger. Une estimation
 * grossière garde l'IA agressive tout en la rendant aveugle.
 *
 * ⚠️ **Périmètre décidé, pas oublié** (revue de code du 2026-09-17). Ce modèle est branché sur les
 * chemins GÉNÉRIQUES — l'attaque (`scoreDamagingMove`), la case d'où frapper
 * (`evaluateAttacksFromPosition`), la garde anti-préparation (`canSecureKoNow`) et Tout ou Rien
 * (`scoreFinalGambit`) — soit l'écrasante majorité des tours. Les scorers SPÉCIALISÉS d'un move rare
 * (Poursuite, Explosion, l'éjection par recul, la valeur de frappe d'un allié) gardent l'estimation
 * exacte du moteur : les brancher tous coûterait de faire descendre les capacités dans une vingtaine
 * de signatures pour un effet que le joueur ne verrait que sur un move sur cent.
 *
 * Même raisonnement pour `threat-detection` : tous les paliers continuent de classer les menaces avec
 * le calcul exact. Savoir QUI fait peur est une autre faculté qu'estimer SON PROPRE coup, et ça
 * n'oriente que des multiplicateurs, jamais le choix affiché.
 */
export function readNaiveDamage(move: MoveDefinition): DamageReading | null {
  const power = getEffectivePowerFloor(move);
  if (power <= 0) {
    return null;
  }
  const guess = Math.round(LEVEL_50_POWER_COEFFICIENT * power + FLAT_TERM);
  // `min` et `max` confondus : une fourchette supposerait une lecture du jet de dégâts, que ce palier
  // n'a pas. Le scorer s'en sert pour le K.O. (`min`) et pour le dégât partiel (`max`) — un seul
  // nombre pour les deux, qui est bien tout ce que l'IA « sait ».
  return { min: guess, max: guess, effectiveness: 1 };
}
