---
status: done
created: 2026-04-14
updated: 2026-04-14
---

# Plan 053 — Undo déplacement

## Objectif

Permettre à un joueur d'annuler le déplacement de son Pokemon avant d'avoir attaqué. Le bouton "Déplacement" dans le menu d'action est remplacé par un bouton "Annuler déplacement" quand le Pokemon a déjà bougé mais n'a pas encore attaqué.

## Contexte

Plans 051 et 052 complétés (terrain + orientation). La mécanique Move+Act est en place depuis le plan 008. Actuellement, dès qu'un Pokemon se déplace, ce déplacement est irréversible même si aucune attaque n'a encore été lancée. FFTA propose un "Retour" avant d'agir — c'est une fonctionnalité de qualité de vie attendue dans un tactical.

Décision clé du directeur créatif : le bouton "Annuler déplacement" **remplace** le bouton "Déplacement" dans le menu d'action quand le Pokemon a bougé sans avoir attaqué. Il n'est pas ajouté en supplément.

## Étapes

- [ ] Étape 1 — Ajouter `UndoMove` dans `packages/core/src/enums/action-kind.ts`
  - Ajouter `UndoMove: "undo_move"` dans le const object `ActionKind`

- [ ] Étape 2 — Ajouter l'union variant dans `packages/core/src/types/action.ts`
  - `| { kind: typeof ActionKind.UndoMove; pokemonId: string }`
  - Aucun paramètre supplémentaire : le core sait quelle position restaurer via le snapshot

- [ ] Étape 3 — Stocker le snapshot pré-déplacement dans `BattleEngine`
  - Dans `packages/core/src/battle/BattleEngine.ts`, ajouter un champ privé `preMoveSnapshot: { position: Position; orientation: Direction; hadBurn: boolean } | null = null`
  - Dans `executeMove()`, juste avant de modifier `pokemon.position`, stocker `{ position: { ...pokemon.position }, orientation: pokemon.orientation, hadBurn: pokemon a déjà le statut Burned }` dans `this.preMoveSnapshot`
  - Réinitialiser `this.preMoveSnapshot` à `null` à chaque début de tour dans `advanceTurn()` (là où `turnState` est resetté)

- [ ] Étape 4 — Exposer `undo_move` dans `getLegalActions()`
  - Dans `getLegalActions()`, après le bloc `if (!this.turnState.hasMoved && ...)` pour `Move`, ajouter :
    ```
    if (this.turnState.hasMoved && this.preMoveSnapshot !== null) {
      actions.push({ kind: ActionKind.UndoMove, pokemonId: currentPokemonId });
    }
    ```
  - `undo_move` n'est **pas** disponible si `preMoveSnapshot` est `null` (vidé par l'attaque si Move→Attack, ou non créé si confusion/dash)
  - **Move→Attack** : le snapshot est vidé dans `executeUseMove`, pas d'undo (l'attaque dépendait de la position)
  - **Attack→Move** : le snapshot reste, undo disponible (l'attaque était depuis la position d'origine)

- [ ] Étape 5 — Implémenter `executeUndoMove()` dans `BattleEngine`
  - Créer une méthode privée `executeUndoMove(pokemon: PokemonInstance): ActionResult`
  - Restaurer `pokemon.position` et `pokemon.orientation` depuis `this.preMoveSnapshot`
  - Mettre à jour `this.grid` : `setOccupant(destination, null)` puis `setOccupant(origin, pokemon.id)`
  - Si le Pokemon a le statut Burned et `preMoveSnapshot.hadBurn === false`, retirer le statut Burned (il a été appliqué par le terrain Magma durant ce déplacement)
  - Émettre un nouvel événement `BattleEventType.MoveCancelled` avec `{ pokemonId, position: preMoveSnapshot.position }`
  - Réinitialiser `this.turnState.hasMoved = false` et `this.preMoveSnapshot = null`
  - Brancher dans `submitAction()` : case `ActionKind.UndoMove` → `executeUndoMove(pokemon)`

- [ ] Étape 6 — Ajouter `MoveCancelled` dans `packages/core/src/enums/battle-event-type.ts`
  - `MoveCancelled: "move_cancelled"`

- [ ] Étape 7 — Ajouter le type de l'événement dans `packages/core/src/types/battle-event.ts`
  - Chercher le pattern des autres événements positionnels (ex: `PokemonMoved`) et ajouter :
    `| { type: typeof BattleEventType.MoveCancelled; pokemonId: string; position: Position }`

- [ ] Étape 8 — Tests unitaires core dans `packages/core/src/battle/BattleEngine.test.ts`
  - Nommer la suite `describe("BattleEngine — undo_move", ...)`
  - Test 1 : après un `Move`, `getLegalActions` contient exactement un `undo_move`
  - Test 2 : après `Move` puis `UseMove`, `getLegalActions` ne contient pas `undo_move`
  - Test 3 : exécuter `undo_move` restaure la position, l'orientation et `hasMoved = false`
  - Test 4 : après `undo_move`, `getLegalActions` contient à nouveau des actions `Move` (le Pokemon peut re-bouger)
  - Test 5 : après re-déplacement suite à un undo, l'action `undo_move` est de nouveau disponible
  - Test 6 : sans déplacement préalable, `getLegalActions` ne contient pas `undo_move`
  - Utiliser `buildMoveTestEngine` ou les factories de `packages/core/src/testing/` — ne pas créer de mocks inline

- [ ] Étape 9 — Mettre à jour le renderer : `ActionMenu` dans `packages/renderer/src/ui/ActionMenu.ts`
  - Ajouter `onUndoMove` dans `ActionMenuCallbacks`
  - Modifier `ActionMenuOptions` : remplacer `canMove: boolean` par `canMove: boolean; canUndoMove: boolean`
  - Dans la méthode `show()`, remplacer la logique du bouton "Déplacement" :
    - Si `canUndoMove === true` → afficher "Annuler déplacement" (activé, callback `onUndoMove`)
    - Sinon → afficher "Déplacement" (activé si `canMove`, callback `onMove`)
  - Ajouter la clé i18n `"action.undoMove"` en FR et EN

- [ ] Étape 10 — Mettre à jour `GameController` dans `packages/renderer/src/game/GameController.ts`
  - Dans `enterActionMenu()`, calculer `canUndoMove = this.legalActions.some(a => a.kind === ActionKind.UndoMove)`
  - Passer `canUndoMove` à `actionMenu.show()`
  - Ajouter le callback `onUndoMove: () => this.handleUndoMove()`
  - Créer la méthode privée `handleUndoMove()` :
    - Trouver l'action `undo_move` dans `this.legalActions`
    - Appeler `this.engine.submitAction(action)`
    - Traiter l'événement `MoveCancelled` dans `processEvents()` : animer le sprite en retour via `movement-animation` (réutiliser le même tween de déplacement, path inversé si possible, sinon téléportation)
    - Appeler `this.refreshUI()` après l'animation

- [ ] Étape 11 — Gérer l'animation de retour dans `processEvents()`
  - Dans la section `case BattleEventType.MoveCancelled:` de `processEvents()`, récupérer le sprite du Pokemon et animer un déplacement vers `event.position`
  - Si le chemin retour n'est pas stocké dans l'événement, se téléporter directement à la position (simple `setPosition` sur le sprite via les helpers iso existants) — acceptable pour v1
  - Mettre à jour la direction du sprite avec `event.position` (orientation restaurée)

- [ ] Étape 12 — Ajouter les clés i18n dans les fichiers de locales
  - `packages/renderer/src/i18n/locales/fr.ts` : `"action.undoMove": "Annuler déplacement"`
  - `packages/renderer/src/i18n/locales/en.ts` : `"action.undoMove": "Undo Move"`
  - Ajouter la clé dans le type `Translations` (`packages/renderer/src/i18n/types.ts`)

## Critères de complétion

- `getLegalActions()` retourne `undo_move` si et seulement si `hasMoved && !hasActed && preMoveSnapshot !== null`
- `submitAction({ kind: "undo_move", ... })` restaure position, orientation et `hasMoved = false` sans erreur
- Le menu d'action affiche "Annuler déplacement" à la place de "Déplacement" quand `undo_move` est disponible
- Le Pokemon animé revient visuellement à sa position d'origine
- Tous les tests unitaires de l'étape 8 passent
- `pnpm build && pnpm lint && pnpm typecheck && pnpm test` sans erreur

## Risques / Questions

- **Magma burn sur undo** : si un Pokemon traverse une tile Magma et se fait brûler, puis annule son déplacement, le statut Burned est retiré (via le flag `hadBurn` dans le snapshot). Cohérent : l'undo annule tout ce que le déplacement a causé.
- **Confusion + undo** : un mouvement déclenché par la confusion (`executeConfusedMove`) ne stocke pas de `preMoveSnapshot` → `undo_move` non disponible après confusion. Comportement cohérent : on ne peut pas annuler ce qu'on n'a pas choisi.
- **Dash moves** : les moves de type Dash (Quick Attack, Volt Tackle, Rollout) ne consomment pas `hasMoved` → pas de `preMoveSnapshot` → pas d'`undo_move`. Correct.
- **Animation retour** : en v1, si le chemin de retour n'est pas connu, le sprite se téléporte. L'étape 11 peut évoluer vers une animation avec path inversé dans une itération future.
- **Replay déterministe** : `undo_move` est loggué dans `recordedActions` comme toute autre action → le replay reste déterministe.
- **IA** : l'IA (scored-ai, aggressive-ai) ne génère jamais d'`undo_move` pour l'instant — les AIs sélectionnent des actions parmi `getLegalActions` mais ne savent pas exploiter l'undo. Pas de régression : une IA qui ne sélectionne pas `undo_move` reste valide.

## Dépendances

- Requiert les plans 008 (Move+Act), 028 (replay déterministe) — tous deux `done`
- Ce plan débloque éventuellement : undo de l'attaque (hors scope), tutoriel interactif (plan futur)
