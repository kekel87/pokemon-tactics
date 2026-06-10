# Debugger — Connaissances acquises

> Lire en premier. Mettre a jour apres chaque session.

## Architecture core — points d'entree pour le debugging

### Flux d'une action
1. `BattleEngine.submitAction()` -> valide -> execute move/useMove -> emet events
2. Les events sont types via `BattleEventType` enum
3. Les effets sont traites par `effect-processor.ts` via des handlers enregistres
4. Le pipeline de tour : `TurnPipeline` avec phases StartTurn -> Action -> EndTurn

### Fichiers cles par categorie de bug

| Categorie | Fichiers |
|-----------|----------|
| Degats incorrects | `battle/damage-calculator.ts`, `battle/effect-processor.ts`, donnees move dans `packages/data/` |
| Portee/ciblage | `grid/targeting.ts`, `grid/Grid.ts`, `battle/BattleEngine.ts` (getReachableTiles, getValidTargetPositions) |
| Statuts | `battle/handlers/status-tick-handler.ts`, `battle/handlers/seeded-tick-handler.ts`, `battle/handlers/trapped-tick-handler.ts` |
| Ordre des tours | `battle/TurnManager.ts`, `battle/initiative-calculator.ts` |
| Pathfinding | `grid/Grid.ts` (getNeighbors), `battle/BattleEngine.ts` (getReachableTiles BFS) |
| Fin de combat | `battle/BattleEngine.ts` (checkVictory, handleKo) |
| Moves defensifs | `battle/handlers/defensive-clear-handler.ts`, `battle/effect-processor.ts` (activeDefense) |

### Commandes de diagnostic

```bash
# Tests cibles sur un fichier
pnpm vitest run packages/core/src/battle/BattleEngine.test.ts

# Tests par pattern de nom
pnpm vitest run -t "knockback"

# Tous les tests avec verbose
pnpm test -- --reporter=verbose
```

## Gotchas connus

- `getReachableTiles` est prive dans BattleEngine — utiliser `getReachableTilesForPokemon` (public) pour tester
- Les mocks Pokemon sont dans `packages/core/src/testing/` — toujours utiliser `MockBattle` et `MockPokemon`
- `buildMoveTestEngine` dans `testing/build-move-test-engine.ts` est le helper pour les tests de moves
- Le random est seede via `RandomFn` — pour reproduire un bug, capturer la seed

## Patterns de bugs recurrents

(A remplir au fil des sessions)

## Seeds et scenarios de reproduction utiles

(A remplir)
