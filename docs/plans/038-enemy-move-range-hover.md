---
status: done
created: 2026-04-05
updated: 2026-04-05
---

# Plan 038 — Afficher la portée de déplacement des ennemis au hover

## Objectif

Permettre au joueur d'évaluer les menaces ennemies en affichant, au survol d'un Pokemon ennemi, les tiles qu'il peut atteindre en un tour, avec un overlay orange distinct de l'overlay bleu allié.

## Contexte

Phase 2 — Démo jouable. Le joueur a besoin d'informations tactiques pour anticiper les mouvements adverses. La portée de déplacement est déjà calculée côté core via `getReachableTiles` (privé, appelé dans `getLegalActions`), mais cette méthode n'est pas accessible publiquement. Le renderer dispose d'une API de highlight complète (`highlightTilesWithColor`, `clearHighlights`) et le point d'entrée hover est déjà instrumenté dans `BattleScene.setupInput` (bloc `pointermove` → `getPokemonAtPosition`).

## Étapes

- [x] Étape 1 — Core : exposer `getReachableTiles` publiquement via `BattleEngine`
  - Ajouter une méthode publique `getReachableTilesForPokemon(pokemonId: string): Position[]`
  - Retourne les positions accessibles (hors position courante, hors tiles occupées par des ennemis en vie) — même logique que `getReachableTiles` privé mais sans construire les paths complets, juste les `Position[]`
  - Retourne `[]` si le Pokemon est KO, n'existe pas, ou si `battleOver`
  - Exporter la méthode dans `BattleEngine` public API
  - Ajouter un test unitaire dans `BattleEngine.test.ts` : portée correcte pour un Pokemon standard, retour vide pour KO, retour vide si bataille terminée

- [x] Étape 2 — Constantes : ajouter la couleur de l'overlay ennemi dans `constants.ts`
  - Ajouter `TILE_HIGHLIGHT_ENEMY_RANGE_COLOR = 0xdd6622` (orange) et `TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA = 0.35`
  - Ajouter `HighlightKind.EnemyRange = "enemy_range"` dans `packages/renderer/src/enums/highlight-kind.ts`
  - Mettre à jour `highlightTiles` dans `IsometricGrid` pour gérer le nouveau kind (couleur orange)

- [x] Étape 3 — GameController : implémenter la logique hover ennemi
  - Ajouter une propriété privée `hoveredEnemyRangePokemonId: string | null = null` pour tracker l'état courant et éviter les re-calculs inutiles
  - Créer une méthode privée `handleEnemyRangeHover(hoveredPokemon: PokemonInstance | null): void`
    - Si `hoveredPokemon` est null, ou est allié, ou est KO : appeler `clearEnemyRangeHighlight()` et retourner
    - Si c'est le Pokemon actif du tour en cours : pas d'overlay ennemi (c'est déjà géré par les highlights de déplacement allié), retourner
    - Si `hoveredPokemon.id === this.hoveredEnemyRangePokemonId` : rien à faire (déjà affiché)
    - Sinon : calculer `this.engine.getReachableTilesForPokemon(hoveredPokemon.id)`, afficher via `this.isometricGrid.highlightTiles(positions, HighlightKind.EnemyRange)`, mettre à jour `hoveredEnemyRangePokemonId`
  - Créer une méthode privée `clearEnemyRangeHighlight(): void` qui efface le highlight ennemi et remet `hoveredEnemyRangePokemonId` à null — **attention** : ne pas appeler `clearHighlights()` global (qui efface aussi les highlights alliés), utiliser un graphics layer dédié ou re-dessiner les highlights actifs après effacement
  - Appeler `handleEnemyRangeHover` depuis `handleTileHover` uniquement si la phase est `action_menu`, `select_move_destination` ou `select_attack_target` (pas pendant placement, animation, fin de partie)

- [x] Étape 4 — BattleScene : brancher le hover ennemi dans `setupInput`
  - Dans le bloc `pointermove`, après le calcul de `hoveredPokemon`, appeler `controller.handleEnemyRangeHover(hoveredPokemon ?? null)`
  - Quand `lastHoverGrid` devient null (curseur quitte la grille), appeler `controller.handleEnemyRangeHover(null)` pour nettoyer l'overlay
  - Vérifier que le nettoyage se fait aussi au clic (le `handleTileClick` existant déclenche déjà `clearHighlights` via les transitions d'état)

- [x] Étape 5 — Gestion des layers de highlight
  - Analyser si `clearHighlights()` dans `IsometricGrid` efface tout le `highlightGraphics` (oui, c'est le cas)
  - Pour éviter que l'overlay ennemi soit effacé lors du re-rendu des highlights alliés (ex: appel à `highlightTiles` pour le mouvement allié), ajouter un `Graphics` dédié `enemyRangeGraphics` dans `IsometricGrid` avec son propre depth (entre `DEPTH_GRID_HIGHLIGHT` et `DEPTH_GRID_PREVIEW`)
  - Ajouter `clearEnemyRangeHighlight()` et `showEnemyRange(positions)` dans `IsometricGrid`
  - Ajouter `DEPTH_GRID_ENEMY_RANGE` dans les constantes (valeur entre highlight et preview)
  - Mettre à jour `GameController` pour utiliser ces nouvelles méthodes

- [x] Étape 6 — Tests renderer et cas limites
  - Vérifier manuellement (sandbox ou partie normale) : hover ennemi → overlay orange, quitter → overlay disparaît, hover allié → pas d'overlay ennemi, hover case vide → pas d'overlay ennemi
  - Vérifier que les highlights alliés (bleu déplacement, rouge attaque) ne sont pas perturbés par l'overlay ennemi
  - Vérifier que l'overlay ennemi disparaît bien quand le tour passe à l'ennemi (transition d'état vers `animating` puis `action_menu` pour l'autre joueur)
  - Cas Pokemon KO : `getReachableTilesForPokemon` retourne `[]`, aucun overlay affiché

## Critères de complétion

- Au hover sur un Pokemon ennemi pendant son tour d'inactivité, les tiles accessibles s'affichent en orange semi-transparent
- L'overlay disparaît dès que le curseur quitte le sprite ennemi ou la grille
- Aucun overlay ennemi sur les alliés, sur le Pokemon actif du tour, sur les Pokemon KO
- Les highlights existants (bleu déplacement allié, rouge attaque AoE) ne sont pas impactés
- La méthode `getReachableTilesForPokemon` est couverte par des tests unitaires (portée correcte, KO, bataille terminée)
- `pnpm test` passe sans régression

## Risques / Questions

- **Layer de highlight partagé** : `clearHighlights()` efface tout le `highlightGraphics`. L'étape 5 introduit un layer dédié pour l'overlay ennemi — c'est le vrai travail de fond de ce plan. À traiter en priorité avant le branchement BattleScene.
- **Re-calcul à chaque frame** : le hover est déclenché à chaque `pointermove`. La propriété `hoveredEnemyRangePokemonId` sert de cache pour éviter de rappeler `getReachableTilesForPokemon` à chaque pixel déplacé sur le même sprite.
- **Phase select_direction** : pendant le choix de direction de fin de tour, faut-il afficher la portée ennemie ? Par sécurité, exclure cette phase (comportement conservateur).
- **Mode sandbox** : le dummy AI est une équipe adverse, la feature doit fonctionner identiquement — aucune adaptation nécessaire si le code utilise `playerId` pour détecter les alliés/ennemis.

## Dépendances

- Prérequis : aucun plan bloquant. Le core et le renderer sont stables.
- Ce plan débloque : potentiellement le plan de portée d'attaque ennemie au hover (feature complémentaire, non planifiée).
- Suggérer `game-designer` pour valider que l'overlay orange ne crée pas de confusion avec les overlays d'attaque existants (rouge `0xcc4444` vs orange `0xdd6622`).
