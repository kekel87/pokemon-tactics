---
status: in-progress
created: 2026-03-20
updated: 2026-03-20
---

# Plan 002 — Modèles de base du core

## Objectif

Définir tous les types et interfaces TypeScript du moteur de jeu, implémenter la grille avec ses helpers, et poser un `BattleEngine` minimal capable de recevoir une action et d'émettre des événements — le tout sans aucune dépendance UI.

## Contexte

Le plan 001 (setup monorepo) est terminé. La structure `packages/core/src/` et `packages/data/src/` existe. L'architecture décide que le core est synchrone, découplé du rendu, et expose trois concepts fondamentaux : Targeting + Effects (déclaratif), BattleEvents (synchrones), et une API `BattleEngine`. Le roster POC définit 4 Pokemon et 16 attaques qui couvrent tous les patterns à supporter : single, cône, croix, zone self, dash, lien.

L'objectif de cette étape est d'avoir une fondation typée sur laquelle toutes les mécaniques futures se brancheront, et un moteur minimal prouvé par des tests.

## Étapes

- [ ] **Étape 1 — Types primitifs et enums** (`packages/core/src/models/types.ts`)
  - `PokemonType` : union des 18 types (Normal, Feu, Eau, Plante, Électrik, Glace, Combat, Poison, Sol, Vol, Psy, Insecte, Roche, Spectre, Dragon, Ténèbres, Acier, Fée)
  - `StatName` : union (`hp | attack | defense | spAttack | spDefense | speed`)
  - `Category` : `'physical' | 'special' | 'status'`
  - `StatusType` : union (`burned | paralyzed | poisoned | badly_poisoned | frozen | asleep | confused`)
  - `Direction` : `'north' | 'south' | 'east' | 'west'`
  - `Position` : `{ x: number; y: number }`
  - `TerrainType` : `'normal' | 'lava' | 'water' | 'tall_grass' | 'ice'`
  - Tests : vérification que les types sont bien exportés (test de compilation)

- [ ] **Étape 2 — Types Targeting et Effects** (`packages/core/src/models/move.ts`)
  - `TargetingPattern` : discriminated union complète selon l'architecture
    - `{ kind: 'single'; range: { min: number; max: number } }`
    - `{ kind: 'self' }`
    - `{ kind: 'cone'; range: { min: number; max: number }; width: number }`
    - `{ kind: 'cross'; range: { min: number; max: number }; size: number }`
    - `{ kind: 'line'; length: number }`
    - `{ kind: 'dash'; maxDistance: number }`
    - `{ kind: 'zone'; radius: number }`
  - `Effect` : discriminated union
    - `{ kind: 'damage' }`
    - `{ kind: 'status'; status: StatusType; chance: number }`
    - `{ kind: 'stat_change'; stat: StatName; stages: number; target: 'self' | 'targets' }`
    - `{ kind: 'link'; linkType: string; duration: number; maxRange: number; drainFraction: number }`
  - `MoveDefinition` : interface complète (`id`, `name`, `type`, `category`, `power`, `accuracy`, `pp`, `targeting`, `effects`)
  - Tests : instanciation des différents kinds, vérification que le switch exhaustif compile

- [ ] **Étape 3 — Types Pokemon et BattleState** (`packages/core/src/models/pokemon.ts` et `battle-state.ts`)
  - `BaseStats` : `{ hp: number; attack: number; defense: number; spAttack: number; spDefense: number; speed: number }`
  - `DerivedStats` : `{ movement: number; jump: number; initiative: number }`
  - `PokemonDefinition` : espèce (stats de base, types, poids, movepool)
  - `PokemonInstance` : créature en combat (`id`, `definitionId`, `currentHp`, `maxHp`, `statStages`, `statusEffects`, `position`, `orientation`, `currentPp`, `koCountdown | null`)
  - `ActiveLink` : `{ sourceId: string; targetId: string; linkType: string; remainingTurns: number; maxRange: number; drainFraction: number }`
  - `TileState` : `{ position: Position; height: number; terrain: TerrainType; occupantId: string | null; isPassable: boolean }`
  - `BattleState` : `{ grid: TileState[][]; pokemon: Map<string, PokemonInstance>; activeLinks: ActiveLink[]; turnOrder: string[]; currentTurnIndex: number; roundNumber: number }`
  - Tests : construction d'un `BattleState` minimal en dur, assertions sur les champs

- [ ] **Étape 4 — Types BattleEvent et Action** (`packages/core/src/models/events.ts` et `actions.ts`)
  - `BattleEvent` : discriminated union complète selon l'architecture (tous les événements listés dans `architecture.md` section 5)
  - `Action` : discriminated union
    - `{ kind: 'move'; pokemonId: string; path: Position[] }`
    - `{ kind: 'use_move'; pokemonId: string; moveId: string; targetPosition: Position }`
    - `{ kind: 'skip_turn'; pokemonId: string }`
  - `ActionResult` : `{ success: boolean; events: BattleEvent[]; error?: string }`
  - Tests : construction de chaque variant d'Action, sérialisation JSON aller-retour

- [ ] **Étape 5 — Grid : structure et helpers** (`packages/core/src/grid/Grid.ts`)
  - Classe `Grid` avec constructeur `(width: number, height: number, tiles: TileState[][])`
  - `getTile(pos: Position): TileState | null`
  - `getNeighbors(pos: Position): TileState[]` — 4 directions, pas de diagonale
  - `isInBounds(pos: Position): boolean`
  - `getOccupant(pos: Position): string | null`
  - `getTilesInRange(origin: Position, minRange: number, maxRange: number): Position[]` — distance de Manhattan
  - `getHeightDifference(from: Position, to: Position): number`
  - Tests unitaires couvrant : voisins en bordure de grille, positions hors-limites, calcul de range, hauteurs

- [ ] **Étape 6 — Grid : résolution de targeting** (`packages/core/src/grid/targeting.ts`)
  - `resolveTargeting(pattern: TargetingPattern, caster: PokemonInstance, targetPos: Position, grid: Grid): Position[]`
  - Resolver pour chaque `kind` de `TargetingPattern` :
    - `single` : retourne `[targetPos]` si dans la range de Manhattan
    - `self` : retourne `[caster.position]`
    - `cone` : tiles dans un éventail de `width` tiles devant le caster, en direction de la cible
    - `cross` : tiles en croix de taille `size` centrées sur `targetPos`
    - `line` : tiles en ligne droite depuis le caster vers `targetPos` jusqu'à `length`
    - `dash` : tiles en ligne droite, s'arrête au premier occupant ennemi ou à `maxDistance`
    - `zone` : tiles dans un rayon de Manhattan `radius` autour de `targetPos`
  - Tests : chaque resolver avec des grilles simples, cas limites (bord de grille, obstacles)

- [ ] **Étape 7 — BattleEngine minimal** (`packages/core/src/battle/BattleEngine.ts`)
  - Classe `BattleEngine` implémentant l'interface `BattleEngine` de l'architecture
  - `constructor(state: BattleState)` — prend un état initial
  - `getGameState(playerId: string): GameState` — retourne une vue de l'état (pour le POC : état complet)
  - `getLegalActions(playerId: string): Action[]` — retourne `move` + `use_move` + `skip_turn` valides
  - `submitAction(playerId: string, action: Action): ActionResult` — valide, exécute, émet des events
  - `on(event: string, handler: (e: BattleEvent) => void): void` — abonnement simple
  - Pour le POC, `submitAction` gère seulement `skip_turn` et `move` (déplacement sans combat) — les attaques viendront au plan 003
  - Tests : enchaîner `getLegalActions` → `submitAction` → vérifier les events émis, vérifier la mutation de `BattleState`

- [ ] **Étape 8 — Données POC dans packages/data** (`packages/data/src/`)
  - `base/pokemon.ts` : les 4 Pokemon du roster (Bulbizarre, Salamèche, Carapuce, Roucoul) avec leurs stats officielles et poids
  - `base/moves.ts` : les 16 attaques du roster avec `power`, `accuracy`, `pp`, `type`, `category` — sans targeting ni effects
  - `overrides/tactical.ts` : ajoute `targeting` et `effects` à chaque attaque selon le roster POC
  - `overrides/balance-v1.ts` : placeholder vide (structure prête, pas de tweaks encore)
  - Fonction `loadData(): { pokemon: PokemonDefinition[]; moves: MoveDefinition[] }` qui applique le `deepMerge` des 3 couches
  - Tests : vérifier que `loadData()` produit des entités complètes, que chaque move a un targeting et au moins un effect

- [ ] **Étape 9 — Validation au startup** (`packages/core/src/battle/validate.ts`)
  - `validateBattleData(data: { pokemon: PokemonDefinition[]; moves: MoveDefinition[] }): ValidationResult`
  - Vérifie : chaque move a un targeting et au moins un effet, chaque pokemon référence des moves qui existent dans la liste, les ids sont uniques, les ranges sont cohérentes (min ≤ max)
  - `ValidationResult` : `{ valid: boolean; errors: string[] }`
  - Tests : données valides → `valid: true`, données corrompues (move sans targeting, id en double) → erreurs attendues

- [ ] **Étape 10 — Export de l'API publique** (`packages/core/src/index.ts`)
  - Exporter les types et classes publics : `BattleEngine`, `Grid`, tous les types de `models/`
  - Vérifier que rien de UI n'est importé (test `core-guardian` peut être lancé manuellement)
  - Vérifier que `import('@pokemon-tactic/core')` depuis un script Node.js headless fonctionne

## Critères de complétion

- Tous les types sont définis et compilent en TypeScript strict (`strict: true`, zéro `any` implicite)
- `pnpm test` passe dans `packages/core` — chaque étape a ses tests unitaires
- `pnpm test` passe dans `packages/data` — `loadData()` produit des entités complètes et valides
- La validation au startup détecte les données corrompues avec des messages clairs
- Un script Node.js headless peut instancier `BattleEngine`, appeler `getLegalActions`, `submitAction(skip_turn)`, et recevoir les events — sans Phaser ni browser
- `packages/core` n'importe rien de `renderer`, `phaser`, ou tout autre package UI (vérifié par grep ou `core-guardian`)

## Risques / Questions

- **Formules des stats dérivées** (Mouvement, Saut, Initiative depuis Vitesse + Poids) : non définies dans le game-design. Pour le POC, utiliser `initiative = speed`, `movement = 3` (fixe), `jump = 1` (fixe). Une issue dans `decisions.md` doit être ouverte.
- **Profondeur de la grille pour le POC** : la grille 2D avec hauteur par tile suffit pour le moteur. Le rendu isométrique est séparé. Pas de risque ici.
- **deepMerge des couches de données** : attention aux objets imbriqués (ne pas merger naïvement avec spread). Utiliser un merge récursif testé. Une librairie légère peut être envisagée mais `structuredClone` + merge manuel suffit.
- **Orientation du caster pour le targeting cône/line** : le resolver a besoin de la direction du caster. `PokemonInstance.orientation` doit être utilisée, pas la direction vers la cible — à valider au moment d'implémenter l'étape 6.
- **Type Vol et règles de traversée** : le pathfinding pour `getLegalActions` doit connaître le type du Pokemon pour décider s'il traverse les ennemis. Prévoir un paramètre `canFly: boolean` dans les helpers de Grid.

## Dépendances

- **Avant ce plan** : Plan 001 terminé (monorepo, tsconfig, Vitest, Biome configurés)
- **Ce plan débloque** :
  - Plan 003 — Résolution des effets d'attaque (damage, status, stat_change, link)
  - Plan 004 — Boucle de combat complète (tour par tour, initiative, fin de combat)
  - Plan 005 — Pathfinding A* pour le déplacement sur grille
