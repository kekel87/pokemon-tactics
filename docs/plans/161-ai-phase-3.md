# Plan 161 — Passe IA Phase 3 (dernières familles différées)

> **Statut** : done
> **Créé** : 2026-07-14
> **Clôturé** : 2026-07-14
> **Décision humain** : « aller on finit l'IA » — clore TOUTES les familles d'heuristiques encore différées après les plans 159/160. 1 commit final.
> **Suite de** : plan 160 (Phase 2). Toutes les modifs dans `packages/core/src/ai/action-scorer.ts` (scorer pur, pas de nouveau chemin moteur).

## Périmètre (reliquat plan 160, ligne 111)

| Famille | État avant | Action |
|---|---|---|
| Stat/state manip (146) — Boost/Renversement/Permu* | garde-fou 0/négatif (jamais valorisé) | **valorisation nette réelle** |
| Buée Noire (`haze` → ResetStatStages zone) | scoré 0 (chemin générique inerte) | **branche dédiée** (bilan signé team-agnostic) |
| Bain de Smog (`clear-smog`) | dégâts scorés, reset ignoré | bonus reset sur cible boostée |
| item-interaction util (142) — Recyclage (`recycle`) | 0 (self, sans branche) | branche : +statChanges si objet consommé |
| item-interaction util (142) — Calcination (`incinerate` BurnTargetItem) | dégâts seuls | ajout à la liste item-manip |
| pièges purs — Barrage/Regard Noir (`block`/`mean-look`) | statut générique plat | bonus épinglage menace n°1 |
| Attraction (`attract`, 154) | garde-fou + statut plat | threat mult (infatuer le sweeper) |
| Cognobidon (`belly-drum`, 154) | headroom + garde HP | + garde anti-mort (`wouldKoUs`) |
| crit-manip Batch A (151) | **déjà fait** (Puissance/Affilage/Cri Draconique dans le scorer, plan 159) | rien |
| Gaz Corrosif (`corrosive-gas` RemoveItem) | **déjà couvert** (hasItemManip) | rien |
| objets légers (158) | passifs neutres pour l'IA | rien |

## Détail implémentation

- **`scoreStatManip`** réécrit : gain net signé (`sumStatStages(cible) − sumStatStages(soi)`), positif quand la cible est mieux lotie, `−statChanges` sinon ; ×1.5 sur la menace n°1. Couvre Copy (Boost) / Invert (Renversement) / SwapStatStages (Permugarde/Permuforce/Permucœur) / SwapRawSpeed (Permuvitesse, borné `min(3, gap/30)`).
- **`scoreHazeReset`** (nouveau) : diamant r3, `net += (allié ? −sum : +sum)` par mon vivant en zone ; `−1` si bilan ≤ 0. Routé en amont sur `ResetStatStages` avec `area` défini (Buée Noire) ; `clear-smog` (sans `area`) reste sur le chemin dégâts + bonus reset.
- **Recyclage** : branche dans `scoreSelfMove` (`consumedItemId !== undefined ? statChanges : −1`).
- **Calcination** : `BurnTargetItem` ajouté à la condition `hasItemManip`.
- **Attraction** : après le garde-fou de validité, `+statChanges × 0.8` si la cible touchée est la menace n°1.
- **Barrage/Regard Noir** : `+statChanges` par cible = menace n°1 non déjà piégée (gate `positionLinked === true` pour n'attraper que les pièges purs, pas les pièges partiels à dégâts).
- **Cognobidon** : `scoreBellyDrum` prend `enemies`/`engine`, `−1` si `wouldKoUs` (on mourrait avant de profiter du +6).

## Tests

`action-scorer.test.ts` — describe « Phase 3 heuristics (plan 161) » : Boost/Renversement (positif boosté / négatif débuffé), Permuforce, Buée Noire (positif zone boostée / négatif zone propre), Recyclage (objet consommé vs non), Attraction (sexe opposé vs même sexe), Cognobidon (rejet si KO imminent vs valorisé si sûr).

## Résultats de validation

- **Typecheck** : vert.
- **Tests core** : **3442 verts** (3099 unit dont +7 nouveaux, 343 intégration), zéro régression.
- **e2e Playwright** : bloqué (harness sandbox câble `DummyAiController`, le scorer ne tourne pas — cf. `docs/next.md`).
- **Human-testing** : non praticable en l'état pour l'IA (même blocage harness).

## Portée close

**Toutes** les familles d'heuristiques IA de la roadmap sont désormais traitées (plans 159 → 160 → 161). Restes hors périmètre IA-scoring : immunité de type structurelle dans `estimateDamage` (approx côté scorer), mémoire de cible / anti-oscillation (changement d'archi), e2e des heuristiques (dépend d'un mode harness `dummyControl: "scored"`).
