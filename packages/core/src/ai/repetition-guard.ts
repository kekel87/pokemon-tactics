import type { BattleState } from "../types/battle-state";
import { BATTLE_STAT_STAGE_NAMES } from "./stat-stage-names";

/**
 * Anti-loop net : compte combien de fois le combat est déjà passé par la position courante.
 *
 * 🔴 Pourquoi un filet FORMEL en plus d'un scorer correct (plan 214). La cause directe du statu quo —
 * l'IA relançait des montées de stats déjà au plafond — a été corrigée dans `action-scorer.ts`. Mais
 * sur un miroir parfait, deux IA déterministes jouant l'optimum symétrique se répondent indéfiniment,
 * et aucune évaluation ne peut l'exclure.
 *
 * C'est pour ça que les jeux confrontés au problème posent tous une règle MÉCANIQUE, découplée de
 * l'intelligence : les **échecs** (triple répétition, règle des 50 coups — un hachage de position plus
 * un compteur) et **Pokemon Showdown** (*Endless Battle Clause*, réponse rodée à notre pathologie
 * exacte, le stalling par soin ou buff répété).
 *
 * Ici le filet ne met PAS fin à la partie : il fait **jouer autre chose**. Arbitrage de l'humain — « on
 * peut pas faire en sorte que les IA ne tournent pas en boucle plutôt ? » — et la règle du jeu reste
 * intacte : aucun verdict n'est prononcé par une horloge.
 *
 * ⚠️ **Déterminisme obligatoire.** Le multijoueur P2P rejoue l'IA à l'identique chez chaque pair depuis
 * une graine partagée. On ne lit donc que l'état de jeu, dans un ordre stable, et jamais une horloge,
 * un ordre d'itération de `Map`, ni un identifiant de session.
 *
 * ⚠️ **Limite connue, assumée** (relevée en revue de code) : les compteurs vivent dans le contrôleur et
 * **non dans `BattleState`**, donc `exportReplay()` ne les transporte pas. Un rejeu ne reproduit la
 * même partie que parce qu'il lui présente les mêmes états dans le même ordre, ce qui reconstruit les
 * mêmes compteurs. Recréer un contrôleur en cours de partie les remettrait à zéro : `AiTeamController`
 * est construit une fois par combat et jamais remplacé.
 */
export interface RepetitionGuard {
  /**
   * Enregistre la position courante et rend de quelle FORCE le filet veut écarter le choix habituel —
   * 0 = rien à signaler. `pickScoredAction` le traduit en décalage dans son classement.
   *
   * Plafonné à {@link MAX_REPETITION_SIGNAL} : il s'agit de casser une symétrie, jamais de faire jouer
   * l'IA n'importe comment.
   */
  observe(state: BattleState): number;
}

/**
 * Plafond du signal, donc du nombre de rangs dont l'IA peut être poussée vers le bas.
 *
 * 🔴 **Mesuré, pas choisi**, et né d'un vrai défaut : sans plafond, le compteur brut atteignait 10 sur
 * une partie bloquée, ce qui décalait le choix de **8 rangs sur 341 actions** — et ne débloquait
 * toujours pas la partie. Jouer PLUS MAL ne casse pas une boucle ; jouer AUTREMENT, si.
 */
export const MAX_REPETITION_SIGNAL = 3;

/**
 * Signature d'une position : qui est où, à combien de PV, avec quels crans de stats.
 *
 * Triée par identifiant, et non dans l'ordre de la `Map` : deux pairs qui auraient inséré les mêmes
 * Pokemon dans un ordre différent doivent produire la même chaîne, sans quoi le filet se déclenche
 * chez l'un et pas chez l'autre — divergence silencieuse, la pire du multijoueur.
 *
 * Comparateur TOTAL (`-1 / 1 / 0`) et non `a < b ? -1 : 1` : un comparateur qui ne rend jamais 0 laisse
 * l'ordre des éléments égaux dépendre de l'algorithme de tri du moteur, qui diffère entre V8,
 * JavaScriptCore et SpiderMonkey. Les identifiants sont uniques aujourd'hui, mais une garantie de
 * déterminisme ne doit pas reposer sur un invariant maintenu ailleurs.
 */
function signature(state: BattleState): string {
  const parts: string[] = [];
  const sorted = [...state.pokemon.values()].sort((left, right) => {
    if (left.id < right.id) {
      return -1;
    }
    return left.id > right.id ? 1 : 0;
  });
  for (const mon of sorted) {
    const stages = BATTLE_STAT_STAGE_NAMES.map((stat) => mon.statStages[stat]).join(",");
    parts.push(`${mon.id}:${mon.position.x},${mon.position.y}:${mon.currentHp}:${stages}`);
  }
  return parts.join("|");
}

/**
 * Un filet par combat. Il vit aussi longtemps que la partie : une position revue au tour 80 compte
 * comme une répétition de celle du tour 12, ce qui est bien ce qu'on veut détecter.
 *
 * Mémoire : non-problème, mesuré en revue. La plus longue partie bloquée produit 1418 clés distinctes
 * (~305 Kio) par filet, et le pire cas absolu — 12 camps de 6 Pokemon, toutes signatures distinctes —
 * reste autour de 11 Mio pour l'ensemble des filets. Purger échangerait ce non-problème contre un
 * risque réel : une politique d'éviction qui diverge entre pairs.
 */
export function createRepetitionGuard(): RepetitionGuard {
  const seen = new Map<string, number>();

  return {
    observe(state: BattleState): number {
      const key = signature(state);
      const alreadySeen = seen.get(key) ?? 0;
      seen.set(key, alreadySeen + 1);
      return Math.min(alreadySeen, MAX_REPETITION_SIGNAL);
    },
  };
}
