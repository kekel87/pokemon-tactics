---
status: done
created: 2026-03-21
updated: 2026-03-22
---

# Plan 008 — Move + Act dans le même tour (FFTA-like)

## Objectif

Permettre à un Pokemon de **déplacer ET attaquer** dans le même tour, dans n'importe quel ordre (Move→Act ou Act→Move). Le tour ne se termine que quand le joueur choisit explicitement "End Turn". Comme en FFTA.

## Contexte

Actuellement, chaque `submitAction` termine le tour (Move, UseMove, ou SkipTurn appellent tous `endCurrentTurn`). Un Pokemon ne peut faire qu'une seule chose par tour.

En FFTA, chaque tour permet :
- **Move** (une fois) : se déplacer
- **Act** (une fois) : utiliser une capacité
- **Wait** : terminer le tour (choisir sa direction)

Ces actions sont combinables dans n'importe quel ordre. Le joueur peut aussi ne faire que Move+Wait, ou Act+Wait, ou juste Wait.

### Décisions applicables
- Décision #75 : Move+Act par tour, FFTA-like
- Décision #76 : Dash après Move autorisé (option A) — Dash consomme l'Act, pas le Move

### Bugs renderer à corriger en même temps
- ~~L'animation de déplacement n'est pas visible car le tour change trop vite~~ — déjà corrigé (plan 007)
- Le choix de direction en fin de tour n'existe pas encore

## Étapes

### Étape 1 — Remplacer SkipTurn par EndTurn + nouveaux ActionError

**Fichier** : `packages/core/src/enums/action-kind.ts`

```ts
export const ActionKind = {
  Move: "move",
  UseMove: "use_move",
  EndTurn: "end_turn",
} as const;
```

`SkipTurn` est remplacé par `EndTurn`. Un `EndTurn` sans avoir bougé ni attaqué = l'ancien SkipTurn.

**Fichier** : `packages/core/src/types/action.ts`

Ajouter le variant EndTurn avec direction optionnelle :
```ts
| { kind: typeof ActionKind.EndTurn; pokemonId: string; direction?: Direction }
```

**Fichier** : `packages/core/src/enums/action-error.ts`

Ajouter :
```ts
AlreadyMoved: "already_moved",
AlreadyActed: "already_acted",
```

**Migration SkipTurn** : remplacer toutes les occurrences de `SkipTurn` dans le core et le renderer :
- `BattleEngine.ts` : `executeSkipTurn` → `executeEndTurn`, `case ActionKind.SkipTurn` → `case ActionKind.EndTurn`, `getLegalActions` génération de l'action
- `GameController.ts` : `handleSkipTurn()` → `handleEndTurn()`, construction de l'action `EndTurn`
- `BattleUI.ts` : callback `onSkipTurn` → `onEndTurn`, label "Skip Turn" → "End Turn"

### Étape 2 — État du tour dans BattleEngine

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

Ajouter un état de tour interne :
```ts
private turnState: {
  hasMoved: boolean;
  hasActed: boolean;
};
```

Réinitialisé à `{ hasMoved: false, hasActed: false }` :
- Au début de chaque tour, **avant** l'émission de `TurnStarted`
- Dans `advanceTurn`, y compris quand un tour est sauté automatiquement (`skipAction: true` pour sommeil/gel) — le `turnState` doit être propre pour chaque Pokemon, même ceux qui ne jouent pas

### Étape 3 — Move ne termine plus le tour

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

`executeMove` :
- Vérifie `turnState.hasMoved` → si `true`, retourner erreur `ActionError.AlreadyMoved`
- Déplace le Pokemon (comme avant)
- Émet `PokemonMoved` (comme avant)
- Met `turnState.hasMoved = true`
- **NE FAIT PAS** `endCurrentTurn`
- Retourne `{ success: true, events }`

### Étape 4 — UseMove ne termine plus le tour

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

`executeUseMove` :
- Vérifie `turnState.hasActed` → si `true`, retourner erreur `ActionError.AlreadyActed`
- Exécute l'attaque (comme avant)
- Met `turnState.hasActed = true`
- **NE FAIT PAS** `endCurrentTurn`
- Retourne `{ success: true, events }`
- Exception : si un KO déclenche `BattleEnded`, le tour se termine naturellement (early return existant)

### Étape 5 — EndTurn termine le tour

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

Nouveau `executeEndTurn` :
- Si `direction` fournie : met à jour `pokemon.orientation`
- Appelle `endCurrentTurn` (comme avant, avec les phases EndTurn pipeline : drain Vampigraine, etc.)
- Retourne les events

### Étape 6 — getLegalActions conditionnel

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

`getLegalActions` filtre selon `turnState` :
- Si `!turnState.hasMoved` et `!restrictActions` : inclure les actions Move
- Si `!turnState.hasActed` : inclure les actions UseMove (y compris Dash, même si hasMoved — décision #76)
- Toujours inclure EndTurn
- Ne plus inclure SkipTurn (remplacé par EndTurn)

**`restrictActions` et `turnState` restent deux flags distincts** :
- `restrictActions` : "ce Pokemon est paralysé ce tour, il ne peut pas se déplacer ni dash" (sémantique de statut)
- `turnState.hasMoved` : "ce Pokemon a déjà utilisé son Move ce tour" (sémantique d'action)
- Filtrage Move : bloqué si `turnState.hasMoved || restrictActions`
- Filtrage Dash : bloqué si `restrictActions` (comme avant), pas par `turnState.hasMoved`

### Étape 7 — Adaptation des tests core

**Fichiers impactés** (par ordre de priorité) :
1. `BattleEngine.test.ts` — ~15 occurrences de `SkipTurn` → `EndTurn`, tests de fin de tour après Move à réécrire
2. `BattleEngine.use-move.test.ts` — assertion `TurnEnded`/`TurnStarted` après UseMove à réécrire
3. `BattleEngine.integration.test.ts` — 1 occurrence `SkipTurn`, assertions fin de tour
4. `battle-loop.integration.test.ts` — 6 occurrences `SkipTurn` → `EndTurn`

**Adaptation des tests existants d'abord**, puis écriture des nouveaux tests.

Nouveaux tests :
- Move puis UseMove dans le même tour → les deux fonctionnent
- UseMove puis Move dans le même tour → les deux fonctionnent
- Move deux fois → erreur `AlreadyMoved`
- UseMove deux fois → erreur `AlreadyActed`
- EndTurn après Move → le tour se termine, le suivant commence
- EndTurn après UseMove → idem
- EndTurn sans rien faire → idem (ancien SkipTurn)
- EndTurn avec direction → orientation mise à jour
- getLegalActions après Move → pas de Move, UseMove et EndTurn disponibles
- getLegalActions après UseMove → Move et EndTurn disponibles, pas de UseMove
- getLegalActions après Move+UseMove → seulement EndTurn
- Paralysie : Move bloqué mais UseMove disponible, EndTurn disponible
- KO pendant UseMove → BattleEnded, pas besoin de EndTurn
- Sommeil/Gel : tour sauté (`skipAction`), `turnState` propre, `getLegalActions` non consulté
- Move → Dash : le Dash part de la position post-Move (décision #76)
- KO d'un ennemi sans BattleEnded : le joueur peut encore EndTurn normalement

### Étape 8 — Adapter le renderer

**Fichier** : `packages/renderer/src/game/GameController.ts`

- Après un Move : rester en `select_action`, appeler `refreshUI` pour montrer les attaques encore disponibles
- Après un UseMove : rester en `select_action`, appeler `refreshUI` pour montrer le Move encore disponible
- `handleSkipTurn()` → `handleEndTurn()` : construit `{ kind: ActionKind.EndTurn, pokemonId, direction: currentOrientation }`
- EndTurn envoyé avec la direction actuelle du Pokemon (pas de UI de choix de direction pour le POC)
- Vérifier que la queue d'animations attend bien la fin de chaque tween avant `refreshUI`

**Fichier** : `packages/renderer/src/ui/BattleUI.ts`

- Callback `onSkipTurn` → `onEndTurn`
- Bouton "End Turn" au lieu de "Skip Turn"

## Ce que ce plan ne fait PAS

- Pas de UI de choix de direction (flèches directionnelles) — le Pokemon garde sa direction actuelle ou celle de la dernière action
- Pas de "undo move" (annuler un déplacement avant d'attaquer)
- Pas d'animation de transition entre actions (on enchaîne directement)

## Impact sur les tests existants

~20-25 tests à modifier (dont 3-4 à réécrire en profondeur). Le pattern change de :
```ts
// Avant
submitAction(move) → events contiennent TurnEnded + TurnStarted

// Après
submitAction(move) → events ne contiennent PAS TurnEnded
submitAction(endTurn) → events contiennent TurnEnded + TurnStarted
```

## Agents à lancer

| Étape | Agents |
|-------|--------|
| Après étapes 1-6 | `core-guardian` |
| Après étape 7 | `game-designer` pour cohérence |
| Après étape 8 | `code-reviewer` |

## Critères de complétion

- Un Pokemon peut Move puis UseMove dans le même tour
- Un Pokemon peut UseMove puis Move dans le même tour
- Un Pokemon peut juste EndTurn (skip)
- getLegalActions retourne les actions correctes selon l'état du tour
- EndTurn accepte une direction optionnelle
- Le renderer montre les actions restantes après chaque action partielle
- Le tour ne change qu'après EndTurn (ou BattleEnded)
- Animation de déplacement visible avant que les actions restantes s'affichent
- 100% coverage maintenu
- Tests d'intégration : combat complet avec move+act

## Risques

- **Dash = Move + Act** : Décision #76 tranchée — le Dash consomme l'Act, pas le Move. Move→Dash et Dash→Move sont autorisés. Le Dash déplace le Pokemon comme effet de l'attaque, indépendamment du Move.

- **Status ticks et KO pendant le tour** : les status ticks se déclenchent en StartTurn. Si le Pokemon survit aux ticks, il peut Move+Act. Si un KO arrive pendant UseMove (cible tuée), le BattleEnded peut terminer le combat — pas besoin de EndTurn dans ce cas.

- **Nombre de tests impactés** : ~20-25 tests existants à adapter, dont 3-4 en profondeur. Volume de travail modéré.

- **`turnState` non exposé dans `BattleState`** : le renderer ne peut pas savoir si le Pokemon a déjà bougé/agi sans appeler `getLegalActions`. Acceptable pour le POC (le renderer appelle déjà `getLegalActions` après chaque action).

## Dépendances

- **Avant ce plan** : Plan 007 (renderer POC) — en cours mais le core peut être modifié indépendamment
- **Ce plan débloque** :
  - Gameplay tactique réel (positionnement + frappe)
  - UI de choix de direction (polish)
  - Undo move (quality of life)
