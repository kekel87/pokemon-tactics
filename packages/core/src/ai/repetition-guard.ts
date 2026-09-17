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
   * Enregistre la position courante et rend de quelle FORCE le filet doit dévier — 0 = rien à
   * signaler. `pickScoredAction` s'en sert pour décaler son choix dans le classement.
   *
   * Deux signaux, pris au maximum, parce qu'ils attrapent deux boucles différentes :
   *
   * 1. **La position exacte revue** — qui est où, à combien de PV, avec quels crans. Attrape les
   *    allers-retours francs.
   * 2. **L'absence de progrès** — le total des PV de tout le monde ne descend plus. Attrape les
   *    boucles que le premier signal RATE, et elles sont réelles : instrumentées au plan 214, deux
   *    Artikodin s'échangeaient Blizzard et Atterrissage à pleine vie en se déplaçant sans cesse, donc
   *    jamais deux fois la même position. Deux Lamantine à `Attaque = -6` erraient de même sans plus
   *    pouvoir se blesser.
   */
  observe(state: BattleState): number;
}

/**
 * Nombre d'actions sans le moindre point de vie perdu au-delà duquel on considère que le combat
 * n'avance plus.
 *
 * 🔴 **1000, et ce chiffre est MESURÉ, pas choisi.** Première tentative à 40 : le banc a montré une
 * RÉGRESSION — les parties sans fin sont passées de 4 à 17 en miroir, parce que le filet déviait
 * l'IA pendant des phases parfaitement normales et l'empêchait de conclure.
 *
 * Distribution relevée sur 480 parties (plus longue série sans perte de PV) :
 *
 * | | médiane | p90 | p99 | max |
 * |---|---|---|---|---|
 * | parties qui FINISSENT (n=476) | 35 | 46 | **395** | 1826 |
 * | parties BLOQUÉES (n=4) | **3847** | — | — | 3862 |
 *
 * Les deux populations sont séparées d'un facteur dix. 1000 laisse passer le p99 des parties saines
 * avec une marge de 2,5× et reste à près de 4× sous la médiane des parties bloquées. À 40 on tapait
 * au-dessous du p90 : une partie normale sur dix était sabotée.
 *
 * Même esprit que la fenêtre de grâce de l'*Endless Battle Clause* de Showdown : on laisse très
 * largement le temps de jouer avant de déclarer qu'on tourne en rond.
 */
const ACTIONS_SANS_PROGRES_TOLEREES = 1000;

/**
 * Plafond du décalage demandé par la stagnation.
 *
 * Sans lui le signal croissait sans borne et poussait l'IA de plus en plus bas dans son classement,
 * jusqu'à jouer n'importe quoi — ce qui ALLONGEAIT les parties au lieu de les conclure, et c'est la
 * moitié de ce qui a produit la régression de la première tentative. Il ne s'agit pas de mal jouer,
 * seulement de casser la symétrie.
 */
const DECALAGE_STAGNATION_MAX = 3;

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
  let pvMinimumVu = Number.POSITIVE_INFINITY;
  let actionsSansProgres = 0;

  return {
    observe(state: BattleState): number {
      const cle = signature(state);
      const dejaVue = vues.get(cle) ?? 0;
      vues.set(cle, dejaVue + 1);

      /*
       * Le total des PV ne fait que DESCENDRE dans une partie qui avance — les soins le font remonter,
       * mais jamais au-dessus du plus bas déjà atteint sans qu'un camp ait réellement encaissé depuis.
       * Comparer au minimum historique plutôt qu'au tour précédent rend donc le signal insensible aux
       * oscillations soin / dégât, qui sont exactement la boucle qu'on veut voir.
       */
      const pvTotal = totalPv(state);
      if (pvTotal < pvMinimumVu) {
        pvMinimumVu = pvTotal;
        actionsSansProgres = 0;
      } else {
        actionsSansProgres++;
      }

      const stagnation =
        actionsSansProgres > ACTIONS_SANS_PROGRES_TOLEREES
          ? Math.min(actionsSansProgres - ACTIONS_SANS_PROGRES_TOLEREES, DECALAGE_STAGNATION_MAX)
          : 0;
      return Math.max(dejaVue, stagnation);
    },
  };
}

function totalPv(state: BattleState): number {
  let total = 0;
  for (const mon of state.pokemon.values()) {
    total += Math.max(0, mon.currentHp);
  }
  return total;
}
