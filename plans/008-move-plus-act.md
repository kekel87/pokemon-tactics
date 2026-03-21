---
status: ready
created: 2026-03-21
updated: 2026-03-21
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

### Bugs renderer à corriger en même temps
- L'animation de déplacement n'est pas visible car le tour change trop vite (lié au fait que le tour se termine immédiatement après le move)
- Le choix de direction en fin de tour n'existe pas encore

## Étapes

### Étape 1 — Nouveau ActionKind : EndTurn

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

### Étape 2 — État du tour dans BattleEngine

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

Ajouter un état de tour interne :
```ts
private turnState: {
  hasMoved: boolean;
  hasActed: boolean;
};
```

Réinitialisé à `{ hasMoved: false, hasActed: false }` au début de chaque tour (dans `advanceTurn`, après `TurnStarted`).

### Étape 3 — Move ne termine plus le tour

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

`executeMove` :
- Déplace le Pokemon (comme avant)
- Émet `PokemonMoved` (comme avant)
- Met `turnState.hasMoved = true`
- **NE FAIT PAS** `endCurrentTurn`
- Retourne `{ success: true, events }`

### Étape 4 — UseMove ne termine plus le tour

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

`executeUseMove` :
- Exécute l'attaque (comme avant)
- Met `turnState.hasActed = true`
- **NE FAIT PAS** `endCurrentTurn`
- Retourne `{ success: true, events }`
- Exception : si un KO déclenche `BattleEnded`, le tour se termine naturellement

### Étape 5 — EndTurn termine le tour

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

Nouveau `executeEndTurn` :
- Si `direction` fournie : met à jour `pokemon.orientation`
- Appelle `endCurrentTurn` (comme avant, avec les phases EndTurn pipeline)
- Retourne les events

### Étape 6 — getLegalActions conditionnel

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

`getLegalActions` filtre selon `turnState` :
- Si `!hasMoved` et `!restrictActions` : inclure les actions Move
- Si `!hasActed` : inclure les actions UseMove
- Toujours inclure EndTurn (avec les 4 directions possibles, ou sans direction)
- Ne plus inclure SkipTurn (remplacé par EndTurn)

Le filtrage `restrictActions` (paralysie) continue de fonctionner :
- Paralysie proc → `hasMoved` forcé à `true` (ne peut pas bouger) mais peut attaquer

### Étape 7 — Adaptation des tests core

Les tests existants utilisent `SkipTurn` → remplacer par `EndTurn`.

Les tests de `executeMove` et `executeUseMove` vérifient que le tour se termine → adapter pour vérifier que le tour **ne** se termine **pas**.

Nouveaux tests :
- Move puis UseMove dans le même tour → les deux fonctionnent
- UseMove puis Move dans le même tour → les deux fonctionnent
- Move deux fois → erreur (déjà bougé)
- UseMove deux fois → erreur (déjà agi)
- EndTurn après Move → le tour se termine, le suivant commence
- EndTurn après UseMove → idem
- EndTurn sans rien faire → idem (ancien SkipTurn)
- EndTurn avec direction → orientation mise à jour
- getLegalActions après Move → pas de Move, UseMove et EndTurn disponibles
- getLegalActions après UseMove → Move et EndTurn disponibles, pas de UseMove
- getLegalActions après Move+UseMove → seulement EndTurn
- Paralysie : Move bloqué mais UseMove disponible, EndTurn disponible
- KO pendant UseMove → BattleEnded, pas besoin de EndTurn

### Étape 8 — Nouveau ActionError

**Fichier** : `packages/core/src/enums/action-error.ts`

Ajouter :
```ts
AlreadyMoved: "already_moved",
AlreadyActed: "already_acted",
```

### Étape 9 — Adapter le renderer

**Fichier** : `packages/renderer/src/game/GameController.ts`

- Après un Move : rester en `select_action`, appeler `refreshUI` pour montrer les attaques encore disponibles
- Après un UseMove : rester en `select_action`, appeler `refreshUI` pour montrer le Move encore disponible
- "Skip Turn" → "End Turn"
- EndTurn envoyé avec la direction actuelle du Pokemon (pas de UI de choix de direction pour le POC — on ajoutera les flèches directionnelles plus tard)

**Fichier** : `packages/renderer/src/ui/BattleUI.ts`

- Bouton "End Turn" au lieu de "Skip Turn"

### Étape 10 — Fix animation timing

**Fichier** : `packages/renderer/src/game/GameController.ts`

Le problème actuel : l'UI se rafraîchit avant que l'animation ne soit finie.

Avec le move+act, c'est naturellement résolu : après un Move, le tour ne change pas, donc l'animation joue et le joueur reste sur le même Pokemon. Le `refreshUI` après l'animation montrera les actions restantes du même Pokemon.

Vérifier que la queue d'animations attend bien la fin de chaque tween avant de procéder.

## Ce que ce plan ne fait PAS

- Pas de UI de choix de direction (flèches directionnelles) — le Pokemon garde sa direction actuelle ou celle de la dernière action
- Pas de "undo move" (annuler un déplacement avant d'attaquer)
- Pas d'animation de transition entre actions (on enchaîne directement)

## Impact sur les tests existants

~30-40 tests à adapter (ceux qui vérifient que Move/UseMove terminent le tour). Le pattern change de :
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
| Après étapes 1-6 | `test-writer` + `core-guardian` |
| Après étape 7 | `game-designer` pour cohérence |
| Après étape 9 | `code-reviewer` |

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

- **Dash = Move + Act** : un dash est à la fois un déplacement et une attaque. Question : après un dash, le joueur a-t-il encore droit à un Move ou un Act ? Proposition : le dash consomme l'Act (c'est un UseMove), mais le Move reste disponible (le dash est son propre déplacement, pas un Move). Sauf si le joueur a déjà bougé avant le dash — dans ce cas le dash ne peut pas re-déplacer.

  Réponse simple pour le POC : **un dash consomme l'Act**. Le Move est indépendant. Le dash déplace le Pokemon comme effet de l'attaque, pas comme un Move.

- **Status ticks et KO pendant le tour** : les status ticks se déclenchent en StartTurn. Si le Pokemon survit aux ticks, il peut Move+Act. Si un KO arrive pendant UseMove (cible tuée), le BattleEnded peut terminer le combat — pas besoin de EndTurn dans ce cas.

- **Nombre de tests impactés** : ~30-40 tests existants à adapter. Pas un risque technique, mais un volume de travail.

## Dépendances

- **Avant ce plan** : Plan 007 (renderer POC) — en cours mais le core peut être modifié indépendamment
- **Ce plan débloque** :
  - Gameplay tactique réel (positionnement + frappe)
  - UI de choix de direction (polish)
  - Undo move (quality of life)
