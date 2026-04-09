# Rendu isométrique avec hauteur — état final

Ce document décrit le système de rendu isométrique avec dénivelés utilisé par le jeu.
Pour l'historique des tentatives et les pièges évités, voir la section "Journal des décisions" en bas.

Contexte : jeu tactique Pokemon x FFTA en Phaser 4 + Tiled, tileset ICON Isometric (Jao).

---

## Convention visuelle

### Constantes clés (`packages/renderer/src/constants.ts`)

| Constante | Valeur | Signification |
|-----------|--------|---------------|
| `TILE_WIDTH` | 32 | Largeur du diamond iso en pixels |
| `TILE_HEIGHT` | 16 | Hauteur du diamond iso en pixels |
| `TILE_ELEVATION_STEP` | 16 | Pixels d'écart vertical par unité de hauteur logique |
| `TILE_ORIGIN_Y` | 1.0 | Anchor du sprite au **bottom-center** (convention Tiled iso) |
| `DEPTH_TILE_MAX_ELEVATION` | 5 | Facteur pour le depth sorting avec hauteur |

### Formule de projection

`gridToScreen(gridX, gridY, height)` retourne la position à l'écran où dessiner un point à cette position logique :

```
screenX = (gridX - gridY) * TILE_WIDTH / 2 + offsetX
screenY = (gridX + gridY) * TILE_HEIGHT / 2 + offsetY - height * TILE_ELEVATION_STEP
```

Le point retourné est le **centre visuel du diamond top face** d'une tile à cette `(gridX, gridY, height)`.

### Sprite origin

Tous les sprites de tiles utilisent `setOrigin(0.5, 1.0)` (bottom-center), ce qui matche la convention Tiled pour les maps isométriques. Le sprite est ancré au bas de sa bounding box.

---

## Architecture Tiled : multi-layers

### Convention de nommage des layers

Les layers de terrain sont nommés :
- `terrain` — élévation 0 (base, au sol)
- `terrain_1` — élévation 0.5
- `terrain_2` — élévation 1.0
- `terrain_3` — élévation 1.5
- `terrain_4` — élévation 2.0
- ...
- `terrain_N` — élévation `N * 0.5`

Chaque layer représente **un demi-niveau d'empilement**. Un "bloc plein" visuel se construit en peignant la même tile sur deux layers consécutifs (ex: `terrain_0` + `terrain_2`).

### Layer `offsety` dans Tiled

Pour que le rendu dans l'éditeur Tiled corresponde au rendu en jeu, chaque layer `terrain_N` doit avoir `offsety = -N * 8` en pixels. Ce décalage est purement visuel dans Tiled — notre parser l'ignore et utilise le suffixe du nom de layer.

### Layers supplémentaires

- `decorations` : tilelayer optionnel pour les décorations visuelles (ignoré par le gameplay)
- `spawns` : objectgroup pour les points de spawn des équipes

---

## Calcul de la heightmap

### Propriétés des tiles dans le tileset

Chaque tile du tileset peut avoir ces propriétés custom :
- `height` (float) : hauteur logique en unités de demi-tile (0.5 = demi-bloc, 1 = bloc plein)
- `terrain` (string) : type de terrain (`normal`, `water`, `lava`, etc.)
- `slope` (string, optionnel) : direction de la pente si c'est une tile de pente/escalier (`north`, `south`, `east`, `west`, `southeast`)

Voir `docs/tileset-mapping.md` pour la liste complète des IDs du tileset ICON.

### Formule de la hauteur

```
cell.height = layer.elevation + tile.height
```

Où :
- `layer.elevation` = `N * 0.5` (extrait du nom `terrain_N`)
- `tile.height` = propriété custom de la tile dans le tileset

**Exemples** :
- Bloc plein (`height: 1`) sur `terrain` → `0 + 1 = 1.0`
- Demi-tile (`height: 0.5`) sur `terrain` → `0 + 0.5 = 0.5`
- Bloc plein sur `terrain_2` → `1.0 + 1 = 2.0`
- Demi-tile sur `terrain_1` → `0.5 + 0.5 = 1.0`
- Demi-tile sur `terrain_6` → `3.0 + 0.5 = 3.5`

### Règle du layer le plus haut

Quand plusieurs layers ont une tile à la même position, **le layer le plus haut détermine la hauteur finale**. Le parser itère les layers du plus bas au plus haut et écrase la valeur à chaque fois.

### Parser

Le parsing se fait en deux étapes dans `packages/data/src/tiled/parse-tiled-map.ts` :

1. **Layer base** : `parseTerrainLayer` crée `TileState[][]` depuis le layer `terrain` uniquement
2. **Layers supérieurs** : pour chaque `terrain_N`, mettre à jour `tile.height = elevation + tile.height_property` et `tile.terrain` à chaque position non-vide

---

## Rendu des sprites

### Formule de `spriteY`

```typescript
spriteY = gridToScreen(x, y, layer.elevation).y + TILE_HEIGHT / 2
```

C'est-à-dire : `sprite bottom position = layer elevation + halfH`.

**Pourquoi ?** Les sprites du tileset ICON ont leur contenu visuel aligné sur le **bas** du canevas 32×32 (avec des zones transparentes au-dessus pour les demi-tiles). Avec `setOrigin(0.5, 1.0)` et cet offset, le **diamond center** du sprite tombe exactement à `gridToScreen(x, y, logical_height)`.

### Depth sorting

```typescript
depth = DEPTH_GRID_TILES + (x + y) * DEPTH_TILE_MAX_ELEVATION + layer.elevation
```

Le facteur `(x + y) * 5` garantit que les tiles "devant" (x+y plus grand) sont dessinées sur les tiles "derrière". La composante `layer.elevation` assure qu'à même position, les tiles hautes s'affichent par-dessus les basses.

---

## Animation des déplacements en hauteur

Les Pokemon se déplacent tile par tile sur un path retourné par le core. Pour
chaque step du path, le renderer choisit une **animation** (sprite frames) et
une **trajectoire** (tween) en fonction du dénivelé et de la nature des tiles
source/cible.

### Modèle logique : `MovementStep`

Décrit dans `packages/renderer/src/game/movement-animation.ts` :

```typescript
interface MovementStep {
  heightDiff: number;  // |targetHeight - sourceHeight|
  isRamp: boolean;     // slope property sur la tile source OU cible
  isFlying: boolean;   // type Vol du pokemon
}
```

### Règle jump vs walk

Une step est un **jump** si elle change de hauteur ET qu'aucune des deux tiles
n'a de propriété `slope`. Les rampes (tiles avec `slope: north/south/east/west`)
permettent la traversée à hauteur variable sans déclencher un saut visuel.

| Situation | heightDiff | isRamp | Animation | Trajectoire |
|-----------|------------|--------|-----------|-------------|
| Plat | 0 | × | `Walk` | Linéaire |
| Rampe (0.5 up/down) | 0.5 | ✓ | `Walk` | Linéaire |
| Cliff 0.5 up (non-volant) | 0.5 | ✗ | `Hop` | 2-axis asymmetric |
| Cliff 1.0 down (non-volant) | 1.0 | ✗ | `Hop` | 2-axis asymmetric |
| Cliff any (volant) | ≥ 0.5 | ✗ | `FlapAround` / `Hover` / `Special10` / `Hop` (premier dispo) | 2-axis asymmetric |

La descente volontaire est limitée à 1.0 pour les non-volants
(`MAX_DESCENT` dans `packages/core/src/battle/height-traversal.ts`). Les
knockbacks et dashes peuvent provoquer des drops plus grands qui déclenchent
les dégâts de chute.

### Fallback animations volantes

`FLYING_JUMP_ANIMATION_CANDIDATES = ["FlapAround", "Hover", "Special10"]` dans
`movement-animation.ts`. Pour un pokemon volant qui saute, le sprite essaie
ces animations dans l'ordre et utilise la première qui existe dans son atlas ;
sinon fallback sur `Hop` via `selectMovementAnimation`. **Aucun sprite du
roster actuel n'a ces animations de vol** — le fallback `Hop` s'applique
toujours. Quand les assets seront intégrés, ajuster la trajectoire 2-phase
pour les volants (voir `docs/backlog.md` > "Animations de vol").

### Trajectoire : single diagonal tween avec easing Y asymétrique

Implémentée dans `PokemonSprite.animateMoveTo`. Un **seul** tween par step,
avec easing par axe via `props` :

```typescript
scene.tweens.add({
  targets: container,
  duration,
  props: {
    x: { value: endScreen.x, ease: "Linear" },
    y: {
      value: endScreen.y + POKEMON_SPRITE_GROUND_OFFSET_Y,
      ease: isAscent ? "Quad.easeOut" : "Quad.easeIn",
    },
  },
});
```

- **Montée** (`Quad.easeOut` sur Y) : Y arrive vite près de la cible pendant
  que X avance. Le sprite se cale rapidement à la bonne hauteur puis finit
  sa traversée horizontale.
- **Descente** (`Quad.easeIn` sur Y) : Y reste longtemps près de la source
  puis chute vite à la fin. Le sprite marche par-dessus le vide et tombe au
  dernier moment.
- **Plat / rampe** : un seul tween linéaire sur x et y, pas de `props`.

**Pourquoi un seul tween et pas un 2-phase séquentiel** : le sprite `Hop` du
pack PMDCollab a déjà un lift vertical dans ses frames. Un 2-phase (rise
in place puis walk) empilerait ce lift avec un lift supplémentaire du
container, et les pokemon sauteraient deux fois trop haut.

### Durées (`constants.ts`)

| Constante | Valeur | Cas d'usage |
|-----------|--------|-------------|
| `MOVE_TWEEN_DURATION_MS` | `300` | Walk plat ou rampe |
| `MOVE_TWEEN_DURATION_FLYING_MS` | `400` | Walk plat pour un volant (glide plus lent) |
| `JUMP_TWEEN_DURATION_MS` | `800` | Jump de toute nature — matche la durée du `Hop` sprite anim (≈792 ms) pour qu'elle joue en entier sur un escalier |

`selectMovementDuration(step)` (dans `movement-animation.ts`) applique ces
règles en fonction de `isJumpStep` et `isFlying`.

### Depth sorting pendant le tween

Pendant un tween de mouvement, le sprite passe visuellement par-dessus ou à
travers des colonnes de tiles adjacentes. Pour éviter le clipping,
`animateMoveTo` force :

```typescript
container.setDepth(Math.max(sourceDepth, targetDepth));
```

au début du tween et snap à `targetDepth` exact dans `onComplete`. Le max
garantit que le sprite reste au-dessus de toutes les tiles qu'il traverse,
quelle que soit la direction du mouvement.

### Redémarrage des animations one-shot

`PokemonSprite.playAnimation` skip un appel seulement si l'anim courante est
loopée (`currentAnim.repeat === -1`) ET en cours de lecture. Les animations
one-shot (`Hop`, `Attack`, `Hurt`, `Faint`) redémarrent à chaque appel — sans
ça, sur un escalier, le `Hop` du premier step continuait sur le deuxième
au lieu de rejouer à zéro.

### Exposition de `slope` au renderer

Le parser Tiled (`parse-tiled-map.ts`) construit un tableau
`slopeData: (string | null)[]` indexé par `y * width + x`, propagé via
`ParseSuccess.slopeData` → `LoadedTiledMap.slopeData` →
`IsometricGrid.drawGridFromTileData(..., slopeData)`. `IsometricGrid` expose
ensuite `isSlopeAt(x, y): boolean` consommé par `GameController.animateAlongPath`.

---

## Mouse picking (screen-to-grid)

### Algorithme `screenToGridWithHeight`

Itère **toutes les cellules** de la grille et teste si la souris est dans le **top diamond strict** de chaque tile à sa hauteur :

```typescript
for each (x, y) in grid:
  height = getTileHeight(x, y)
  center = gridToScreen(x, y, height)
  dx = mouseX - center.x
  dy = mouseY - center.y
  if |dx|/halfW + |dy|/halfH <= 1:
    // Click inside the top diamond of this tile
    depth = (x + y) * DEPTH_TILE_MAX_ELEVATION + height
    if depth > bestDepth:
      bestMatch = (x, y)
      bestDepth = depth

return bestMatch ?? null
```

**Caractéristiques** :
- **Seul le top diamond** est cliquable (pas les faces latérales des blocs empilés)
- En cas de chevauchement (edge case rare), la cellule avec le plus grand depth visuel gagne
- Retourne `null` si aucun top diamond n'est sous la souris (curseur caché)

### Curseur et overlays

Le curseur (`showCursor`) et les overlays (`drawTile`, `drawTileOutline`) dessinent un diamond centré sur `gridToScreen(x, y, heightData[x, y])`. Comme `spriteY` est calculé pour que le diamond center du sprite soit à cette même position, le curseur s'aligne parfaitement sur le top visible de chaque tile — y compris pour les demi-tiles et les blocs empilés.

---

## Structure du `LoadedTiledMap`

Retourné par `loadTiledMap(url)` dans `packages/renderer/src/maps/load-tiled-map.ts` :

```typescript
interface LoadedTiledMap {
  map: MapDefinition;                         // Pour le core
  elevationLayers: ElevationLayer[];          // Layers bruts pour le rendu
  heightData: number[];                       // heightmap flat (pour cursor/picking)
  slopeData: (string | null)[];               // Direction de pente par cellule (null = flat)
  firstgid: number;
}
```

`slopeData` est indexé comme `heightData` (`y * width + x`). Une cellule
avec `slopeData[index] !== null` est considérée comme une rampe et est
traversée en animation `Walk` même si le `heightDiff` est non nul (voir
"Animation des déplacements en hauteur" plus haut).

---

## Pièges identifiés

1. **Égalité flottante** : toujours utiliser une tolérance (`Math.abs(a - b) < 0.001`) pour comparer des hauteurs (0.5, 1.0, 1.5, ...), jamais `===`.

2. **Sprite origin** : `TILE_ORIGIN_Y = 1.0` matche la convention Tiled pour les maps isométriques. Tout changement impacte tous les sprites de terrain et casse l'alignement du curseur.

3. **Décalage `spriteY`** : la formule `center.y + halfH` est sensible. Si on change de tileset avec une convention différente (contenu en haut du canevas plutôt qu'en bas), cet offset devra être réajusté.

4. **Layers avec `offsety` dans Tiled** : purement visuel pour l'éditeur, notre parser l'ignore et utilise le suffixe du nom. Si vous renommez un layer, son élévation change. Si vous changez `offsety` sans renommer, seul Tiled sera désynchronisé.

5. **Tileset ICON — variantes de demi-tile** : le tileset a parfois **plusieurs tiles de demi-bloc pour le même terrain** (ex: roche id 115 ET id 159). Toutes doivent avoir `height: 0.5, terrain: normal` dans les propriétés. Sans propriétés, une tile est traitée comme `height: 0`.

6. **Tiles flottantes** : le rendu ne remplit PAS automatiquement les layers en dessous d'une tile isolée. Un bloc sur `terrain_4` sans rien en dessous apparaîtra "flottant". Le level designer doit peindre les layers inférieurs manuellement ou utiliser les faces latérales visibles du sprite.

7. **Tileset embarqué vs externe** : actuellement chaque map embarque ses 76+ tile definitions (dupliquées). À migrer vers un `.tsj` externe dans un futur plan "Tileset custom".

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `packages/data/src/tiled/parse-tiled-map.ts` | Parser principal, multi-layers + heightmap |
| `packages/data/src/tiled/parse-terrain-layer.ts` | Parse du layer base |
| `packages/data/src/tiled/tileset-resolver.ts` | Résolution GID → propriétés (terrain, height) |
| `packages/data/src/tiled/tiled-types.ts` | Types TiledMap, TiledLayer, TiledTileset |
| `packages/renderer/src/maps/load-tiled-map.ts` | Chargement runtime + construction LoadedTiledMap |
| `packages/renderer/src/grid/IsometricGrid.ts` | gridToScreen, screenToGrid, dessin des tiles/overlays/curseur, `isSlopeAt` |
| `packages/renderer/src/sprites/PokemonSprite.ts` | `animateMoveTo` (single diagonal tween + easing Y asymétrique), `playAnimation` |
| `packages/renderer/src/game/movement-animation.ts` | `MovementStep`, `isJumpStep`, `selectMovementAnimation`, `selectMovementDuration`, `FLYING_JUMP_ANIMATION_CANDIDATES` |
| `packages/renderer/src/game/GameController.ts` | `animateAlongPath` — construit le `MovementStep` et orchestre anim + trajectoire |
| `packages/core/src/battle/height-traversal.ts` | `canTraverse` — `MAX_CLIMB = 0.5`, `MAX_DESCENT = 1.0`, volants exemptés |
| `packages/renderer/src/scenes/MapPreviewScene.ts` | Scène de preview des cartes Tiled (dev:map) |
| `packages/renderer/src/scenes/MapPreviewUIScene.ts` | UI overlay (info cursor) |

---

## Journal des décisions

Cette section garde l'historique des tentatives et des erreurs pour éviter de les refaire.

### Décision 1 : Multi-layers au lieu de propriété par tile

**Problème initial** : comment représenter des hauteurs variées dans Tiled ?

**Tentative 1** : un seul layer `terrain` avec propriété `height` par instance de tile. **Ne marche pas** : Tiled ne supporte pas les propriétés custom par instance sur un tilelayer (seulement par type de tile dans le tileset).

**Solution finale** : plusieurs layers nommés `terrain_N` où N est l'élévation × 2. Chaque layer a un `offsety` visuel dans Tiled. Le parser lit le suffixe pour déterminer la hauteur.

### Décision 2 : Formule de la heightmap

**Tentative 1** : `cell.height = layer.elevation` (ignorer `tile.height`). **Problème** : ne distingue pas un bloc plein d'une demi-tile sur le même layer, impossible d'avoir des stacks mixtes.

**Tentative 2** : `cell.height = layer.elevation + tile.height`. **Problème initial** : le curseur se trouvait 1 tile au-dessus visuellement car le sprite n'était pas dessiné à la bonne position.

**Solution finale** : garder la formule `elevation + tile.height` ET corriger la formule `spriteY` pour que le sprite's diamond center tombe au bon endroit.

### Décision 3 : Origin des sprites

**Tentative 1** : `setOrigin(0.5, 0.25)` (quart haut, ancienne convention du renderer POC). **Problème** : fonctionne par hasard pour les blocs pleins (contenu en haut du sprite) mais décale les demi-tiles (contenu en bas du sprite). L'anchor tombait dans la zone transparente supérieure.

**Solution finale** : `setOrigin(0.5, 1.0)` (bottom-center), convention Tiled pour les maps isométriques. Matche le tileset ICON. Tous les sprites s'alignent correctement.

### Décision 4 : Formule de `spriteY`

**Tentative 1** : `spriteY = center.y + TILE_HEIGHT` (= `+16`). **Problème** : les diamond centers des tiles n'étaient pas à `center.y` mais décalés.

**Tentative 2** : `spriteY = center.y + halfH + TILE_HEIGHT * tile.height`. **Problème** : alignait visuellement tous les diamond tops (demi-tile et bloc plein sur le même layer apparaissaient à la même hauteur). Incorrect car un bloc plein doit être visuellement plus haut qu'une demi-tile sur le même layer.

**Solution finale** : `spriteY = center.y + halfH` (= `+8`). La différence visuelle entre blocs pleins et demi-tiles vient **naturellement du contenu du sprite** (32px visible pour un bloc, 24px pour une demi-tile).

### Décision 5 : Algorithme de screen-to-grid

**Tentative 1** : itération avec `virtualY = mouseY + candidateHeight * step` puis `screenToGridFlat`. **Problème** : quand la souris est sur la face latérale d'un bloc (pas sur le top diamond), le fallback sur `screenToGridFlat` retourne une cellule voisine incorrecte.

**Tentative 2 (naive)** : tester le top diamond de chaque cellule, priorisation par `depth = (x+y) + height`. **Problème initial** : le centre testé était à `gridToScreen(x, y, height)` mais les sprites étaient dessinés avec un offset qui ne matchait pas, créant un décalage de 1 tile.

**Solution finale** : même algorithme naïf (test strict du top diamond), mais avec `spriteY` corrigé de sorte que `gridToScreen(x, y, heightData[x, y])` = diamond center du sprite. Plus de fallback. Si la souris n'est dans aucun diamond, `null` (curseur caché).

### Décision 6 : Variante demi-tile roche

**Problème** : le tileset ICON a deux tiles de demi-bloc roche (id 115 et id 159). Sur highlands, le user avait utilisé id 159 sans définir ses propriétés → la tile avait `height: 0` par défaut.

**Solution** : ajouter `height: 0.5, terrain: normal` à id 159 dans les map definitions. Documenté dans `tileset-mapping.md`.

---

## Sources de recherche

- [Handling Height in Isometric Tile Maps — Erik Onarheim](https://erikonarheim.com/posts/handling-height-in-isometric/)
- [Isometric Tiles Math — Clint Bellanger](https://clintbellanger.net/articles/isometric_math/)
- [Ways to implement height on isometric tiles — Godot Forum](https://forum.godotengine.org/t/ways-to-implement-height-on-isometric-tiles/123842/4)
- [Phaser Isometric Game Tutorial 2025 — Generalist Programmer](https://generalistprogrammer.com/tutorials/phaser-isometric-game-tutorial)
- [Mouse Maps for Isometric Height Maps — GameDev.net](https://gamedev.net/tutorials/programming/general-and-gameplay-programming/mouse-maps-for-isometric-height-maps-r2026/)
- [Isometric TileMaps — Excalibur.js](https://excaliburjs.com/docs/isometric/)
