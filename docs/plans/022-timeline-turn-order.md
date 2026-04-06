---
status: done
created: 2026-03-31
updated: 2026-03-31
---

# Plan 022 — Refonte timeline turn order

## Objectif

Revoir l'ordre d'affichage de la `TurnTimeline` pour distinguer visuellement les Pokemon qui ont déjà joué ce round de ceux qui n'ont pas encore joué, avec un séparateur indiquant le prochain round et un ordre prédit basé sur l'initiative effective actuelle.

## Contexte

La timeline actuelle affiche les Pokemon dans l'ordre du turn order sans distinction entre "déjà joué ce round" et "pas encore joué". Avec 12 Pokemon en 6v6, la lecture de l'ordre des tours est confuse. L'humain a validé un design en deux sections séparées par un séparateur visuel `══ Round N+1 ══`, inspiré des jeux tactiques (FFT/FFTA).

Ce plan suit le plan 021 (offsets sprites) et précède les améliorations de gameplay Phase 1.

## Étapes

- [x] Étape 1 — Core : ajouter `predictedNextRoundOrder` dans `BattleState`
  - Dans `packages/core/src/battle/battle-state.ts` : ajouter le champ `predictedNextRoundOrder: string[]` à l'interface `BattleState`
  - Dans `packages/core/src/battle/battle-engine.ts`, méthode `syncTurnState()` : calculer `predictedNextRoundOrder` en filtrant les Pokemon vivants (`!pokemon.isKo`), triés par `getEffectiveInitiative(pokemon)` décroissant, tie-break par `pokemon.id` alphabétique
  - `getEffectiveInitiative` est déjà utilisé dans `TurnManager` — vérifier s'il est accessible depuis `BattleEngine` ou l'extraire dans un helper partagé (`packages/core/src/battle/turn-manager.ts` ou `initiative.ts`)
  - Écrire des tests unitaires dans un fichier dédié ou dans le test existant de `BattleEngine` :
    - `predictedNextRoundOrder` contient tous les Pokemon vivants triés par initiative décroissante
    - Un Pokemon KO est absent de `predictedNextRoundOrder`
    - Tie-break par ID : deux Pokemon à même vitesse sont triés alphabétiquement par ID
    - L'ordre prédit change si l'initiative effective change (ex : paralysie réduit la Vitesse effective)

- [x] Étape 2 — Renderer : réécrire `TurnTimeline.update()`
  - Lire `packages/renderer/src/ui/TurnTimeline.ts` pour comprendre la structure actuelle avant de toucher quoi que ce soit
  - Identifier les Pokemon qui ont déjà joué ce round : ceux présents dans `battleState.turnOrder` mais absents de `battleState.remainingTurnOrder` (ou équivalent selon l'implémentation actuelle — vérifier dans `BattleState`)
  - Construire l'ordre d'affichage vertical :
    1. **Pokemon actif** : `battleState.currentTurnPokemonId` — bordure jaune, taille active (48px comme actuellement)
    2. **Restants ce round** : `battleState.remainingTurnOrder` sans le premier (Pokemon actif) — dans l'ordre du turn order
    3. **Séparateur** `══ Round N+1 ══` — uniquement si au moins un Pokemon a déjà joué ce round (section basse non vide)
    4. **Déjà joués** : filtrer `battleState.predictedNextRoundOrder` pour ne garder que les Pokemon ayant déjà joué ce round — dans l'ordre prédit
  - Premier tour du round complet (personne n'a joué) : pas de séparateur, pas de section basse
  - Styling du séparateur : ligne horizontale grise + texte centré `══ Round X ══` (Phaser `Text` ou `Graphics`)
  - Ajuster la taille des entrées inactives pour que 12 portraits + le séparateur tiennent dans la hauteur du canvas sans déborder sur l'`InfoPanel`
    - Cible : hauteur totale ≤ canvas height − position Y de départ de la timeline
    - Taille portrait inactif actuelle : 42px — réduire si nécessaire (minimum 32px pour lisibilité)
    - Espacer les sections : petit gap supplémentaire avant et après le séparateur

- [x] Étape 3 — Test visuel
  - Lancer le dev server (`pnpm --filter renderer dev`) et vérifier avec `?random` pour placement instantané
  - Scénario A — Début de round : tous les Pokemon en section haute, pas de séparateur
  - Scénario B — Mi-round : quelques Pokemon en section basse, séparateur visible avec le bon numéro de round
  - Scénario C — Fin de round (dernier Pokemon actif) : toute la section basse remplie, un seul en section haute
  - Scénario D — KO en cours de round : le Pokemon KO disparaît de la timeline (comportement existant conservé)
  - Scénario E — Paralysie appliquée : vérifier que l'ordre prédit de la section basse change si un Pokemon est paralysé (initiative réduite)
  - Vérifier l'absence de chevauchement avec l'`InfoPanel` (qui occupe le bas gauche)

## Critères de complétion

- La timeline affiche deux sections visuellement distinctes (avant / après le séparateur)
- Le séparateur `══ Round N+1 ══` n'apparaît que quand au moins un Pokemon a déjà joué
- Le numéro de round dans le séparateur est correct (round actuel + 1)
- L'ordre prédit de la section basse reflète l'initiative effective (paralysie visible dans la prédiction)
- 12 portraits + séparateur tiennent dans la hauteur du canvas sans déborder
- Aucune régression sur la section haute (Pokemon actif bordure jaune, restants dans l'ordre)
- Pokemon KO absents des deux sections
- `BattleState.predictedNextRoundOrder` a des tests unitaires couvrant les cas nominal, KO et tie-break
- `pnpm build` passe sans erreurs TypeScript

## Risques / Questions

- `remainingTurnOrder` : vérifier que `BattleState` expose bien le sous-ensemble de Pokemon n'ayant pas encore joué ce round. Si ce n'est pas le cas, il faudra l'ajouter au même titre que `predictedNextRoundOrder`.
- Hauteur de la timeline : avec 12 Pokemon + séparateur, les 42px actuels par entrée sont trop grands (~600px de contenu). Trouver un bon compromis entre lisibilité et compacité — les portraits doivent rester identifiables.
- `getEffectiveInitiative` : cette fonction est peut-être dans `TurnManager` et non exportée. Si elle est privée, l'extraire dans un fichier `initiative.ts` partagé plutôt que de la dupliquer.
- Stabilité du tie-break par ID : vérifier que les IDs des Pokemon sont stables et prévisibles (pas des UUIDs générés dynamiquement qui changeraient l'ordre entre les rounds).

## Dépendances

- **Avant** : Plan 021 terminé (done)
- **Débloque** : pas de dépendance directe identifiée — amélioration visuelle autonome
