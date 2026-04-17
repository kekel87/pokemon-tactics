# Plan 061 — Silhouette d'occlusion (style Tactics Ogre)

**Statut : done**
**Créé le : 2026-04-17**
**Remplace** : section B du plan 060 (abandonnée). Le stash `plan-060-full-wip` est **conservé comme source** : la détection et la structure de sprite silhouette y sont correctes, seule l'initialisation des filtres Phaser 4 était buggée (voir étape 0).

---

## Contexte

Sur les cartes avec dénivelés (et à terme, décorations), les Pokemon passent derrière des tiles hautes et **disparaissent visuellement**. Le joueur perd le fil de où ils sont. La section A du plan 060 a livré le curseur FFTA ; la section B (silhouette) a été tentée mais l'implémentation stashée était bancale (API `filters.external.addMask` Phaser 4 récente, scope non maîtrisé, mélangé avec un refactor d'iso-depth sur les highlights). On repart de zéro, avec un cadrage clair.

---

## Besoin (validé avec l'humain)

Pour **tout Pokemon dont une partie du sprite est masquée** par un obstacle devant lui :
- **La partie visible du sprite reste normale** (couleurs, animation, détails — aucune altération).
- **La partie masquée devient une silhouette outline** : contour couleur équipe + remplissage semi-transparent (alpha ~0.4), rendu *à travers* l'obstacle.
- **Transition par pixel** : silhouette visible **uniquement là où l'obstacle couvre le sprite** — pas de ghost complet superposé.

### Scope

- Tous les Pokemon : alliés + ennemis.
- Actif tout le temps, pas de toggle settings.
- Obstacles : **terrain élevé (`elevation > 0`)** — phase 1 de ce plan.
- Décorations : **hors scope** (dépend du système de décorations Tiled, voir backlog). Extension future attendue : ajouter `visualHeight` à `OccluderTile` et un second passage de détection sur les tiles déco (cf. tableau Risques).
- Occlusion Pokemon-sur-Pokemon : hors scope.

### Référence

Tactics Ogre (PSP/SNES) et FFTA : quand une unité marche derrière un mur ou un arbre, on voit sa silhouette contour à travers.

---

## Approche technique

### Vue d'ensemble

Pour chaque Pokemon on rend **deux sprites superposés au même endroit** :
1. Le **sprite principal** (inchangé) rend normalement.
2. Un **sprite silhouette** cloné, teint + outline, n'apparaît que quand le Pokemon est occulté, et **masqué géométriquement** pour ne se dessiner QUE dans la zone couverte par la tile occultante.

Le sprite principal continue à se rendre avec son iso-depth normal (derrière l'obstacle, donc clipé). La silhouette, elle, est rendue **au-dessus de l'obstacle** (depth plus haute) et **limitée spatialement par un masque** à la forme de la face avant de l'obstacle — résultat : la silhouette n'apparaît que dans la zone où l'obstacle cache le sprite principal.

### Brique 1 — Détection d'occlusion

Module `packages/renderer/src/grid/occlusion.ts` :

```ts
export interface OccluderTile {
  x: number;
  y: number;
  elevation: number;
}

export function getOccludingTiles(
  pokemonX: number,
  pokemonY: number,
  grid: IsometricGrid,
): OccluderTile[];
```

Règle (iso, caméra en haut-gauche, Pokemon "devant" = depth plus faible = x+y plus petit) :
- Scanner les tiles dans la zone `(dx, dy)` avec `dx >= 0, dy >= 0, dx + dy <= MAX_DISTANCE`, exclure `(0, 0)`.
- Tile occultante si :
  - `elevation >= MIN_ELEVATION` (config)
  - Distance iso `(dx + dy)` ≤ `OCCLUSION_MAX_TILE_DISTANCE` (commencer à 2)
  - Alignement iso column : `|tile.column - pokemon.column| <= 1` où `column = x - y`

Tests unitaires dans `occlusion.test.ts` (∼6 cases) : adjacent devant tall → true, même iso-column à distance max → true, derrière → false, à plat → false, colonne différente → false.

### Brique 2 — Sprite silhouette

Modifier `PokemonSprite.ts` :

- Ajouter un `silhouetteSprite: Phaser.GameObjects.Sprite | null` créé en même temps que le sprite principal (même atlas, même frame courante via listener `ANIMATION_UPDATE`).
- Rendu silhouette :
  - `setTintFill(teamColor)` → remplissage uni couleur équipe
  - `setAlpha(OCCLUSION_ALPHA)` → ~0.4
  - **Outline** : API Phaser 4 `FilterList` — appeler `silhouetteSprite.enableFilters()` **obligatoirement** avant toute utilisation de `filters`, puis `silhouetteSprite.filters.internal.addGlow(teamColor, OCCLUSION_OUTLINE_STRENGTH, 0, 1, true)`. Le 5e paramètre `knockout: true` garde uniquement le contour (pas la texture). Signature : `addGlow(color?, outerStrength?, innerStrength?, scale?, knockout?, quality?, distance?)`.
  - `setVisible(false)` par défaut.
  - **Depth** : formule cohérente avec les tiles existantes — `DEPTH_GRID_TILES + (tile.x + tile.y) * DEPTH_TILE_MAX_ELEVATION + tile.elevation + DEPTH_POKEMON_SILHOUETTE_OFFSET`. Recalculée à chaque update de `setOccluded`.
  - **Note de layering** : la silhouette reste **sous `DEPTH_POKEMON_BASE = 520`**, donc elle disparaît derrière d'autres sprites Pokemon situés devant — comportement acceptable car occlusion Pokemon-sur-Pokemon est hors scope.
- **Masque (Phaser 4 FilterList)** : `silhouetteSprite.filters.external.addMask(maskGraphics, false, undefined, 'world')`.
  - `GeometryMask` est **Canvas-only** et n'est PAS utilisable en WebGL (le projet utilise WebGL). C'est pour ça que l'API `FilterList.addMask` existe — c'est la version WebGL-compatible.
  - `maskGraphics` est un `Phaser.GameObjects.Graphics` créé via `scene.add.graphics()` et ajouté **à la scène, pas au container**. `setVisible(false)` dessus reste correct.
  - Le 4e paramètre `viewTransform: 'world'` fait suivre le transform monde du Graphics (ce qu'on veut pour que le masque suive le tile à travers les zooms caméra).
  - Le `Graphics` est rempli avec le polygone face-avant de la tile occultante (brique 3).

API publique :
```ts
sprite.setOccluded(occluders: OccluderTile[]): void;
```
- Si `occluders.length === 0` → cache la silhouette, clear masque.
- Sinon → montre silhouette, reconstruit le masque à partir des polygones de chaque occluder.
- **Idempotence** : mémoriser la clé `occluders.map(t => ...).join("|")` pour ne pas reconstruire à chaque frame si inchangé.

### Brique 3 — Polygone face-avant d'une tile

`IsometricGrid` expose :
```ts
getOccluderFacePolygon(tile: OccluderTile): { x: number; y: number }[];
```

Retourne le polygone **face avant visible** (SE + SW + base, sans le top diamond) en coordonnées écran — c'est la surface par laquelle la silhouette doit "transparaître". Le polygone a 6 points : angles supérieurs droite/gauche + base en V + points intermédiaires sur le diamant top.

(Au runtime le masque est remis à l'échelle/position du monde via `GeometryMask` qui travaille en world-space.)

### Brique 4 — Orchestration

`GameController.updateOcclusionForAll()` :
- Pour chaque sprite, appeler `grid.getOccludingTiles(x, y)` et `sprite.setOccluded(occluders)`.
- Appelée :
  - Après chaque `animateMoveTo` (à chaque step du chemin).
  - Après un knockback / slide.
  - Après un KO (pour nettoyer).
  - Après une phase de placement (init).
- **Pas besoin de per-frame update** : les Pokemon ne bougent qu'entre phases discrètes. Hook sur `POST_UPDATE` uniquement pour la synchro position/flip de la silhouette avec le sprite principal.

### Brique 5 — Cas spéciaux

- **Pokemon KO** : masquer la silhouette, la détection est ignorée (le corps KO bloque la case mais n'a pas besoin de silhouette).
- **Confusion / damage flash** : inchangés sur le sprite principal ; la silhouette ne reflète pas ces effets visuels (elle reste en teint équipe uni).
- **Perf** : early-return dans `setOccluded` si la clé d'occluders est identique ; la construction du masque ne se refait que sur changement.

---

## Étapes

### Étape 0 — Spike API Phaser (FAIT)

Investigation des types Phaser 4.0.0-rc.6. Findings :

1. **`GeometryMask` est Canvas-only** — bannière explicite dans le type: `"GeometryMask is only supported in the Canvas Renderer. If you want to use geometry to mask objects in WebGL, see Phaser.GameObjects.Components.FilterList#addMask."` Le projet étant en WebGL, GeometryMask est exclu.
2. **`postFX.addGlow` n'existe plus** en Phaser 4 — remplacé par `FilterList.addGlow` sur le GameObject (via `enableFilters()` d'abord).
3. **Bug du stash précédent identifié** : dans `PokemonSprite.ts` stashé, `enableFilters()` n'était jamais appelé. Le chaîne `this.silhouetteSprite.filters?.internal.addGlow(...)` voyait `filters === null` et faisait un no-op silencieux via l'optional chaining. Même problème pour `filters?.external.addMask(...)`. Conséquence visuelle : silhouette apparaissait comme un sprite teinté plat, sans outline et sans masque → d'où les "problèmes" dont l'humain se souvenait.

Décision : on utilise l'API Phaser 4 `FilterList` (`enableFilters()` + `filters.internal.addGlow(..., knockout=true)` + `filters.external.addMask(graphics, false, undefined, 'world')`). Le stash reste exploitable comme source pour la détection et la structure sprite — on corrige juste l'init des filtres.

Pas de spike runtime nécessaire : l'API est documentée et typée, le bug du stash explique 100% des symptômes visuels connus. Si on rencontre un comportement imprévu à l'étape 2/3 (drift mask sous zoom caméra, filters cassés sur sprite dans container), on revient ici pour choisir une alternative (multi-sprite offset outline, `filters.external.addMask` avec `viewTransform: 'local'`).

### Étape 1 — Détection (stash resurrection)

- `constants.ts` : `OCCLUSION_MAX_TILE_DISTANCE = 2`, `OCCLUSION_MIN_TILE_ELEVATION = 1`, `OCCLUSION_ALPHA = 0.4`, `OCCLUSION_OUTLINE_STRENGTH = 4`, `DEPTH_POKEMON_SILHOUETTE_OFFSET = 0.25`.
- Extraire `grid/occlusion.ts` et `grid/occlusion.test.ts` du stash (fichiers clean, pas de conflit — logique `isOccludedBy` validée par 7 tests unitaires dans le stash).
- Ajouter `IsometricGrid.getOccludingTiles(pokemonX, pokemonY)` (adapté du stash) : scan des tiles avec `tilesByPosition` map (voir brique 3 pour le polygone).

### Étape 2 — Sprite silhouette (outline via FilterList, sans masque)

- `PokemonSprite` : ajouter `silhouetteSprite: Phaser.GameObjects.Sprite | null` créé en parallèle du sprite principal.
- **Correction du bug stash** : appeler `silhouetteSprite.enableFilters()` **avant** d'accéder à `filters`.
- Configurer : `setTintFill(teamColor)`, `setAlpha(OCCLUSION_ALPHA)`, `setDepth(...)`, `setVisible(false)`.
- `silhouetteSprite.filters.internal.addGlow(teamColor, OCCLUSION_OUTLINE_STRENGTH, 0, 1, true)` — signature complète avec `knockout: true` en 5e position.
- Sync frame via listener `ANIMATION_UPDATE` sur le sprite principal.
- Sync position/flip via hook `POST_UPDATE` sur la scène (ou dans `updatePosition`).
- `setOccluded(occluders)` : idempotent par clé, toggle visibilité + update depth en fonction de l'occluder (si plusieurs, prendre le plus haut).
- Test visuel intermédiaire : forcer `setOccluded([fakeTile])` via une touche debug et vérifier que la silhouette apparaît par-dessus, contour pur (knockout).

### Étape 3 — Masque via FilterList.addMask

- `IsometricGrid.getOccluderFacePolygon(tile)` : polygone face-avant en coords écran (adapté du stash).
- `PokemonSprite.rebuildSilhouetteMask(occluders)` :
  - Créer un `Phaser.GameObjects.Graphics` (hors container, dans la scène, `setVisible(false)`).
  - Remplir le Graphics avec le polygone face-avant concaténé de chaque occluder.
  - `silhouetteSprite.filters.external.addMask(maskGraphics, false, undefined, 'world')`.
  - Remove l'ancien mask avant d'en ajouter un nouveau (gérer le cas reconstruction).
- Test visuel : la silhouette n'apparaît QUE sur la face des obstacles.
- Test zoom caméra : la silhouette et le masque restent alignés sur les tiles quand on zoome/pan.

### Étape 4 — Orchestration

- `GameController.updateOcclusionForAll()` + hooks sur mouvement / KO / init.
- Vérifier que ça tourne en mode IA vs IA (plusieurs mouvements enchaînés).

### Étape 5 — Doc + design-system

- `docs/design-system.md` : section silhouette (alpha, outline, depths, couleur équipe, exemples visuels).
- `docs/backlog.md` : retirer l'item "silhouette occlusion" (fusionné ici).
- `STATUS.md` : MAJ phase.
- `docs/plans/README.md` : ajouter entrée 061.

### Étape 6 — Gate CI + visual check

- `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`.
- **Option humain** : tester soi-même en lançant le jeu OU `visual-tester` Playwright (proposer le choix à l'humain).

---

## Risques

| Risque | Parade |
|---|---|
| `postFX.addGlow` / `GeometryMask` instable dans un container en Phaser 4 | Spike étape 0 bloquant (3 points inclus zoom caméra + `roundPixels`) ; alternative multi-sprite offset pour outline, BitmapMask à la place |
| `maskGraphics` ajouté au container au lieu de la scène | `maskGraphics = scene.add.graphics()` ajouté à la scène (hors container), `setVisible(false)`. Le `GeometryMask` lit depuis le display list de scène |
| Silhouette qui "flash" quand le Pokemon change de tile | Idempotence sur clé d'occluders + sync `POST_UPDATE` |
| Depth de la silhouette mal calculée (passe sous la tile) | Test visuel étape 2 + 3, ajuster `DEPTH_POKEMON_SILHOUETTE_OFFSET` si besoin |
| Perf dégradée avec beaucoup de Pokemon | Early-bail sur clé inchangée, destruction du masque quand non-occulté, pas de per-frame update |
| Décorations absentes aujourd'hui | Scope phase 1 = terrain seul. Extension décorations nécessitera probablement d'étendre `OccluderTile` avec `visualHeight` distinct de `elevation` (déco peut occlure sans `elevation > 0`) — refactor d'interface mineur acceptable, pas d'architecture à reprendre |

---

## Critères de done

- [ ] Étape 0 spike validé (ou alternative approuvée par l'humain).
- [ ] Un Pokemon qui marche derrière une tile élevée → silhouette apparaît sur la face de la tile, sprite normal visible autour.
- [ ] Quand il sort → silhouette disparaît.
- [ ] Fonctionne pour allié et ennemi (couleurs équipes respectives).
- [ ] Pas de régression curseur (section A), highlights, preview, enemy range.
- [ ] KO → pas de silhouette résiduelle.
- [ ] `occlusion.test.ts` couvre les cas nominaux + edge cases.
- [ ] `docs/design-system.md` mis à jour.
- [ ] Gate CI passe.

---

## Hors scope (ne pas faire ici)

- Décorations (arbres, piliers) — plan séparé après le système de décorations Tiled.
- Occlusion Pokemon-sur-Pokemon.
- Toggle settings.
- Animation de fade-in/out de la silhouette (apparition instantanée).
