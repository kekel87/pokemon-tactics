# Plan 191 — Le match nul, ou sa suppression : K.O. simultanés d'une même résolution

- **Statut** : `draft` (2026-08-27) — rédigé, **non exécuté**. Décision humaine du 2026-08-27 : « grouper les K.O. d'une même résolution ».
- **Origine** : découvert par `test-writer` pendant la couverture du plan 190 (voir `docs/plans/190-i18n-journal-de-combat.md` §10). Il a écrit le test du match nul, l'a vu échouer, puis a instrumenté le moteur.
- **Séparé du plan 190 volontairement** : c'est un changement de **règle du jeu** dans le moteur, il ne pouvait pas voyager dans un commit intitulé « i18n du journal, marges 4K ».

## 1. Le constat

`winnerId: null` — le match nul — **n'a aucun chemin d'exécution**. Les quatre choses suivantes sont donc du code mort de fait :

- `battle.draw` (« Match nul ») et `battle.drawMessage` (« Double K.O. — personne ne l'emporte ! »)
- `battleLog.battleEnded.draw`
- la branche `<p class="bc-victory-message">` de `showVictory` (`packages/ui-dom/src/battle-chrome.ts`)
- le cas `playersAlive.size === 0` de `checkVictory`, dont le commentaire décrit pourtant le scénario (« une détonation de Requiem balayant les deux camps »)

Aucun test du core n'assertait le nul.

## 2. La cause racine, tracée

`checkVictory` est appelé **à la fin de chaque `handleKo`** (`packages/core/src/battle/BattleEngine.ts:3813`), et il sort immédiatement si `battleOver` est déjà vrai (L3817).

Déroulé mesuré d'une Explosion sur une cible qui meurt du coup :

| Étape | Ligne | Effet |
|---|---|---|
| 1. Dégâts appliqués à la cible, PV à 0 | ~L2190 | |
| 2. `handleKo(cible)` | L2194 | → `checkVictory` : seul le camp de l'attaquant est vivant → **vainqueur déclaré**, `battleOver = true`, `BattleEnded` **émis** |
| 3. Bloc d'auto-K.O. (`move.isExplosion`), l'attaquant est encore vivant | L2305 | PV de l'attaquant à 0 |
| 4. `handleKo(attaquant)` | L2324 | → `checkVictory` **sort à L3817** (`battleOver` déjà vrai) : le nul n'est jamais calculé |

Le premier combattant à tomber emporte la décision. Le second K.O. arrive après que le verdict soit scellé **et émis**.

## 3. Ce qui rend le correctif plus étroit qu'il n'y paraît

Une première lecture faisait craindre un chantier massif : `handleKo` est appelé depuis **11 sites** et **21 garde-fous** `this.battleOver` parsèment le moteur. Déplacer la détection de victoire en fin de résolution changerait la signification de tous ces garde-fous — la résolution continuerait après la mort du dernier combattant.

Mais les 21 garde-fous se scindent en **deux familles** :

- **Refus d'entrée** (L701, L998, L1224, L1305, L3446, L4004, L4056, L4065, L4099, L4224) — « le combat est fini, je refuse une nouvelle action / je n'avance pas le tour ». Ils lisent `battleOver` **après** la résolution : **inchangés** par ce plan.
- **Court-circuit en cours de résolution** (L2195, L2226, L2243, L2262, L2281, L2325, L2355, L3500) — « quelqu'un a gagné, j'arrête de résoudre le reste de cette action ». Ce sont eux qui portent le risque.

Observation décisive : ces court-circuits sont **placés après** le `handleKo` qu'ils suivent (voir L2324 → L2325). Donc l'auto-K.O. de l'attaquant **s'exécute déjà** ; seul ce qui vient ensuite est coupé. Il n'est donc **pas nécessaire** de retarder `battleOver` : il suffit de retarder le **verdict**.

## 4. Conception retenue

Deux changements, tous deux dans `BattleEngine` :

1. **`checkVictory` devient révisable.** Son early-exit `if (this.battleOver) return` disparaît. Il continue de poser `battleOver = true` **immédiatement** (les 21 garde-fous gardent donc leur comportement exact, y compris les court-circuits), mais il n'émet plus rien : il enregistre un `pendingOutcome`. Un appel ultérieur dans la **même résolution** ne peut que **dégrader** ce verdict — vainqueur → nul, jamais l'inverse, jamais un changement de vainqueur.
2. **`BattleEnded` est émis une seule fois, à la frontière de la résolution.** Le corps de `submitAction` part dans une méthode privée ; le `submitAction` public appelle cette méthode puis finalise (émission de `BattleEnded` depuis `pendingOutcome`, poussé dans `events`). Aujourd'hui l'événement est émis au milieu, ce qui interdit toute révision.

**Invariant à tenir** : `BattleEnded` est émis **au plus une fois par combat**, et le journal ne doit jamais afficher un vainqueur puis se corriger.

## 5. Étapes

1. ⬜ **Tests d'abord** (règle du projet pour une mécanique core). Scénario `scenarios/` : Explosion sur une cible à 1 PV, l'attaquant s'auto-K.O. → `BattleEnded` avec `winnerId: null`, **un seul** `BattleEnded` dans le journal d'événements. Plus un test de non-régression : K.O. simple → vainqueur, toujours un seul événement.
2. ⬜ Extraire le corps de `submitAction` ; poser la finalisation.
3. ⬜ Rendre `checkVictory` révisable (dégradation seule).
4. ⬜ Vérifier les 8 court-circuits un par un : aucun ne doit changer de comportement observable.
5. ⬜ Le match nul redevient atteignable → **réactiver le test e2e** que `test-writer` avait retiré, et repasser la case 👁 de `docs/test-plan.md` §4.10 en 🤖.
6. ⬜ Gate complet, `core-guardian`, `game-designer` (c'est une règle du jeu qui change).

## 6. Risques

- **Le vrai risque est le double comptage** : si la finalisation s'exécute sur un chemin où `BattleEnded` avait déjà été émis, le journal affiche deux fins. Filet : l'invariant du §4, asserté par le test de l'étape 1 sur les **deux** chemins (nul et vainqueur simple).
- **Les 8 court-circuits** : la conception affirme qu'ils sont inchangés parce que `battleOver` reste posé immédiatement. À vérifier site par site (étape 4), pas à supposer.
- **Autres chemins de K.O. simultané non couverts** : Requiem, Destiny Bond (`handleKo` récursif L3713), terrain létal, pièges d'entrée. Le plan traite la **cause commune** (le verdict scellé trop tôt), mais chaque chemin mérite sa vérification — notamment Destiny Bond, où le K.O. du tueur arrive **dans** le `handleKo` de la victime et pourrait donc déjà produire un nul aujourd'hui. À mesurer avant de coder : si c'est le cas, le comportement est déjà incohérent entre deux chemins, ce qui renforce le plan.

## 7. Alternative écartée

**Supprimer le match nul** (les 3 clés + la branche `<p>` + le cas `size === 0`) appliquerait « zéro code mort » à moindre frais. Écartée par décision humaine du 2026-08-27 : un double K.O. simultané **doit** produire un nul. Conserver la trace ici, parce que c'est la porte de sortie si l'étape 4 révèle que les court-circuits ne survivent pas au changement.
