# Plan 192 — Infobulle d'attaque : modificateurs contextuels

- **Statut** : `done` (2026-08-27)
- **Origine** : entrée « MoveTooltip — afficher modifiers contextuels » de `docs/backlog.md` (2026-05-13). Reprise le 2026-08-27 sur demande de l'humain (« finir ça avant la release »).

## 1. La question de l'humain, qui a redéfini le périmètre

Ma première proposition découpait le travail en « météo / + terrain / + objets ». L'humain a refusé de trancher et a demandé : **« on affiche déjà la puissance avec les malus (burn) ? »**

Réponse mesurée : **non**. Il y avait deux surfaces, pas trois.

| Surface | Quand | Ce qu'elle montrait |
|---|---|---|
| **Infobulle** (survol) | avant de choisir | `Puis 90` / `Préc 70` — valeurs brutes de la fiche, **aucun** contexte |
| **Prévision** (confirmation, cible choisie) | après avoir choisi | dégâts min–max, verdict K.O., précision et critique effectifs, puces de modificateurs |

Et la brûlure **est** appliquée dans le calcul réel (`damage-calculator.ts`, dégâts physiques ÷2 hors Cran et `ignoresBurnAttackDrop`).

**Ce que la question a révélé** : mon découpage était sur le mauvais axe. La brûlure est **côté attaquant**, donc aussi indépendante de la cible que la météo. Le clivage qui compte n'est pas la nature du modificateur, c'est **de quoi il dépend** :

- **Indépendant de la cible** → affichable au survol : météo, champ sous le lanceur, Chargeur, Coup d'Main, brûlure, morphe de move (Météore, Vibrav'Roc).
- **Dépendant de la cible** → reste dans la prévision : efficacité de type, esquive, murs, défense adverse, orientation, hauteur, Analyste.

C'est exactement le piège qui avait fait abandonner l'« efficacité contextuelle par move » le 2026-08-03 : elle exigeait une **cible de référence collante**. Le premier groupe n'a pas ce problème — d'où la faisabilité.

## 2. Architecture — une source unique, pas une troisième

`resolveDamageContext` (`damage-context.ts`) porte un commentaire qui raconte son propre passé : la prévision et le vrai coup calculaient le contexte **deux fois, à la main**, et avaient **déjà dérivé** (la prévision ignorait la morphe météo de Météore, la pénalité de pluie de Lance-Soleil, le Chargeur, Coup d'Main, Garde Amie). Recalculer une troisième fois pour l'infobulle aurait rejoué la même faute.

Donc : extraction de **`resolveCasterMoveContext`**, le sous-ensemble caster-only, que `resolveDamageContext` **consomme**. Une seule source pour les trois usages.

L'accès passe par **`BattleEngine.previewCasterMoveContext(pokemonId, moveId)`**, sur le modèle de `previewMoveCtCost` juste à côté : le moteur détient le registre de talents (donc Cran et les talents qui neutralisent la météo), et le faire passer par lui évite d'exposer ce registre à la présentation.

**Les causes sont produites par le core**, pas redérivées par la vue : le core a déjà la météo effective après talents, le champ sous le lanceur et les volatiles sous la main. `CasterMoveCause` est une union discriminée (`weather` / `field-terrain` / `helping-hand` / `charge` / `move-morph`) que `view-core` mappe vers des clés i18n.

## 3. La brûlure n'est PAS pliée dans la puissance

Décision de présentation, prise en écrivant le code : la brûlure divise la **statistique d'Attaque** du lanceur, pas la **puissance** du move. Écrire « Puis 100 → 50 (Brûlure) » aurait menti sur la grandeur concernée.

Elle mérite quand même sa place, parce qu'elle **change le classement entre un move physique et un move spécial** — c'est bien une information de choix. Elle est donc affichée comme **mention distincte** (« Brûlure : dégâts physiques ÷2 »), à côté des chiffres, jamais dedans.

## 4. Ce qui a été livré

| Paquet | Fichier | Rôle |
|---|---|---|
| `core` | `damage-context.ts` | `CasterMoveContext`, `CasterMoveCause`, `resolveCasterMoveContext` ; `resolveDamageContext` le consomme |
| `core` | `BattleEngine.ts` | `previewCasterMoveContext(pokemonId, moveId)` |
| `render-ports` | `ports.ts` | `MoveContextualView`, `ContextualStat`, champ `contextual` sur `AttackSubmenuMoveView` |
| `view-core` | `move-contextual-view.ts` | `buildMoveContextualView` — met le contexte en mots, renvoie `null` quand il n'y a rien à dire |
| `view-core` | `battle-orchestrator.ts` | construit la vue par move du sous-menu |
| `ui-dom` | `move-tooltip.ts` + `.css` | fiche barrée + valeur effective colorée par son sens, ligne de causes, mention de brûlure |
| `app` | `i18n` | 4 clés (`moveContext.charge`, `.helpingHand`, `.effective`, `.burnHalves`) |

Rendu obtenu :

```
Puis  ̶9̶0̶  135      ← vert (le contexte améliore)
Préc  ̶7̶0̶  100
ici : Soleil · Brûlure : dégâts physiques ÷2
```

Les tons reprennent `data-tone="buff"/"danger"`, la convention **déjà présente dans `move-tooltip.css`** pour ses puces — pas un jeu de couleurs maison.

## 5. Vérification

| Suite | Résultat |
|---|---|
| `damage-context.test.ts` (nouveau) | 5 ✅ — temps clair sans cause, multiplicateur du Soleil, précision imposée par la Neige, brûlure physique vs spéciale |
| `move-contextual-view.test.ts` (nouveau) | 8 ✅ — null quand rien à dire, cumul des multiplicateurs, précision seule, brûlure seule, traduction des causes, move de statut ignoré |
| Unitaires | 3942 → **3955** ✅ |
| Intégration | 388 ✅ |

Les 3942 tests d'origine passent sans retouche : l'extraction est **strictement** préservatrice de comportement.

## 6. Un mock désynchronisé, pris la main dans le sac

Ajouter `previewCasterMoveContext` à l'engine a cassé 7 tests de `battle-orchestrator.test.ts` avec `TypeError: this.engine.previewCasterMoveContext is not a function` — le mock d'engine ne suivait pas son interface.

Le typecheck ne l'avait **pas** vu, parce que les `*.test.ts` sont exclus des `tsconfig`. C'est-à-dire : la démonstration en direct de la dette du plan 193, découverte en travaillant sur un autre chantier. Notée ici parce que c'est le genre de coïncidence qui justifie un chantier mieux que n'importe quel argument.

## 7. Reste ouvert

- **Objets tenus** (Charbon, Magnet…) : non inclus. Ils sont caster-only et rentreraient dans le cadre, mais chacun est un cas à câbler et le périmètre actuel se suffit. Le point d'extension est `resolveCasterMoveContext`.
- **Bonus de puissance de terrain ×1.15** (`getFieldTerrainMovePowerMultiplier`) : **exclu à raison** — sa signature exige la cible et ses types, il n'a rien à faire dans une infobulle sans cible. Seul `getFieldTerrainBpMultiplier` (caster-only) est pris en compte.
- **e2e** : aucun scénario ne vérifie encore l'infobulle sous météo. Les deux suites unitaires couvrent le calcul et la mise en mots ; le rendu reste à épingler.
