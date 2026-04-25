# Plan 068 — Fix IA : terrain dangereux, CT, pathfinding

> Statut : done (2026-04-25)
> Bloquant pour : release Phase 3

## Contexte

Trois bugs comportementaux de l'IA identifiés au playtest qui dégradent la jouabilité :

1. **Terrain dangereux ignoré** — l'IA marche sur Swamp/Magma/Lava sans aversion, même quand le Pokemon n'est pas immune.
2. **CT ignoré** — le scorer traite un move lent (CT 900) et un move rapide (CT 500) à égalité.
3. **Pathfinding aveugle** — `evaluateAttacksFromPosition` et `scoreMove` utilisent `manhattanDistance` pour évaluer la proximité des ennemis. Résultat : l'IA se déplace vers des ennemis derrière des murs ou des hauteurs infranchissables, puis ne peut pas attaquer.

**Note LoS** : `getLegalActions` vérifie correctement la LoS via `resolveTargeting` — l'IA ne peut pas réellement attaquer à travers un mur. Ce qui s'observe, c'est qu'elle GASPILLE son tour en se déplaçant vers une position "prometteuse" qui ne l'est pas. Ce comportement est fixé par le bug 3.

**Observation non confirmée — dégâts à travers le mur** : des dégâts ont été observés en passant à travers un mur lors d'une partie sur `le-mur.tmj`. Cause inconnue — peut-être un move avec `ignoresLoS` (sonique, tellurique), ou un bug dans `resolveTargeting` pour certains patterns de targeting. À investiguer lors de l'étape 4 (test LoS).

## Code concerné

Tout dans `packages/core/src/ai/action-scorer.ts`.

Outils disponibles sans modification d'API :
- `isTerrainImmune(terrain, types)` — `packages/core/src/battle/terrain-effects.ts`
- `computeMoveCost(pp, power, tier)` — `packages/core/src/battle/ct-costs.ts`
- `state.grid: TileState[][]` — accessible dans le scorer via `state`
- `engine: BattleEngine` — déjà passé au scorer

## Étape 1 — Fix terrain dangereux

**Fichier** : `action-scorer.ts`

Dans `scoreMove`, après le calcul du score de positionnement, vérifier la tile de destination :

```typescript
const destinationTile = state.grid[destination.y]?.[destination.x];
if (destinationTile) {
  const pokemonTypes = /* récupérer les types du currentPokemon depuis state */;
  const dangerousTerrain = [TerrainType.Magma, TerrainType.Swamp, TerrainType.Lava];
  if (dangerousTerrain.includes(destinationTile.terrain) && !isTerrainImmune(destinationTile.terrain, pokemonTypes)) {
    score -= DANGEROUS_TERRAIN_PENALTY; // constante à définir, valeur indicative : 8
  }
}
```

**Point bloquant** : le scorer n'a pas actuellement accès aux types du Pokemon actif. Il faut soit :
- Option A : ajouter les types dans `PokemonInstance` (ou les lire depuis `state` si déjà présent)
- Option B : passer les types en paramètre du scorer
- Option C : exposer un helper `engine.getPokemonTypes(pokemonId): PokemonType[]`

Vérifier ce qui est déjà dans `PokemonInstance` avant de trancher.

**Constante** : `DANGEROUS_TERRAIN_PENALTY = 8` (> `positioning × 2`, pour neutraliser l'intérêt de se rapprocher de 2 tiles d'un ennemi si c'est sur du magma). Ajustable.

## Étape 2 — Fix CT-aware move scoring

**Fichier** : `action-scorer.ts`

Dans `scoreUseMove`, importer `computeMoveCost` depuis `ct-costs.ts` et ajouter un facteur de coût :

```typescript
const ctCost = computeMoveCost(move.pp, move.power, move.effectTier);
const ctFactor = CT_REFERENCE_COST / ctCost; // CT_REFERENCE_COST = 500 (valeur min)
score *= ctFactor;
```

Effet : un move à CT 500 → factor 1.0 (pas de pénalité). CT 700 → ×0.71. CT 900 → ×0.55. L'IA préfère les moves rapides à dégâts équivalents.

**Constante** : `CT_REFERENCE_COST = 500`.

## Étape 3 — Fix pathfinding (distance réelle vs manhattanDistance)

### 3a — Exposer `computePathDistance` sur le moteur

**Fichier** : `BattleEngine.ts`

Ajouter une méthode publique :

```typescript
computePathDistance(from: Position, to: Position, pokemonId: string): number
```

Implémentation : BFS sans budget de mouvement (on veut juste savoir si `to` est atteignable depuis `from` et combien de pas). Réutilise la logique de `getReachableTiles` mais :
- Pas de contrainte `distance > pokemon.derivedStats.movement`
- Pas de filtre `canStopOn` (on traverse les tiles occupées)
- S'arrête dès qu'on atteint `to`, retourne la distance
- Retourne `Infinity` si `to` est inatteignable (obstacle, deep_water, etc.)

Le Pokemon concerné (via `pokemonId`) est utilisé pour déterminer Flying/Ghost (qui peuvent traverser des terrains spéciaux).

### 3b — Remplacer manhattanDistance dans le scorer

**Fichier** : `action-scorer.ts`

Deux occurrences à remplacer :

1. Dans `scoreMove` — `closestEnemyDistance(destination, enemies)` → itérer sur les ennemis et utiliser `engine.computePathDistance(destination, enemy.position, currentPokemon.id)`. Prendre le minimum.

2. Dans `evaluateAttacksFromPosition` — `manhattanDistance(fromPosition, enemy.position)` → `engine.computePathDistance(fromPosition, enemy.position, pokemon.id)`. Si `Infinity` (inatteignable) → ne pas scorer cette opportunité d'attaque.

**Performance** : grille max 16×16 = 256 tiles. BFS O(n) par appel. Avec ~20 destinations candidates × 3 ennemis × 2 appels/combo = ~120 BFS. Acceptable en synchrone.

## Étape 4 — Test de non-régression LoS

**Fichier** : nouveau test `BattleEngine.los-legal-actions.test.ts`

Vérifier qu'une action `UseMove` avec LoS bloquée n'est jamais incluse dans `getLegalActions`. Setup : map 5×5 avec un pilier h=3 en (2,2), attaquant en (1,2), ennemi en (3,2). Le pilier bloque la LoS. Assertion : aucune action `UseMove` vers (3,2) dans les actions légales du Single-targeting.

Ce test peut être rejoué sur `le-mur.tmj` pour couvrir un cas plus complexe (escaliers, hauteurs variables).

## Étape 5 — Tests unitaires des 3 fixes

**Fichier** : `action-scorer.test.ts` (existant, à compléter)

- **Terrain** : setup avec 2 destinations équidistantes de l'ennemi, l'une sur Magma, l'autre Normal → l'IA préfère Normal (non-immune). Même test avec un Pokemon Fire/Flying → pas de pénalité.
- **CT** : setup avec 2 moves de même dégâts, CT 500 vs CT 900 → l'IA préfère CT 500.
- **Pathfinding** : setup avec ennemi derrière un obstacle, destination A (chemin libre, distance 4) vs destination B (chemin bloqué, distance 2) → l'IA choisit A.

## Ordre d'exécution

1. Étape 4 (test LoS — confirme le bug ou invalide)
2. Étape 1 (terrain — le plus simple, autonome)
3. Étape 2 (CT — autonome)
4. Étape 3a (computePathDistance sur engine)
5. Étape 3b (remplace manhattanDistance dans scorer)
6. Étape 5 (tests unitaires des 3 fixes)
7. Gate CI

## Fichiers touchés

- `packages/core/src/ai/action-scorer.ts` — 3 fixes + constantes
- `packages/core/src/battle/BattleEngine.ts` — ajout `computePathDistance`
- `packages/core/src/ai/action-scorer.test.ts` — nouveaux tests
- `packages/core/src/battle/BattleEngine.los-legal-actions.test.ts` — nouveau fichier

## Gate CI

`pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

## Bilan (2026-04-25)

### Ce qui a été livré

- **Étape 1 — Terrain dangereux** : `action-scorer.ts` pénalise les destinations Magma/Lava/Swamp avec `DANGEROUS_TERRAIN_PENALTY = 8`, sauf pour les Pokemon immunisés (`isTerrainImmune`). Constante `DANGEROUS_TERRAINS` ajoutée.
- **Étape 3 — Pathfinding distance réelle** : `scoreMove` utilise désormais `engine.computePathDistance` (BFS sans budget) au lieu de `manhattanDistance`. Un ennemi derrière un obstacle infranchissable score à `Infinity` → l'IA ne gaspille plus ses mouvements vers des positions sans issue.
- **3 nouvelles méthodes publiques sur `BattleEngine`** : `getTileAt(position)`, `getPokemonTypes(pokemonId)`, `computePathDistance(from, to, pokemonId)`.
- **Étape 4 — Test LoS non-régression** : `BattleEngine.los-legal-actions.test.ts` confirme que les attaques Single-targeting sont bloquées par un pilier h=3, et que les moves sonores contournent correctement la LoS (comportement attendu, pas un bug).

### Ce qui a été différé

- **Étape 2 — CT-aware scoring** : appliquer un facteur `CT_REFERENCE_COST / ctCost` dans un scorer greedy monoronde fait choisir des moves moins puissants → les combats durent >5000 tours dans les tests de charge. Cette optimisation nécessite un lookahead multi-tour pour être bénéfique. **Déféré à un plan futur dédié à l'IA multi-tour.**

### Observation LoS résolue

L'observation "dégâts à travers le mur" était due à des moves avec `ignoresLineOfSight` (moves sonores/telluriques) — comportement correct et maintenant couvert par un test de non-régression.
