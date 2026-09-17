import type { BattleState } from "../types/battle-state";
import { BATTLE_STAT_STAGE_NAMES } from "./stat-stage-names";

/**
 * Filet anti-boucle : compte combien de fois le combat est déjà passé par la position courante.
 *
 * 🔴 Pourquoi un filet FORMEL en plus d'un scorer correct (plan 214). La cause directe du statu quo —
 * l'IA relançait des montées de stats déjà au plafond — a été corrigée dans `action-scorer.ts`, et la
 * mesure (`pnpm ai:bench`) a fait tomber les parties sans fin de 34 à 14 sur 240 en miroir. Mais
 * **Difficile contre Difficile est resté à 7 sur 40** : sur un miroir parfait, deux IA déterministes
 * jouant l'optimum symétrique se répondent indéfiniment, et aucune évaluation ne peut le garantir.
 *
 * C'est exactement pour ça que les jeux concernés posent une règle MÉCANIQUE, découplée de
 * l'intelligence :
 * - **les échecs** — triple répétition et règle des 50 coups, un simple hachage de position plus un
 *   compteur ;
 * - **Pokemon Showdown** — l'*Endless Battle Clause*, réponse rodée à notre pathologie exacte
 *   (stalling par soin ou buff répété).
 *
 * Ici le filet ne met PAS fin à la partie : il fait **jouer autre chose**. C'est l'arbitrage de
 * l'humain — « on peut pas faire en sorte que les IA ne tournent pas en boucle plutôt ? » — et il
 * garde la règle du jeu intacte : aucun verdict n'est prononcé par une horloge.
 *
 * ⚠️ **Déterminisme obligatoire.** Le multijoueur P2P rejoue l'IA à l'identique chez chaque pair
 * depuis une graine partagée. La signature ne lit donc que l'état de jeu, dans un ordre stable, et
 * jamais une horloge, un ordre d'itération de `Map` dépendant de l'insertion, ni un identifiant de
 * session.
 */
export interface RepetitionGuard {
  /**
   * Enregistre la position courante et rend le nombre de fois où elle a **déjà** été vue — 0 la
   * première fois. `pickScoredAction` s'en sert pour dévier son choix.
   */
  observe(state: BattleState): number;
}

/**
 * Signature d'une position : qui est où, à combien de PV, avec quels crans de stats.
 *
 * Trié par identifiant de Pokemon, et non dans l'ordre de la `Map` : deux pairs qui auraient inséré
 * les mêmes Pokemon dans un ordre différent doivent produire la même chaîne, sans quoi le filet se
 * déclencherait chez l'un et pas chez l'autre — une divergence silencieuse, la pire du multijoueur.
 */
function signature(state: BattleState): string {
  const morceaux: string[] = [];
  for (const mon of [...state.pokemon.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const paliers = BATTLE_STAT_STAGE_NAMES.map((stat) => mon.statStages[stat]).join(",");
    morceaux.push(`${mon.id}:${mon.position.x},${mon.position.y}:${mon.currentHp}:${paliers}`);
  }
  return morceaux.join("|");
}

/**
 * Un filet par combat. Il vit aussi longtemps que la partie : une position revue au tour 80 compte
 * comme une répétition de celle du tour 12, ce qui est bien ce qu'on veut détecter.
 */
export function createRepetitionGuard(): RepetitionGuard {
  const vues = new Map<string, number>();
  return {
    observe(state: BattleState): number {
      const cle = signature(state);
      const dejaVue = vues.get(cle) ?? 0;
      vues.set(cle, dejaVue + 1);
      return dejaVue;
    },
  };
}
