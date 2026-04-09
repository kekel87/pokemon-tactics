---
status: done
created: 2026-04-09
updated: 2026-04-09
---

# Plan 046 — Dénivelés, hauteur des tiles et dégâts de chute

## Objectif

Donner aux tiles une hauteur tactique réelle : le pathfinding tient compte du saut, les attaques
depuis la hauteur font plus de dégâts, les chutes (knockback hors d'une tile élevée) infligent des
dégâts proportionnels à la hauteur tombée. Le renderer empile visuellement les tiles surélevées et
décale les sprites selon leur hauteur.

## Contexte

Le plan 045 (Tiled) a posé les bases : la propriété `height` (int) est déjà lue depuis le tileset
Tiled et stockée dans `TileState.height`. `DerivedStats.jump` existe et le BFS de pathfinding
filtre déjà les tiles inatteignables si `heightDiff > jump`. `ActionError.JumpTooHigh` est présent.
Le knockback (`handle-knockback.ts`) déplace le Pokemon mais ignore la hauteur de la tile de
destination.

Ce plan active la mécanique : pathfinding complet avec coût de saut, bonus de hauteur sur les
dégâts, dégâts de chute lors d'un knockback (ou d'une poussée dans le vide), affichage iso
surélevé.

### Règles retenues (inspirées FFTA)

**Tiles et hauteurs :**
- `TileState.height` est un `number` — supporte les demi-tiles (0.5, 1.5, etc.)
- Tile pleine = 16px d'arête iso = hauteur 1.0 dans les données
- Demi-tile = 8px d'arête iso = hauteur 0.5 dans les données
- Les rampes/escaliers sont des séquences de tiles à hauteurs intermédiaires (0 → 0.5 → 1.0)

**Pathfinding :**
- `jump` par défaut : 0.5 (tout le monde peut sauter une demi-tile)
- **Montée ≤ 0.5** (demi-tile) : coût 1, animation Hop
- **Montée > 0.5** : bloqué (sauf Vol). Pour monter d'une tile pleine, il faut passer par une rampe
- **Descente** : toujours libre (coût 1), animation Hop si diff > 0.5. Pas de blocage en descente.
- **Vol** : coût toujours 1, jamais bloqué par la hauteur

**Portée mêlée et hauteur :**
- Les moves mêlée (range 1) sont bloqués si `heightDiff >= 2` entre l'attaquant et la cible
- Les moves à distance (range > 1) ne sont pas affectés par la hauteur pour le ciblage
- Un Pokemon sur une position haute est intouchable en mêlée depuis le sol — il faut monter ou
  utiliser des attaques à distance

**Bonus d'attaque par la hauteur :**
- +10 % de dégâts par niveau de hauteur d'avantage (attaquant plus haut que la cible)
- Plafonné à +50 % (5 niveaux d'avantage max)
- Symétrique : -10 % si l'attaquant est plus bas que la cible (attaquer vers le haut)
- Plafonné à -30 % (pas de punition trop sévère pour les attaques vers le haut)
- S'applique à tous les dégâts (physiques et spéciaux). Les moves statut ne font pas de dégâts.
- Flag `ignoresHeight` sur un move supprime ce modificateur (Séisme, Ampleur…)

**Dégâts de chute (punitifs — knockback uniquement) :**
- Déclenchés quand un knockback envoie un Pokemon vers une tile plus basse
- Seuil de sécurité : chute ≤ 1.0 = aucun dégât (réception normale)
- Par paliers entiers (`Math.floor(diff)`) :

  | Chute (diff) | Dégâts |
  |---|---|
  | ≤ 1.0 | 0 |
  | 2.0 | 33% maxHp |
  | 3.0 | 66% maxHp |
  | 4.0+ | **100% = MORT** |

- Types Vol : immunisés aux dégâts de chute
- Le Pokemon atterrit sur la tile de destination si passable ; si hors-grille ou impassable,
  knockback bloqué, pas de chute
- `Ténacité` (Endure) ne protège PAS des dégâts de chute
- Combo glace + knockback + précipice = positionnement létal
- **Dash dans le vide** : un move Dash/Charge qui emmène l'attaquant sur une tile plus basse
  applique les dégâts de chute à l'attaquant. Le prix de la témérité.
- Types Vol : immunisés (ils ne tombent pas)

**Animations de déplacement :**
- **Walk** : déplacement sur rampe/escalier (transition douce, le tween suit la hauteur de chaque tile)
- **Hop** : saut d'une demi-tile (montée ≤ 0.5) ou descente > 0.5
- Le sprite monte/descend visuellement en suivant le chemin tile par tile

## Étapes

### Étape 1 — Filtrage asymétrique montée/descente dans le BFS (core) (S)

- Créer `packages/core/src/battle/jump-cost.ts` avec la fonction pure
  `canTraverse(fromHeight: number, toHeight: number, isFlying: boolean): boolean`
  - Vol : retourne toujours `true`
  - Montée ≤ 0.5 (demi-tile) → `true`
  - Montée > 0.5 → `false` (bloqué, il faut passer par une rampe)
  - Descente : toujours `true` (jamais bloqué en descente)
  - Plat → `true`
- Écrire `packages/core/src/battle/jump-cost.test.ts` : ~10 cas unitaires (plat, montée 0.5,
  montée 0.5→1.0 via rampe, montée 1.0 direct bloqué, descente 0.5, descente 1.0, descente 2.0,
  vol monte 3.0, demi-tile transitions)
- Modifier `BattleEngine.getReachableTiles` (~ligne 721) : remplacer le filtre symétrique
  `Math.abs(heightDiff) > jump` par `canTraverse`. Passer `isFlying` via les types du Pokemon.
- Modifier `BattleEngine.validateMovePath` (~ligne 811) : même remplacement du filtre symétrique
  par `canTraverse` (les deux endroits partagent la même logique).
- Critère : tests passent, montée > 0.5 bloquée, descente libre, `pnpm typecheck` clean

### Étape 2 — Bonus de hauteur + blocage mêlée dans le calcul de dégâts (core) (S)

- Créer `packages/core/src/battle/height-modifier.ts` avec la fonction pure
  `getHeightModifier(attackerHeight: number, defenderHeight: number, ignoresHeight: boolean): number`
  - Retourne un multiplicateur `[0.7, 1.5]` selon les règles ci-dessus
  - Si `ignoresHeight === true` → retourne 1.0
- Créer `isMeleeBlockedByHeight(attackerHeight: number, defenderHeight: number, moveRange: number): boolean`
  - Retourne `true` si `moveRange === 1 && Math.abs(attackerHeight - defenderHeight) >= 2`
- Modifier `BattleEngine.getLegalActions` (~ligne 176, boucle de construction des `UseMove`) :
  pour chaque `targetPosition`, vérifier `isMeleeBlockedByHeight` et exclure la cible si bloquée
- Écrire `packages/core/src/battle/height-modifier.test.ts` : cas plat (1.0), +1 (1.1), +2 (1.2),
  +5 plafond (1.5), -1 (0.9), -3 plafond (0.7), ignore-height (1.0), mêlée bloquée à diff 2,
  mêlée OK à diff 1.5, ranged OK à diff 3
- Modifier `calculateDamage` dans `damage-calculator.ts` : ajouter un paramètre optionnel
  `heightModifier = 1.0` et l'appliquer après le calcul de dégâts de base (physiques ET spéciaux)
- Modifier `estimateDamage` : ajouter un paramètre optionnel `heightModifier?: number` (défaut 1.0).
  `BattleEngine.estimateDamage` calcule le modifier depuis `attacker.position` et `this.grid`
  puis le passe à la fonction pure
- Modifier `BattleEngine.executeUseMove` : calculer `heightModifier` depuis les positions de
  l'attaquant et de chaque cible, en lisant `ignoresHeight` depuis le move (nouveau flag optionnel
  sur `MoveDefinition`)
- Ajouter `ignoresHeight?: boolean` dans l'interface `MoveDefinition`
  (`packages/core/src/types/move-definition.ts`)
- Marquer Séisme (`earthquake` si présent dans les données) avec `ignoresHeight: true` dans
  `packages/data`
- Critère : tests passent, `estimateDamage` aussi, `pnpm typecheck` clean

### Étape 3 — Dégâts de chute lors d'un knockback (core) (M)

- Créer `packages/core/src/battle/fall-damage.ts` avec la fonction pure
  `calculateFallDamage(heightDiff: number, maxHp: number): number`
  - Par paliers : `const tiers = [0, 0, 33, 66, 100]`, indexé par `Math.floor(heightDiff)`
  - Retourne `Math.floor(tiers[palier] / 100 * maxHp)`, 0 si diff ≤ 1.0
- Écrire `packages/core/src/battle/fall-damage.test.ts` : cas diff 0.5 (0), diff 1.0 (0),
  diff 1.5 (0 — palier 1), diff 2.0 (33%), diff 3.0 (66%), diff 4.0 (100% = mort),
  diff 5.0 (100% plafonné)
- Modifier `handle-knockback.ts` : après avoir déterminé la `destination` finale, comparer les
  hauteurs et appeler `calculateFallDamage` si la destination est plus basse
  - Vérifier l'immunité Vol via `targetTypesMap` (déjà présent dans `EffectContext`)
  - Appliquer les dégâts : `target.currentHp = Math.max(0, target.currentHp - fallDamage)`
  - Émettre `BattleEventType.FallDamageDealt` avec `{ pokemonId, amount, heightDiff }`
  - Si `target.currentHp === 0` → émettre `BattleEventType.PokemonKo` directement
    (cohérent avec `handle-damage.ts` qui fait la même chose)
- Ajouter `FallDamageDealt: "fall_damage_dealt"` dans `BattleEventType`
- Ajouter dans `BattleEvent` :
  `| { type: typeof BattleEventType.FallDamageDealt; pokemonId: string; amount: number; heightDiff: number }`
- Compléter les tests de `handle-knockback` :
  - Knockback vers tile de même hauteur → aucun dégât de chute
  - Knockback descendant 1.0 → aucun dégât
  - Knockback descendant 2.0 → 33% maxHp
  - Knockback descendant 3.0 → 66% maxHp
  - Knockback descendant 4.0 → 100% maxHp = KO
  - Vol → aucun dégât de chute
- Modifier `dashMoveCaster` dans `BattleEngine.ts` (~ligne 644) : après le déplacement de
  l'attaquant, appliquer `calculateFallDamage` si la tile d'arrivée est plus basse.
  L'attaquant subit les dégâts. Émettre `FallDamageDealt` + `PokemonKo` si mort.
  - Test : Dash depuis h2 vers h0 → attaquant prend 33% maxHp
  - Test : Dash Vol → aucun dégât
  - Test : Endure ne protège PAS des dégâts de chute (comportement implicite — test explicite)
- Critère : 9+ tests passent, aucune régression

### Étape 4 — Test d'intégration : scénario de chute (core) (S)

- Créer `packages/core/src/battle/scenarios/fall-damage.test.ts`
- Scénario Gherkin :
  ```
  Given un Pokemon sur une tile hauteur 3
  And un ennemi sur une tile hauteur 3 à côté
  When l'ennemi utilise un move knockback sur le Pokemon
  Then le Pokemon atterrit sur la tile hauteur 0
  And FallDamageDealt est émis avec heightDiff=3
  And les dégâts sont 66% maxHp (palier 3)
  ```
- Scénario bonus : chute de 4+ = 100% maxHp = KO
- Scénario immunité Vol : aucun dégât de chute
- Étendre `buildMoveTestEngine` (ou `MockMap`) pour accepter un paramètre `heightMap` optionnel
  (grille avec hauteurs variables). Nécessaire pour tous les tests de chute et de hauteur.
- Critère : 3 scénarios passent, `buildMoveTestEngine` utilisé avec `heightMap`

### Étape 5 — Map Tiled avec dénivelés variés (data) (M)

- Créer `packages/renderer/public/assets/maps/highlands.tmj` — map 12×12 avec :
  - Zone centrale : plateau hauteur 2 (tiles 4×4 au centre)
  - Rampes latérales : tiles hauteur 1 de chaque côté du plateau (transition)
  - Fossé : tiles hauteur 0 en U autour du plateau (certaines en `water` ou `obstacle`)
  - Tiles hauteur 3 : tour isolée dans un coin (hauteur max pour les tests)
  - Spawns : 2 équipes, 3 positions chacune — une dans le fossé, une sur la rampe, une sur le
    plateau
  - Tileset embarqué avec propriétés `height` correctes (0, 1, 2, 3) et `terrain`
- Le tileset du tileset embarqué utilise le même `.tsj` que `test-arena.tmj`
- Critère : `parseTiledMap(highlands)` produit un `MapDefinition` valide avec des `height` variés,
  `pnpm test` passe le test de parse de cette map

### Étape 6 — Rendu isométrique surélevé dans `IsometricGrid` (renderer) (M)

- Modifier `gridToScreen(gridX, gridY, height = 0)` pour accepter un troisième paramètre optionnel
  - La hauteur décale le point de rendu vers le haut : `y -= height * TILE_ELEVATION_STEP`
  - Ajouter `TILE_ELEVATION_STEP = 8` dans `constants.ts` (8px par niveau de hauteur dans l'espace
    écran isométrique) et le documenter dans `docs/design-system.md`
- Modifier `drawGridFromTileData` : la méthode reçoit maintenant les données de hauteur par tile
  - Nouvelle signature : `drawGridFromTileData(tileData: readonly number[], heightData: readonly number[], firstgid: number)`
  - Chaque sprite est positionné avec `gridToScreen(x, y, heightData[index] ?? 0)`
  - Depth ajustée : `DEPTH_GRID_TILES + y - (heightData[index] ?? 0) * 0.1` pour que les tiles
    hautes soient rendues correctement dans l'ordre de profondeur
- Modifier `drawTexturedGrid` (carte statique) : même adaptation de depth, hauteur = 0 partout
  (carte plate existante inchangée fonctionnellement)
- Modifier `highlightTiles`, `showCursor`, `showPreview`, `highlightTilesOutline` : accepter un
  paramètre optionnel `height = 0` pour chaque position, décaler le highlight en conséquence
- Adapter `MapPreviewScene` pour passer les hauteurs issues du `MapDefinition` parsé à
  `drawGridFromTileData`
- Critère : `pnpm dev:map highlands.tmj` affiche les tiles à des hauteurs visuelles différentes,
  le plateau est visuellement surélevé

### Étape 7 — Décalage vertical des sprites Pokemon selon la hauteur (renderer) (S)

- Modifier `PokemonSprite.animateMoveTo(gridX, gridY)` : accepter un paramètre `height` optionnel,
  utiliser `gridToScreen(gridX, gridY, height)` pour calculer la position cible du tween
- Modifier `GameController.animateAlongPath` : pour chaque étape du chemin, récupérer la hauteur
  de la tile de destination depuis le `MapDefinition` et la passer à `animateMoveTo`
- Le sprite monte/descend visuellement en suivant le chemin tile par tile (le tween interpole
  naturellement entre les hauteurs)
- **Animation Hop** : si le `heightDiff` entre deux tiles consécutives du chemin est > 0.5
  (saut demi-tile en montée, ou descente d'un rebord), jouer `Hop` pour ce pas
- **Animation Walk** : si le `heightDiff` ≤ 0.5 (rampe douce, plat, légère pente)
- Placement initial (`spawnPokemon`) : positionner le sprite à la hauteur de la tile de spawn
- Shadows (ellipses au sol) : la shadow reste à la hauteur de la tile (pas de décalage shadow/sprite)
- Depth sorting : ajuster le depth du sprite en tenant compte de la hauteur
  (`DEPTH_POKEMON_BASE + gridX + gridY - height * 0.1`)
- Critère : dans `highlands.tmj`, un Pokemon sur le plateau (hauteur 2) s'affiche visiblement plus
  haut que les Pokemon dans le fossé. Hop visible quand on saute une demi-tile ou descend un rebord.
  Walk sur les rampes.

### Étape 8 — Feedback visuel des dégâts de chute (renderer) (S)

- Ajouter un handler `FallDamageDealt` dans `GameController` ou `BattleScene`
- Afficher un `BattleText` flottant avec `"Fall -XX"` au-dessus du Pokemon qui tombe
- Jouer l'animation `Hurt` sur le sprite (déjà disponible)
- Pas de flash rouge supplémentaire — l'animation `Hurt` suffit
- Critère : lors d'une chute lourde dans la démo, le texte flottant et l'animation se déclenchent

## Critères de complétion

- `pnpm test` passe — aucune régression, nouveaux tests ajoutés (jump-cost, fall-damage,
  height-modifier, scénarios d'intégration)
- `pnpm typecheck` + `pnpm lint` : zéro erreur
- `getJumpCost` : montée > 0.5 bloquée, descente toujours libre, Vol jamais bloqué
- `calculateFallDamage` : paliers 0/0/33/66/100 par `Math.floor(diff)`
- `getHeightModifier` : ±10%/niveau, plafonds +50%/-30%
- Knockback descendant 2.0 → 33%, 3.0 → 66%, 4.0 → mort
- Types Vol : aucun dégât de chute + coût de saut toujours 1
- `highlands.tmj` : map valide avec hauteurs 0, 0.5, 1, 1.5, 2, 3 (dont rampes)
- Tiles surélevées visuellement décalées dans le renderer
- Animation Hop sur les sauts de demi-tile et descentes de rebord
- Animation Walk sur les rampes
- Texte flottant `"Fall -XX"` lors d'une chute en combat

## Risques / Questions

- **Depth isométrique et hauteur** : les tiles hautes doivent être au-dessus des tiles basses
  adjacentes sur le même axe Y. Risque d'artefacts visuels si la profondeur n'est pas bien calculée.
  À tester visuellement avec la map `highlands.tmj`.
- **Coût de saut et IA** : l'IA utilise `getLegalActions` qui dépend de `getReachableTiles`. Le
  changement de filtrage ne casse pas l'IA mais peut changer les tiles atteignables. Valider
  avec le smoke test IA.
- **Tileset et tiles de hauteur** : le tileset JAO actuel n'a pas de tiles "falaise" ou
  "plateforme". Le rendu sera un décalage vertical des tiles de sol existantes — acceptable pour
  ce plan, les vraies tiles 3D seront pour le plan tileset custom.
- **Lévitation** : hors scope — le système de talents n'existe pas encore (Phase 4). Seul le
  type Vol donne l'immunité à la chute pour l'instant.
- **Fixture `highlands.tmj`** : placée dans `renderer/public/assets/maps/`. Les tests du parser
  dans `packages/data/` doivent pouvoir y accéder — utiliser une fixture en JSON inline dans les
  tests ou un chemin relatif vers le fichier.

## Dépendances

- **Avant** : Plan 045 terminé (format Tiled, `TileState.height` lu depuis les propriétés custom)
- **Débloque** :
  - Plan obstacles + line of sight (la hauteur influence la LOS)
  - Plan types de terrain (ampleur ignore hauteur — déjà préparé avec `ignoresHeight`)
  - Plan tileset custom (remplacer les tiles JAO par des tiles avec falaises visuelles)
  - Plan undo déplacement (le coût de saut variable complique légèrement le undo, à prévoir)
