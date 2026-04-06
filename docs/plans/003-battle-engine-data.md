---
status: draft
created: 2026-03-20
updated: 2026-03-20
---

# Plan 003 — BattleEngine minimal + données POC

## Objectif

Implémenter un BattleEngine minimal capable de gérer un combat tour par tour (déplacement + skip), créer le package `packages/data` avec les 4 Pokemon et 16 attaques du roster POC, ajouter une validation des données au startup, et finaliser l'API publique du core. À la fin de ce plan, un script headless peut instancier un combat, itérer les tours, déplacer des Pokemon sur la grille, et vérifier les données.

## Contexte

Le plan 002 a posé les fondations : 11 enums, 16 types, Grid avec helpers spatiaux, 7 targeting resolvers, mocks centralisés, 41 tests à 100% coverage. Les types `BattleState`, `Action`, `ActionResult`, `BattleEvent` existent déjà. `packages/data` n'existe pas encore. Ce plan correspond aux étapes 7-10 du plan 002 original, détaillées ici en plan autonome.

Le BattleEngine de ce plan ne gère **pas** les attaques (résolution d'effets = Plan 004). Il gère : initiative, tour par tour, déplacement sur grille, skip turn, et émission d'events.

## Étapes

### Étape 1 — TurnManager : gestion de l'initiative et de l'ordre des tours

**Fichier** : `packages/core/src/battle/TurnManager.ts`

- Classe `TurnManager` qui encapsule la logique d'ordonnancement
- `constructor(pokemon: PokemonInstance[])` — trie par `derivedStats.initiative` décroissant
- `getCurrentPokemonId(): string` — retourne le Pokemon dont c'est le tour
- `advance(): void` — passe au prochain Pokemon dans l'ordre
- `isRoundComplete(): boolean` — vrai quand tous ont joué ce round
- `startNewRound(): void` — incrémente le round, repart du début
- `removePokemon(pokemonId: string): void` — retire un KO de l'ordre. Si c'est le Pokemon actif qui est retiré, avance automatiquement au suivant.
- Gestion des égalités d'initiative : ordre stable (par id alphabétique en cas d'égalité)
- Le TurnManager est la **source de vérité** pour l'ordre des tours. `BattleState.turnOrder` et `currentTurnIndex` sont synchronisés par le BattleEngine après chaque mutation du TurnManager.

**Tests** (`TurnManager.test.ts`) :
- 4 Pokemon avec initiatives différentes → ordre correct
- `advance()` cycle à travers tous les Pokemon
- `removePokemon()` retire du cycle sans casser l'ordre
- `removePokemon()` sur le Pokemon actif → avance au suivant
- Égalité d'initiative → tri stable par id

### Étape 2 — BattleEngine : structure et cycle de vie

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

- Classe `BattleEngine`
- `constructor(state: BattleState, moveRegistry: Map<string, MoveDefinition>)` — prend un état initial et le registre des moves
- Crée un `TurnManager` interne depuis `state.pokemon`
- Stocke les listeners d'events (pattern observer simple)
- `on(eventType: string, handler: (event: BattleEvent) => void): void`
- `off(eventType: string, handler: (event: BattleEvent) => void): void`
- Méthode privée `emit(event: BattleEvent): void` — notifie les listeners
- `getGameState(playerId: string): BattleState` — retourne l'état courant. Pour le POC, retourne l'état complet (pas de vision partielle par joueur). `GameState` = alias de `BattleState` pour l'instant, un type séparé sera introduit quand le brouillard de guerre arrivera.

**Tests** (`BattleEngine.test.ts`) :
- Construction avec un état minimal (2 Pokemon, grille 5x5)
- `on` / `off` : les handlers reçoivent les events émis
- `getGameState()` retourne l'état courant

### Étape 3 — BattleEngine : getLegalActions

**Dans** `BattleEngine.ts`

- `getLegalActions(playerId: string): Action[]` — retourne les actions légales pour le Pokemon actif du joueur. Valide que le `playerId` possède bien le Pokemon actif (sinon retourne `[]`).
- Actions retournées :
  - `skip_turn` — toujours disponible
  - `move` — une action par tile accessible (BFS depuis la position actuelle, distance ≤ `derivedStats.movement`)
    - Respecte les règles de traversée : alliés traversables, ennemis bloquants
    - Tiles non-passables bloquantes
    - Saut : `abs(heightDiff) ≤ derivedStats.jump` pour franchir un dénivelé
  - `use_move` **non listé dans ce plan** — sera ajouté dans le Plan 004 quand la résolution d'effets sera implémentée. Évite de retourner des actions non exécutables à l'IA.
- Méthode privée `getReachableTiles(pokemon: PokemonInstance): Position[]` — BFS avec contraintes

**Tests** :
- Pokemon seul sur grille vide → `movement` tiles accessibles + skip
- Pokemon bloqué par un ennemi → tiles derrière l'ennemi inaccessibles
- Pokemon allié traversable → tiles derrière l'allié accessibles
- Dénivelé > jump → tile inaccessible
- `getLegalActions` avec mauvais `playerId` → retourne `[]`

### Étape 4 — BattleEngine : submitAction (move + skip)

**Dans** `BattleEngine.ts`

- `submitAction(playerId: string, action: Action): ActionResult`
- Validation : le `playerId` possède le Pokemon actif, le `pokemonId` correspond au Pokemon actif (TurnManager)
- `skip_turn` :
  - Émet `TurnEnded`
  - Avance le TurnManager
  - Si round complet → `startNewRound()`, incrémente `BattleState.roundNumber`
  - Émet `TurnStarted` pour le prochain Pokemon
- `move` :
  - Valide que le path est légal (chaque step est un voisin, tile passable, longueur ≤ movement, règles de traversée alliés/ennemis respectées)
  - Met à jour `Grid.setOccupant` (ancien → null, nouveau → pokemonId)
  - Met à jour `PokemonInstance.position`
  - Met à jour `PokemonInstance.orientation` (direction du dernier step)
  - Émet `PokemonMoved`
  - Émet `TurnEnded`, avance le TurnManager, émet `TurnStarted`
- `use_move` : retourne `{ success: false, events: [], error: "not_implemented" }` (ne devrait pas arriver puisque `getLegalActions` ne les liste pas, mais sécurité)
- Retourne `ActionResult` avec `success: true/false` et les events émis

**Tests** :
- `skip_turn` → TurnEnded + TurnStarted du suivant
- `move` valide → position mise à jour, occupants corrects, PokemonMoved émis
- `move` invalide (trop long, hors grille) → `success: false`
- `move` invalide (pas le bon Pokemon) → `success: false`
- Round complet → roundNumber incrémenté
- Cycle de 3 tours complets avec 2 Pokemon

### Étape 5 — Package packages/data : setup + données de base

**Setup** :
- Créer `packages/data/package.json` (name: `@pokemon-tactic/data`, dépend de `@pokemon-tactic/core`)
- Créer `packages/data/tsconfig.json` (extends `../../tsconfig.base.json`)
- Ajouter au workspace pnpm

**Fichiers** :
- `packages/data/src/base/pokemon.ts` — les 4 PokemonDefinition du roster (stats officielles, poids, types, movepool)
- `packages/data/src/base/moves.ts` — les 16 MoveDefinition **partielles** (power, accuracy, pp, type, category — sans targeting ni effects)
- `packages/data/src/base/type-chart.ts` — tableau 18x18 des efficacités de type (multiplicateurs). Données officielles Pokemon. Non utilisé par le BattleEngine dans ce plan, mais structure prête pour le Plan 004.
- `packages/data/src/overrides/tactical.ts` — ajoute `targeting` et `effects` à chaque move selon le roster POC
- `packages/data/src/overrides/balance-v1.ts` — placeholder vide, exporte un objet vide
- `packages/data/src/merge.ts` — fonction `deepMerge` pour combiner les couches
- `packages/data/src/load-data.ts` — `loadData(): { pokemon: PokemonDefinition[]; moves: MoveDefinition[] }` qui merge les 3 couches
- `packages/data/src/index.ts` — barrel export

**Tests** (`packages/data/src/load-data.test.ts`) :
- `loadData()` retourne 4 pokemon et 16 moves
- Chaque move a un targeting et au moins un effect
- Chaque pokemon référence des moves qui existent
- Les stats sont des nombres positifs
- Le merge ne casse pas les propriétés existantes
- deepMerge : un override avec un array **remplace** l'array (pas de concaténation)

### Étape 6 — Validation des données au startup

**Fichier** : `packages/core/src/battle/validate.ts`

- `validateBattleData(data: { pokemon: PokemonDefinition[]; moves: MoveDefinition[] }): ValidationResult`
- `ValidationResult` : `{ valid: boolean; errors: string[] }`
- Règles :
  - Chaque move a un `targeting` défini
  - Chaque move a au moins un `effect`
  - Chaque pokemon a un `movepool` non vide
  - Chaque move référencé dans un movepool existe dans la liste des moves
  - Les `id` sont uniques (pas de doublons)
  - Les ranges sont cohérentes (`min ≤ max`)
  - `power ≥ 0`, `accuracy` entre 0 et 100, `pp > 0`

**Tests** (`validate.test.ts`) :
- Données valides (sortie de `loadData()`) → `valid: true`
- Move sans targeting → erreur
- Move sans effect → erreur
- Pokemon qui référence un move inexistant → erreur
- Id en doublon → erreur
- Range min > max → erreur

### Étape 7 — Export API publique + script headless de validation

**Dans** `packages/core/src/index.ts` :
- Ajouter exports : `BattleEngine`, `TurnManager`, `validateBattleData`, `ValidationResult`
- Vérifier que tous les types utiles sont exportés

**Script de validation** : `packages/core/src/battle/BattleEngine.integration.test.ts`
- Test d'intégration qui :
  1. Charge les données via `loadData()` depuis `@pokemon-tactic/data`
  2. Valide avec `validateBattleData()` → attend `valid: true`
  3. Crée un `BattleState` avec une grille 8x8, 2 Pokemon placés
  4. Instancie `BattleEngine`
  5. Appelle `getLegalActions()` → vérifie qu'il y a des actions
  6. Exécute `submitAction(move)` → vérifie le déplacement
  7. Exécute `submitAction(skip_turn)` → vérifie le changement de tour
  8. Vérifie les events collectés via `on()`

## Critères de complétion

- `pnpm test` passe dans `packages/core` et `packages/data` — 100% coverage maintenu sur le core
- `BattleEngine` gère move + skip_turn avec émission d'events
- `getLegalActions()` retourne les tiles accessibles (BFS) et les moves disponibles
- `loadData()` produit 4 Pokemon et 16 moves complets (targeting + effects)
- `validateBattleData()` détecte les données corrompues avec des messages clairs
- Le test d'intégration prouve le cycle complet headless
- Zéro dépendance UI dans le core

## Risques / Questions

- **BFS pathfinding** : pour le POC, un BFS simple (pas A*) suffit — on ne cherche pas le chemin optimal, juste les tiles accessibles. A* viendra dans un plan futur si nécessaire.
- **deepMerge** : attention aux arrays (effects) — merge par remplacement et non par concaténation. Les overrides **remplacent** les arrays, pas les append.
- **Performance getLegalActions** : avec 4 Pokemon et une grille 8x8, aucun problème. Optimiser plus tard si nécessaire.
- **`use_move` non listé** : `getLegalActions` ne retourne pas les `use_move` dans ce plan. `submitAction` les rejette avec une erreur claire. Le Plan 004 les activera.
- **Types PokemonDefinition.movepool** : vérifier que le type existant supporte la liste des move ids. Si `movepool` n'est pas dans le type, l'ajouter.

## Dépendances

- **Avant ce plan** : Plan 002 étapes 1-6 terminées (types, Grid, targeting resolvers)
- **Ce plan débloque** :
  - Plan 004 — Résolution des effets (damage, status, stat_change, link)
  - Plan 005 — Boucle de combat complète (KO, countdown, fin de combat)
  - Plan futur — Pathfinding A* (remplacerait le BFS si nécessaire)
