---
status: done
created: 2026-04-14
updated: 2026-04-14
progress: toutes les étapes terminées — core + tests (1-17), maps sandbox par l'humain (18-20), renderer tint (21). Étape 22 déplacée au backlog.
---

# Plan 051 — Types de terrain + modificateurs

## Objectif

Implémenter les effets de terrain en combat : malus de mouvement, terrains dangereux (brûlure, poison, dégâts directs), bonus de dégâts type/terrain, évasion en tall_grass, et glissade sur ice après knockback.

## Contexte

Le tileset custom (plan 050) définit 11 TerrainType dont 9 actifs au combat (`normal`, `tall_grass`, `water`, `deep_water`, `magma`, `lava`, `ice`, `sand`, `snow`, `swamp` + `obstacle`). Les types sont déjà présents dans `terrain-type.ts`, la passabilité de `deep_water` et `lava` est déjà gérée (intraversables). Il reste à implémenter tous les effets de combat associés à ces terrains.

La règle globale d'immunité terrain (Vol/Lévitation) s'applique à tous les effets sauf la passabilité. Les types sont accessibles via `context.targetTypesMap` dans les handlers. La Lévitation n'est pas encore un talent — l'immunité sera portée par un type factice `Levitate` (ou via les types existants du Pokemon) ; **à confirmer avant implémentation** (voir Risques).

## Étapes

### Fondations

- [x] **Étape 1** — Ajouter les nouveaux `BattleEventType` nécessaires
  - `TerrainMovePenaltyApplied` : { pokemonId, terrain, penaltyAmount }
  - `TerrainDamageDealt` : { pokemonId, terrain, amount }
  - `TerrainStatusApplied` : { pokemonId, terrain, status } (pour poison swamp/brûlure magma au contact)
  - `TerrainEvasionApplied` : { pokemonId, terrain, stages }
  - `IceSlideApplied` : { pokemonId, from, to }
  - `IceSlideCollision` : { sliderId, targetId, damage }
  - Ajouter les variants correspondants dans `types/battle-event.ts`

- [x] **Étape 2** — Créer `packages/core/src/battle/terrain-effects.ts`
  - Fonctions pures sans side effects, testables unitairement
  - `getMovementPenalty(terrain, types): number` — retourne le malus de mouvement (0 si immunité)
  - `isTerrainImmune(terrain, types): boolean` — Vol ou Lévitation (règle globale)
  - `getTerrainTypeBonusFactor(terrain, moveType): number` — retourne 1.15 si bonus applicable, 1.0 sinon
  - `getTerrainStatusOnStop(terrain, types): StatusType | null` — retourne le statut appliqué à la fin de tour selon terrain
  - `getTerrainDotFraction(terrain): number | null` — dégâts direct terrain fin de tour (magma → 16, swamp → 0)
  - Exports depuis `packages/core/src/index.ts`

- [x] **Étape 3** — Tests unitaires pour `terrain-effects.ts`
  - `getMovementPenalty` : water/sand/snow → -1, swamp → -2, immunités (Eau, Sol, Glace, Poison, Vol)
  - `isTerrainImmune` : Flying immunise partout, normal = pas d'immunité
  - `getTerrainTypeBonusFactor` : water→Eau +15%, magma→Feu +15%, deep_water→Eau +15%, lava→Feu +15%, ice→Glace +15%, sand→Sol +15%, snow→Glace +15%, swamp→Poison +15%, autres → 1.0
  - `getTerrainStatusOnStop` : swamp→Poisoned (non immun), magma→Burned (non immun), autres → null
  - `getTerrainDotFraction` : magma → 16, autres → null

### Malus de mouvement (BFS)

- [x] **Étape 4** — Modifier le BFS dans `BattleEngine.getReachableTiles()`
  - Importer `getMovementPenalty` depuis `terrain-effects.ts`
  - Dans la boucle BFS, récupérer le terrain de `neighbor` et calculer le malus
  - Remplacer `current.distance + 1` par `current.distance + 1 + penalty` (coût variable par tile)
  - Les Pokemon immunisés ignorent le malus (penalty = 0)
  - Aussi appliquer dans `validateMovePath()` pour la validation des chemins soumis

- [x] **Étape 5** — Tests du BFS avec malus de terrain
  - Fichier : `packages/core/src/battle/BattleEngine.terrain-movement.test.ts`
  - Pokemon de type Normal sur map 5x5 avec une tile `water` : portée réduite de 1 autour de water
  - Pokemon de type Eau sur water : aucun malus
  - Pokemon de type Vol : aucun malus sur n'importe quel terrain
  - Pokemon sur swamp : portée réduite de 2 pour chaque tile swamp traversée
  - Soumettre un path trop long (terrain penalty rend chemin > movement) : `ActionError.PathTooLong`

### Bonus dégâts type/terrain

- [x] **Étape 6** — Intégrer le bonus dans `damage-calculator.ts`
  - Ajouter paramètre optionnel `attackerTerrain?: TerrainType` dans la signature de `calculateDamage`
  - Appliquer `getTerrainTypeBonusFactor(terrain, moveType)` comme multiplicateur final
  - Mettre à jour les appels dans `BattleEngine.executeUseMove()` pour passer `attackerTerrain`

- [x] **Étape 7** — Tests du bonus type/terrain dans `damage-calculator.test.ts`
  - Charmander (Feu) sur magma avec Flammèche → dégâts × 1.15 vs même attaque sur normal
  - Squirtle (Eau) sur water avec Pistolet-à-O → dégâts × 1.15
  - Charmander (Feu) sur water avec Flammèche → pas de bonus (mauvais terrain)
  - Pokemon Vol sur magma → pas de bonus (immunité terrain = pas d'effet terrain)

### Effets fin de tour (EndTurn handlers)

- [x] **Étape 8** — Créer `packages/core/src/battle/handlers/terrain-tick-handler.ts`
  - Handler EndTurn : itère sur tous les Pokemon actifs (currentHp > 0)
  - Récupérer le terrain de la tile courante via `state.grid`
  - **Swamp** : appliquer `StatusType.Poisoned` si non-immun et pas déjà Poisoned/BadlyPoisoned
    - Émettre `TerrainStatusApplied`
  - **Magma** : inflige 1/16 HP dégâts directs si non-immun (tick terrain en plus du tick brûlure)
    - Émettre `TerrainDamageDealt`
  - **Tall_grass** : +1 bonus d'évasion virtuel appliqué directement dans `checkAccuracy` (pas de modification de `statStages.evasion`). Aucun état modifié, aucune cumulation. Émettre `TerrainEvasionApplied` pour le renderer.
  - Gérer le KO si HP tombent à 0
  - Enregistrer dans `TurnPipeline` (EndTurn, après `statusTickHandler`)

- [x] **Étape 9** — Tests unitaires pour `terrain-tick-handler.ts`
  - Fichier : `packages/core/src/battle/handlers/terrain-tick-handler.test.ts`
  - Scénario Gherkin : Pokemon normal sur swamp fin de tour → StatusApplied Poisoned
  - Scénario : Pokemon Poison sur swamp fin de tour → pas de StatusApplied
  - Scénario : Pokemon Vol sur swamp fin de tour → pas d'effet
  - Scénario : Pokemon normal sur magma fin de tour → TerrainDamageDealt 1/16 HP
  - Scénario : Pokemon Feu sur magma fin de tour → pas de TerrainDamageDealt
  - Scénario : Pokemon sur tall_grass → +1 évasion stage
  - Scénario : Pokemon déjà empoisonné sur swamp → pas de double-poison
  - Scénario : terrain tick tue un Pokemon (HP → 0) → PokemonKo émis

### Brûlure au passage sur magma

- [x] **Étape 10** — Appliquer StatusType.Burned lors du passage sur magma dans `executeMove()`
  - Dans la boucle de déplacement path par path dans `BattleEngine.executeMove()`
  - Si une tile intermédiaire du path est `magma` ET Pokemon non-immun → appliquer Burned
  - Émettre `TerrainStatusApplied`
  - Ne pas appliquer si déjà Burned
  - Note : la tile d'arrivée est gérée par le terrain-tick-handler en EndTurn

- [x] **Étape 11** — Tests pour brûlure au passage (magma traversal)
  - Fichier : `packages/core/src/battle/BattleEngine.terrain-status.test.ts`
  - Scénario : Pokemon Normal traverse magma → StatusApplied Burned émis pendant le move
  - Scénario : Pokemon Feu traverse magma → pas de Burned
  - Scénario : Pokemon Vol traverse magma → pas de Burned
  - Scénario : Pokemon déjà Burned traverse magma → pas de double-burn

### Glissade sur ice après knockback

- [x] **Étape 12** — Extraire `applyDashWallFallDamage` en helper partagé
  - Créer `packages/core/src/battle/apply-impact-damage.ts` avec fonction `applyImpactDamage(pokemon, heightDiff, events)`
  - Remplacer l'appel dans `BattleEngine` par import de ce helper
  - Mettre à jour `handle-knockback.ts` pour utiliser ce même helper (actuellement inline)
  - Ce refactor est prérequis à l'étape ice slide pour partager la logique de collision

- [x] **Étape 13** — Tests unitaires pour `apply-impact-damage.ts`
  - Dégâts corrects selon heightDiff
  - KO si HP tombent à 0
  - Pas de dégâts si heightDiff ≤ 1.0

- [x] **Étape 14** — Implémenter la glissade ice dans `handle-knockback.ts`
  - Après `KnockbackApplied`, si la tile de destination est `ice` ET Pokemon non-immun (Flying/Glace) :
    1. Continuer à avancer tile par tile dans la direction du knockback
    2. S'arrêter sur première tile non-ice OU mur OU Pokemon OU bord
    3. **Collision mur** (tile non-ice impassable ou hors bornes) → appeler `applyImpactDamage` sur le slideur
    4. **Collision Pokemon** → `applyImpactDamage` sur le slideur ET la cible (même montant), émettre `IceSlideCollision`; la cible ne glisse PAS
    5. **Bord ou falaise** → fall damage si hauteur diff > 0 (logique existante `calculateFallDamage`)
    6. Mettre à jour `grid.setOccupant` et `pokemon.position` à chaque étape
    7. Émettre `IceSlideApplied` { from, to }
  - Pokemon de type Glace : immunité glissade (pas de slide)
  - Pokemon de type Vol : immunité glissade

- [x] **Étape 15** — Tests de la glissade ice
  - Fichier : `packages/core/src/battle/handlers/handle-knockback.ice-slide.test.ts`
  - Scénario Gherkin : Pokemon Normal knockbacké sur tile ice → glisse jusqu'à tile non-ice
  - Scénario : glissade s'arrête sur mur (tile impassable) → ImpactDamage émis
  - Scénario : glissade s'arrête sur Pokemon cible → IceSlideCollision dégâts aux deux, cible ne glisse pas
  - Scénario : glissade s'arrête sur bord de carte → pas de crash, KnockbackBlocked si au bord
  - Scénario : glissade + chute (tile de fin ice + falaise) → FallDamageDealt
  - Scénario : Pokemon Glace knockbacké sur ice → pas de glissade
  - Scénario : Pokemon Vol knockbacké sur ice → pas de glissade
  - Scénario : plusieurs tiles ice consécutives → glisse sur toutes

### Intégration BattleEngine

- [x] **Étape 16** — Enregistrer `terrainTickHandler` dans `BattleEngine`
  - Ajouter import et enregistrement dans le constructeur `BattleEngine` (EndTurn pipeline, après `statusTickHandler`)
  - Vérifier que `turnPipeline` expose bien un moyen d'enregistrer des handlers EndTurn

- [x] **Étape 17** — Test d'intégration scénario complet (Gherkin)
  - Fichier : `packages/core/src/battle/terrain-integration.test.ts`
  - Scénario : Squirtle sur water avec Pistolet-à-O → dégâts plus élevés (+15%) vs sur normal
  - Scénario : Bulbasaur traverse swamp → Poisoned, tick fin de tour → DamageDealt
  - Scénario : Charmander sur magma → pas de TerrainDamageDealt (immunité Feu)
  - Scénario : Charizard (Vol) sur swamp → pas de Poisoned, pas de malus de mouvement
  - Scénario : Pokemon knockbacké sur ice glisse et entre en collision avec un second Pokemon

### Maps sandbox

- [x] **Étape 18** — Créer `sandbox-ice.tmj` (map test glissade)
  - `sandbox-fall-1` à `sandbox-fall-4` mis à jour par l'humain avec tiles ice en bordure de falaise
  - Objectif initial atteint : tester knockback + glissade + chute

- [x] **Étape 19** — Créer `sandbox-magma.tmj` (map test brûlure + tick)
  - `sandbox-flat` mis à jour par l'humain avec tous les types de terrain (couvre magma, swamp, tall_grass, water, ice, etc.)
  - Objectif initial atteint : tester les effets terrain en condition flat

- [x] **Étape 20** — Mettre à jour `sandbox-slopes.tmj` si besoin
  - Couvert par la mise à jour de `sandbox-flat` et `sandbox-fall-*`

### Rendu (renderer)

- [x] **Étape 21** — Tinter les tiles terrain dans `IsometricGrid`
  - Overlay semi-transparent par terrain type ajouté dans `IsometricGrid`
  - Couleurs avec préfixe `TERRAIN_TINT_` dans `packages/renderer/src/constants.ts`
  - Note : visibilité de l'overlay à confirmer selon la depth (reporté pour observation)
  - 3 nouveaux event handlers renderer : `TerrainDamageDealt` (texte flottant), `IceSlideApplied` (animation slide), `LethalTerrainKo` (texte "Fondu!" / "Noyé!")

- [ ] **Étape 22** — Afficher le terrain dans le tooltip / InfoPanel au hover *(déplacé au backlog)*
  - Ajouter `terrain` dans la info de la tile affichée dans le curseur ou panel info
  - Texte i18n FR/EN : `"Terrain : Marécage"` / `"Terrain: Swamp"`
  - Clés i18n dans les fichiers de traduction existants

## Bugfixes post-implémentation

- **KO létal terrain** : atterrir sur `lava` ou `deep_water` tue le Pokemon (sauf immunités : Feu sur lava, Eau sur deep_water, Vol partout). Nouvel event `LethalTerrainKo`. Renderer : texte "Fondu!" / "Noyé!". Handler dans `terrain-tick-handler.ts`.
- **Règle un seul statut majeur** : les handlers terrain (brûlure passage magma, poison swamp EndTurn) utilisent désormais `isMajorStatus` — un Pokemon avec un statut majeur existant ne reçoit pas de second statut terrain.
- **Évasion tall_grass redesignée** : l'implémentation initiale (statStages.evasion +1/tour) était cumulative et trop forte. Redesign : +1 bonus d'évasion virtuel appliqué directement dans `checkAccuracy` uniquement si le Pokemon est sur tall_grass au moment du calcul. Aucune modification de state, aucune cumulation. Décision #246.

## Critères de complétion

- Tous les tests passent (`pnpm test`) : les nouvelles mécaniques terrain ont leurs tests unitaires et d'intégration
- `pnpm typecheck` et `pnpm lint` clean (0 erreurs)
- Le BFS respecte bien les malus de mouvement (vérifiable en sandbox avec un Pokemon Eau vs Normal sur water)
- Les ticks terrain s'exécutent correctement en fin de tour (brûlure passage magma, poison swamp, dégâts magma)
- La glissade ice fonctionne après un knockback (vérifiable sur `sandbox-ice.tmj`)
- Les overlays terrain sont visibles dans le renderer sans perturber la lisibilité
- Le bonus +15% type/terrain est calculé correctement dans les dégâts

## Risques / Questions

- **Lévitation comme immunité** : la Lévitation n'est pas encore implémentée comme talent. Pour ce plan, l'immunité terrain "Lévitation" sera portée uniquement par le type `Flying` — les talents arrivent en Phase 4. Cette décision est à documenter dans `decisions.md`.
- **Malus de mouvement et pathfinding** : le BFS actuel utilise un `distance` entier. Avec des malus fractionnaires futurs, il faudrait un coût flottant. Pour ce plan : les malus sont entiers (-1 ou -2), pas de flottants.
- **Bonus terrain et estimateDamage** : vérifier que `estimateDamage()` (preview dégâts dans le renderer) reçoit aussi `attackerTerrain` pour que la preview soit correcte.
- **Tall_grass évasion** : le `+1 évasion stage` est appliqué en EndTurn — il persiste tant que le Pokemon reste sur tall_grass. Risque de cumul infini si le Pokemon ne bouge pas. Décision : réinitialiser l'évasion liée au terrain en StartTurn, puis ré-appliquer si toujours sur tall_grass en EndTurn. À confirmer avant implémentation de l'étape 8.
- **Ice slide et chaîne knockback** : un Pokemon glissant sur ice peut heurter un autre Pokemon qui n'est pas sur ice. Comportement attendu : la cible ne glisse jamais (seul le slideur originel glisse).
- **Compatibilité parser Tiled** : les tiles des nouvelles maps sandbox devront avoir la propriété `terrain` correctement définie. Vérifier le format attendu par `parseTiledMap`.

## Dépendances

- **Prérequis** : Plan 050 terminé (tileset custom, TerrainType déjà dans les maps)
- **Ce plan débloque** : Plan "Interactions type/terrain + modification terrain par attaques" (Phase 3 roadmap), et indirectement les talents Lévitation (Phase 4)
