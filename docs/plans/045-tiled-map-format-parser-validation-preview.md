---
status: done
created: 2026-04-08
updated: 2026-04-08
---

# Plan 045 — Format de carte Tiled + parser + validation + preview

## Objectif

Supporter les cartes Tiled JSON (.tmj) comme format de carte principal : parser qui convertit en `MapDefinition`, validation avec messages d'erreur clairs, et mode preview pour visualiser une carte sans combat.

## Contexte

Les plans 043-044 ont mis en place le tileset isométrique et le mode pixel art. La Phase 3 peut maintenant avancer sur les vraies cartes : l'éditeur Tiled génère des .tmj, l'agent `level-designer` en génère aussi programmatiquement. Il faut un pipeline pour charger ces fichiers dans le moteur sans passer par une conversion à la compilation.

Le core ne connaît pas Tiled — il ne voit que `MapDefinition`. Le parser est la couche de traduction, dans `packages/data`, sans dépendance Phaser.

## Décisions arrêtées

- **Format d'entrée** : Tiled JSON export (.tmj), tileset embarqué dans le .tmj ou fichier externe .tsj (les deux supportés)
- **Parser dans packages/data** : fonction pure, zéro dépendance UI, testable unitairement
- **Pas de Phaser TilemapLayer** : on parse le JSON nous-mêmes — le renderer Iso existant (`IsometricGrid`) est déjà opérationnel
- **Chargement runtime** : fetch du .tmj au démarrage, pas de conversion build-time
- **Suppression de `isPassable`** : le terrain détermine qui peut passer. Pas de flag booléen séparé.
- **Layers dans Tiled** :
  - `terrain` (tilelayer) — GID → TileState via propriétés custom du tileset embarqué
  - `decorations` (tilelayer) — ignoré par le core, utilisé plus tard par le renderer
  - `spawns` (objectgroup) — objets Tiled avec propriétés `teamIndex: int` et `formatTeamCount: int`
- **Propriétés custom par tile (dans le tileset embarqué)** :
  - `terrain` : string → `TerrainType`
  - `height` : int → `TileState.height`
- **Validation dans le parser** : erreurs bloquantes + warnings non-bloquants
- **Preview mode** : `pnpm dev:map <fichier.tmj>` — rendu de la carte seule, sans combat
- **Règle globale Vol/Lévitation** : pas affectés par les terrains (sauf `obstacle` où Spectre ne peut pas s'arrêter). Implémentation dans un plan séparé (règles de déplacement par terrain).

### Types de terrain — 11 terrains validés

| Terrain | Effet gameplay (futur) | Immunité terrain |
|---|---|---|
| `normal` | Rien | — |
| `tall_grass` | +évasion | — |
| `obstacle` | Bloque mouvement + LOS. Vol : traverse + arrêt. Spectre : traverse, pas d'arrêt. | Vol, Spectre (traverse seul) |
| `water` | Malus déplacement | Eau/Vol/Lévitation |
| `deep_water` | Intraversable + bonus Eau | Eau/Vol/Lévitation |
| `magma` | Brûlure au passage, brûlure aggravée à l'arrêt | Feu/Vol/Lévitation |
| `lava` | Intraversable + bonus Feu | Feu/Vol/Lévitation |
| `ice` | Knockback augmenté + bonus Glace | Glace/Vol/Lévitation |
| `sand` | Malus déplacement + bonus Sol | Sol/Vol/Lévitation |
| `snow` | Malus déplacement + bonus Glace | Glace/Vol/Lévitation |
| `swamp` | Malus déplacement fort + risque Poison | Poison/Vol/Lévitation |

> Les **effets gameplay** sont un plan séparé (core pur + tests). Ce plan ne fait que stocker le terrain dans la carte et l'enum.

## Étapes

### Étape 1 — Mise à jour du core : TerrainType + suppression isPassable (S)

- Mettre à jour `packages/core/src/enums/terrain-type.ts` : ajouter `DeepWater`, `Magma`, `Lava`, `Obstacle`, `Sand`, `Snow`, `Swamp` (6 nouveaux, `Lava` existant renommé en sens "intraversable")
- Supprimer `isPassable` de `TileState` dans `packages/core/src/types/tile-state.ts`
- Mettre à jour tous les fichiers du core/data/renderer qui utilisent `isPassable` :
  - `Grid.ts` : le pathfinding utilise `isPassable` → remplacer par `terrain !== TerrainType.Obstacle` (temporairement, en attendant le plan règles de déplacement)
  - `buildFlatTiles` dans les maps existantes
  - `validateMapDefinition`
  - `BattleSetup.ts`
  - Tests impactés
- Critère : `pnpm test` + `pnpm typecheck` passent, zéro `isPassable` dans le codebase

### Étape 2 — Types TiledMap (S)

- Créer `packages/data/src/tiled/tiled-types.ts`
- Interfaces : `TiledMap`, `TiledLayer` (tilelayer + objectgroup), `TiledObject`, `TiledTileset` (embarqué), `TiledTile` (avec `properties`), `TiledProperty`
- Pas d'exhaustivité — couvrir uniquement les champs utilisés par le parser
- Critère : types compilent en strict mode, aucun `any`

### Étape 3 — Extraction des propriétés tileset (S)

- Créer `packages/data/src/tiled/tileset-resolver.ts`
- Fonction `resolveTileProperties(gid: number, tileset: TiledTileset): { terrain: TerrainType; height: number }`
- GID 0 = tile vide → `{ terrain: TerrainType.Obstacle, height: 0 }` (obstacle implicite)
- Propriétés manquantes → valeurs par défaut (`terrain: normal`, `height: 0`)
- `terrain` string inconnu → erreur descriptive
- Critère : tests unitaires couvrant GID 0, propriétés partielles, terrain invalide, les 11 terrains

### Étape 4 — Parser du layer terrain (M)

- Créer `packages/data/src/tiled/parse-terrain-layer.ts`
- Entrée : `TiledLayer` (type tilelayer, name terrain) + `TiledTileset`
- Sortie : `TileState[][]` (width × height, `occupantId: null` partout)
- Format tableau plat uniquement (pas de chunks — on exporte en maps finies, pas infinies)
- Critère : test avec un layer 3×3 de GIDs variés, vérifier `position`, `height`, `terrain`

### Étape 5 — Parser du layer spawns (M)

- Créer `packages/data/src/tiled/parse-spawns-layer.ts`
- Entrée : `TiledLayer` (type objectgroup, name spawns)
- Sortie : `MapFormat[]` — grouper les objets par `formatTeamCount`, puis par `teamIndex`
- Un objet Tiled = une position dans une `SpawnZone`
- Conversion coordonnées pixel Tiled → coordonnées grille (diviser par tilewidth/tileheight)
- Propriétés manquantes sur un objet → erreur avec coordonnées pour debugger
- Critère : test avec 4 objets (2 équipes, format 2v2) → 1 `MapFormat` avec 2 `SpawnZone[]`

### Étape 6 — Fonction principale `parseTiledMap` (M)

- Créer `packages/data/src/tiled/parse-tiled-map.ts`
- Fonction `parseTiledMap(tiledJson: TiledMap): ParseResult` où `ParseResult = { map: MapDefinition; warnings: string[] } | { errors: string[] }`
- Orchestrer les étapes 3-5, récupérer `id` et `name` depuis les propriétés custom de la map
- Layer `terrain` absent → erreur. Layer `spawns` absent → erreur. Layer `decorations` absent → warning
- Tileset embarqué absent → erreur
- Critère : test avec un JSON Tiled minimal valide → `MapDefinition` conforme

### Étape 7 — Validation métier (M)

- Créer `packages/data/src/tiled/validate-tiled-map.ts`
- Règles bloquantes :
  - Les zones de spawn sont sur des tiles non-obstacle
  - Chaque format a assez de positions de spawn pour `maxPokemonPerTeam` × `teamCount`
  - Connectivité basique entre zones de spawn (BFS — au moins un chemin passable entre spawns)
- Règles warning :
  - Incohérences de hauteur (diff > 2 entre tiles adjacentes sans transition)
  - Zones de spawn sur des terrains hostiles (lava, magma, deep_water)
- Critère : tests unitaires pour chaque règle — cas valide + cas invalide

### Étape 8 — Chargement runtime (S)

- Créer `packages/data/src/tiled/load-tiled-map.ts`
- Fonction `loadTiledMap(url: string): Promise<MapDefinition>` — fetch + JSON.parse + parseTiledMap + validateTiledMap + throw si erreurs
- Exporter depuis `packages/data/src/tiled/index.ts` et `packages/data/src/index.ts`
- Critère : aucun import Phaser, compile en strict, test avec mock fetch

### Étape 9 — Carte de test .tmj (S)

- Créer `packages/data/assets/maps/test-arena.tmj` — version Tiled de la `poc-arena` (12×20, tiles normales, spawns 2 équipes)
- Tileset embarqué avec propriétés custom sur les tiles
- Test automatisé : `parseTiledMap(testArena)` produit un `MapDefinition` fonctionnellement équivalent à `poc-arena`
- Critère : le JSON est valide, le parser produit une map jouable

### Étape 10 — Preview mode renderer (M)

- Ajouter commande `dev:map` dans `package.json` racine : passe le chemin via variable d'env ou query param
- Créer `MapPreviewScene` dans `packages/renderer/src/scenes/` — charge la carte via `loadTiledMap`, instancie `IsometricGrid`, affiche la grille sans Pokemon ni UI
- Contrôles : zoom (molette), pan (clic+drag ou bords), touche R pour recharger
- Afficher les spawn zones colorées par équipe
- Critère : `pnpm dev:map test-arena.tmj` affiche la carte iso dans le navigateur

### Étape 11 — Intégration dans le flow principal (M)

- Le renderer peut choisir entre une `MapDefinition` statique (poc-arena) et une carte Tiled dynamique
- Sélection de carte dans `TeamSelectScene` ou `BattleModeScene` (dropdown ou liste)
- Aucune régression sur le flow existant (team select → placement → combat)
- Critère : lancer un combat sur `test-arena.tmj` — placement et combat fonctionnent normalement

## Critères de complétion

- `pnpm test` passe (tous les tests existants + nouveaux tests parser/validation)
- `pnpm typecheck` + `pnpm lint` : zéro erreur
- `isPassable` supprimé du codebase
- `TerrainType` a 11 valeurs
- `pnpm dev:map test-arena.tmj` affiche la carte iso correctement
- Un combat complet sur `test-arena.tmj` fonctionne (placement → combat → victoire)
- Aucune dépendance Phaser dans `packages/data`

## Risques

- **Chemin tileset embarqué** : Tiled peut stocker le tileset en inline ou en référence externe. On ne supporte que l'embarqué — documenter la contrainte.
- **Coordonnées spawns** : Tiled stocke les objets en pixels, pas en coordonnées grille. La conversion pixel → grille dépend de l'orientation iso. À vérifier avec un export Tiled réel.
- **Impact suppression isPassable** : touche potentiellement beaucoup de fichiers. L'étape 1 doit être faite proprement avant de continuer.

## Dépendances

- **Avant** : Plans 043 et 044 terminés (tileset iso + pixel art) — fait
- **Débloque** :
  - Plan règles de déplacement par terrain/type Pokemon (core pur)
  - Plan dénivelés (hauteur tiles + dégâts de chute + LOS)
  - Plan obstacles + line of sight
  - Plan agent `level-designer` (génération .tmj par IA)
