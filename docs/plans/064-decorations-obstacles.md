---
status: done
created: 2026-04-18
updated: 2026-04-19 (done : toutes étapes MVP livrées, gate CI vert, marquages arène restent en bonus différé)
---

# Plan 064 — Décorations et obstacles Tiled (herbe haute, rochers, arbre, marquages arène)

> Implémenté sur le renderer Phaser actuel. Le rewrite renderer Babylon (Phase 3.5) sera numéroté au moment de sa rédaction et portera ces décorations en 3D.

## Objectif

Ajouter un système de décorations visuelles et d'obstacles sur les maps Tiled, cohérent avec le gameplay existant (terrain `obstacle`, hauteur, règles Vol/Spectre). 4 types de décor générés avec **PixelLab** (MVP) :

1. **Herbe haute** — placée **automatiquement** par le renderer sur chaque tile `tall_grass`. Le Pokemon est visible *derrière* (occlusion visuelle par depth). Zéro impact gameplay supplémentaire (le bonus d'évasion +1 du terrain `tall_grass` existe déjà — plan 051).
2. **Rocher 1×1×1** — 1 tile, `height=1`, `terrain=obstacle`. Traversable par **Spectre** (pas d'arrêt) et **Vol** (arrêt possible en haut). 1 slot volant au-dessus.
3. **Rocher 2×2×2** — zone 2×2 tiles, `height=2`, `terrain=obstacle`. Traversable par Spectre, 4 slots volants au-dessus.
4. **Arbre 1×1×3** — 1 tile, `height=3`, `terrain=obstacle`. 1 slot volant au-dessus. **Traversable par Spectre** (règle unique "Ghost traverse tous les obstacles", décision design 2026-04-18).

**Bonus différé (section dédiée en fin de plan)** : marquages arène + pokeball centrale — sortis du MVP le 2026-04-19. La pokeball peinte au sol couvre plusieurs tiles, ce qui complique la génération PixelLab monolithique. Sera traité en fin de plan, avec l'option de le faire à la main (retouche sprite) ou par code (décalcage procédural multi-tiles).

### Équilibre vérifié

- **Vol perché + mêlée** : confirmé 2026-04-18 — `isMeleeBlockedByHeight` (core/battle/height-modifier.ts:36) utilise `Math.abs(diff) >= 2`, donc un Vol sur rocher 2×2×2 (height=2) vs ennemi au sol (height=0) voit sa mêlée **bloquée dans les deux sens**. Le Vol perché reste un tireur d'embuscade (+20% dégâts à distance, immunité terrain, LoS), pas un intouchable offensif. OK.
- **Spectre traverse tout** : non abusif — Spectre ne peut pas **s'arrêter** sur un obstacle, donc après avoir traversé il finit sur une tile normale et se retrouve exposé. Avantage de pathfinding, pas avantage défensif.
- **Herbe haute + évasion** : terrain `tall_grass` donne déjà +1 évasion (plan 051). La décoration ne fait que matérialiser visuellement cet effet. Pas de cumul.

## Contexte

- Plans 045 / 046 / 047 / 050 / 051 : format Tiled stabilisé, hauteurs + LOS + terrains + tileset PMD custom livrés.
- Le layer `decorations` est **déjà prévu** dans le format Tiled (plan 045) mais en tant que `tilelayer` — ce plan le repasse en **objectgroup** pour supporter les Tile Objects à tailles variables. Actuellement le parser émet un simple warning s'il est absent, **aucune donnée extraite**.
- Règle Vol sur `Obstacle` : déjà implémentée (`canTraverse` passe `isFlying=true` partout → le vol peut s'arrêter sur une tile obstacle haute).
- Règle Spectre sur `Obstacle` : **non implémentée**. Le plan 045 l'a documentée comme règle (« Spectre : traverse, pas d'arrêt ») mais le core ne la connaît pas encore. Ce plan l'ajoute en **étape 0 (prérequis)** — c'est techniquement une dette du plan 045, sortie ici pour débloquer les obstacles traversables.
- Pipeline tileset PMD établi (plan 050) — scripts Python. Pour les décorations on part sur **PixelLab** (décision humain 2026-04-18) : briefs textuels + tiles iso générées par l'outil MCP `create_isometric_tile` ou `create_map_object`.

## Décisions arrêtées

- **Numéro de plan : 064**.
- **Outil génération : PixelLab** pour tous les sprites (MCP). Validation visuelle humaine obligatoire avant intégration.
- **Herbe haute** : auto-placée côté renderer (pas d'édition Tiled manuelle). Détection des tiles `tall_grass` → instanciation sprite en overlay.
- **Obstacles = objets Tiled uniques (Option B, validé 2026-04-19)**. Chaque obstacle est **1 Tile Object** placé sur un **objectgroup** nommé `decorations`, référençant 1 sprite unique (pas de découpage en quarts). Le parser Tiled dérive l'empreinte sol depuis les propriétés custom (`footprint_width`, `footprint_height`, `height_units`) et **patche automatiquement le `MapDefinition`** en passant les tiles concernées en `terrain=obstacle` + `height=N`. Single source of truth = l'objet.
- **Slots volants au-dessus = émergents (validé 2026-04-19)**. Pas de mécanique "perch point" dans le core. Un Pokemon Vol peut déjà s'arrêter sur une tile `obstacle` à `height=N` (règle existante plan 046). Les "4 slots" du rocher 2×2 sont naturellement les 4 tiles supérieures du bloc, sans code supplémentaire.
- **Sprite rocher 2×2 = 1 image unique 64×64 (validé 2026-04-19)**. Tileset decorations = **Collection of Images** Tiled (pas un atlas à grille fixe) → tiles de tailles variables acceptées.
- **Ghost traverse tous les obstacles** (règle unique, y compris l'arbre, validé humain 2026-04-19) — plus simple à apprendre qu'une exception, équilibré par l'impossibilité de s'arrêter dessus.
- **Spectre = type `PokemonType.Ghost`** déjà présent dans l'enum (pas d'ajout de type).

**Tailles PNG calibrées** sur la projection iso du projet (`TILE_WIDTH=32, TILE_HEIGHT=16`, 1 unité de hauteur = 16px vertical) :

| Sprite | Empreinte | Hauteur | PNG | MCP PixelLab |
|---|---|---|---|---|
| Herbe haute | 1×1 | — | 32×32 | `create_isometric_tile` |
| Rocher 1×1×1 | 1×1 | 1 | 32×32 | `create_map_object` |
| Rocher 2×2×2 | 2×2 | 2 | 64×64 | `create_map_object` |
| Arbre 1×1×3 | 1×1 | 3 | 48×80 (tronc + canopée débordante) | `create_map_object` |

Formule : sprite = `max(W,D)·32` wide × `((W+D)·8 + H·16)` tall. Canopée arbre = +16px largeur + feuillage débordant en haut.

## Workflow Tiled (placement d'un obstacle)

**Pré-requis tileset** : `decorations.tsj` doit contenir `"objectalignment": "bottom"` (défaut iso, mais on l'explicite). Ça force le pixel (x, y) de chaque Tile Object à pointer vers le **centre-bas** du sprite = le bout du bas de la cellule d'ancre sol.

1. **Une fois** par `.tmj` : ajouter un **object layer** nommé `decorations` (clic droit dans les layers > Add Object Layer). Référencer le tileset externe `decorations.tsj` via Map > Add External Tileset.
2. **Pour chaque obstacle à poser** :
   - Outil `Insert Tile` (raccourci T).
   - Sélectionner le sprite dans le panel tileset (ex. `rock-2x2x2.png`). Les propriétés `kind`, `footprint_*` et `height_units` sont héritées de la tile du tileset — rien à saisir sur l'objet.
   - Cliquer sur la carte pour placer. **La position pixel (object.x, object.y) détermine l'ancre grille en jeu** — plus besoin de properties `anchorX`/`anchorY`.
3. **Pas de modif manuelle du layer terrain** : `loadTiledMap` patche automatiquement les tiles concernées en `obstacle` + `height` (additif : `tile.height += height_units`) au chargement.

**Formule de dérivation** (iso, parser `parseDecorationsLayer`) :
- `anchorX = floor(object.x / halfTileWidth)` — avec `halfTileWidth = tileWidth / 2` (16 en 32×16)
- `anchorY = floor(object.y / tileHeight)` — (16 en 32×16)

**Ancre pixel par sprite** — le bottom-center du PNG doit coller au bout-bas de la cellule d'ancre. Pour éviter un décalage visuel, on corrige directement le padding transparent dans le PNG source (pas de property runtime). Les sprites `rock-1x1x1.png` et `tall-grass.png` ont été retouchés manuellement après génération PixelLab (palettes et dimensions ajustées — **note** : propriétés `anchor_offset_x/y` retirées, les marges sont dans les PNG directement). Calibrer avec le debug footprint.

**Bug iso footprint W>1** — pour un sprite qui couvre un footprint WxH (ex : rocher 2×2), le bottom-center doit être placé au bout-bas du diamant **englobant** (cellule `(anchorX + W − 1, anchorY)`), pas au bout-bas de la cellule d'ancre seule. Fix dans `DecorationsLayer.placeObjectSprite`.

> **Debug** : si un sprite n'apparaît pas en jeu, vérifier d'abord les `gid` dans le `.tmj`. Pour un tileset Collection of Images, l'ordre des tiles dans le `.tsj` (id=0, 1, 2…) détermine le mapping `gid = firstgid + id`. Exemple actuel : `firstgid=75` (decorations-demo) + `tall_grass=id 0 → gid 75`, `rock_1=id 1 → gid 76`, `rock_2x2=id 2 → gid 77`, `tree=id 3 → gid 78`.

> **Debug visuel** : un carré rouge translucide est dessiné sur chaque cellule du footprint via le toggle **"Footprint"** dans le SandboxPanel (section "Debug map"). Propagé via `SandboxConfig.debugDecorationsFootprint` → `new DecorationsLayer(..., { debugFootprintEnabled })`. Aucune constante compile-time — le toggle est runtime uniquement.

## Étapes

### Étape 0 — PRÉREQUIS : règle Ghost traverse obstacle (core) (S)

> Sortie du plan 045 en dette technique. Peut être implémenté séparément (petit plan isolé) ou consommé comme première étape du plan 064.

- Étendre `canTraverse` dans `packages/core/src/battle/height-traversal.ts` pour accepter `isGhost: boolean` + `toTerrain: TerrainType`.
  - Ghost sur `Obstacle` : traverse sans restriction de hauteur.
  - Ghost sur les autres terrains : règles normales (hauteur).
- Introduire `canStopOn(terrain, isGhost, isFlying): boolean` — Ghost ne peut pas s'arrêter sur `Obstacle`, Vol peut, Normal non.
- Mise à jour des call sites dans `BattleEngine.ts` (ligne 802, 893, 1063, 1083) + `handle-knockback.ts` (226) — passer `isGhost` (dérivé de `pokemonTypes.includes(PokemonType.Ghost)`) et le `toTerrain`.
- Tests unitaires : Spectre traverse rocher `height=2`, ne s'arrête pas dessus ; Spectre + Vol se comportent en Vol (priorité Vol).
- Tests d'intégration scénario : Ectoplasma (Ghost) passe à travers un rocher 1×1×1 pour atteindre une cible cachée derrière.

### Étape 1 — Parser : extraction des objets decorations + patch terrain (data) (M)

- Modifier `packages/data/src/tiled/parse-tiled-map.ts` : le layer `decorations` (**objectgroup**, pas tilelayer) est parsé, les Tile Objects extraits dans **`ParseSuccess.decorationObjects: readonly DecorationObject[]`** avec :
  ```ts
  type DecorationObject = {
    readonly gid: number;
    readonly kind: 'rock_1' | 'rock_2x2' | 'tree';
    readonly anchorX: number;          // coord grille de l'ancre sol (sud)
    readonly anchorY: number;
    readonly footprintWidth: number;   // 1 ou 2
    readonly footprintHeight: number;  // 1 ou 2
    readonly heightUnits: number;      // 1, 2 ou 3
  };
  ```
- **Patch auto du `MapDefinition`** : après extraction, pour chaque obstacle, passer les tiles de l'empreinte (`anchorX..anchorX+footprintWidth-1`, `anchorY-footprintHeight+1..anchorY`) en `terrain=obstacle` + `height=heightUnits`. Appliqué **avant** la validation `validateTiledMap` pour que le core valide une map cohérente.
- Cas d'erreur : obstacle qui sort de la map, ou qui écrase une tile déjà non-traversable incompatible → erreur de parsing avec message explicite.
- Tests parser :
  - Map avec 1 rocher 2×2 → 4 tiles patchées en `obstacle height=2`.
  - Map avec rocher partiellement hors grille → erreur.
  - Map sans layer decorations → parsing OK, `decorationObjects = []`.

### Étape 2 — Tileset `decorations.tsj` : Collection of Images (data) (S)

- Créer `packages/renderer/public/assets/tilesets/decorations/decorations.tsj` — **tileset Tiled de type "Collection of Images"** (chaque tile = 1 PNG individuel, taille variable). Référencé par les `.tmj` en parallèle de `tileset.tsj`.
- PNGs individuels dans `packages/renderer/public/assets/tilesets/decorations/` :
  - `tall-grass.png` (32×32)
  - `rock-1x1x1.png` (32×32)
  - `rock-2x2x2.png` (64×64)
  - `tree-1x1x3.png` (48×80)
- Propriétés custom par tile (dans Tiled) :
  - `kind: string` — `tall_grass | rock_1 | rock_2x2 | tree`
  - `footprint_width: int` — 1 ou 2
  - `footprint_height: int` — 1 ou 2
  - `height_units: int` — 0 (herbe) / 1 / 2 / 3
- Mettre à jour `docs/tileset-mapping.md` avec un nouveau tableau pour decorations.

### Étape 3 — Critères PixelLab communs (assets — référence) (S)

**Critères d'acceptation communs** à tous les briefs PixelLab des étapes suivantes :
- Palette cohérente avec le tileset terrain plan 050 (style PMD — Pokemon Mystery Dungeon — saturation modérée, shading doux)
- Vue iso stricte (pas top-down pur), compatible avec la projection iso du renderer (`TILE_WIDTH=32, TILE_HEIGHT=16`)
- Fond transparent
- Arêtes nettes (pixel art, pas de flou)

**Validation visuelle humaine** obligatoire avant intégration. `asset-manager` orchestre la génération, ne valide pas seul.

### Étape 4 — Génération PixelLab : herbe haute (assets) (M)

- Brief PixelLab :
  - Touffe d'herbe haute 32×32, style PMD / Pokemon Mystery Dungeon, vue iso légère, densité modérée, palette compatible avec la texture `tall_grass` du tileset terrain (vert vif). Fond transparent. Anchor `overlay` (posée devant/autour du Pokemon).
- 1 variante MVP, **le sprite doit masquer ~60-70% de la hauteur d'un Pokemon** pour l'effet "je suis caché dans l'herbe".
- Livrable : frames intégrées dans `decorations.png`.

### Étape 5 — Génération PixelLab : rochers (assets) (M)

- Brief PixelLab (`create_map_object`) :
  - **Rocher 1×1×1** : 32×32, bloc de roche grise/brune iso, style PMD, texture cohérente avec le terrain `rock` existant du tileset.
  - **Rocher 2×2×2** : **1 sprite 64×64 unique** (pas de quarts). Bloc de roche iso 2×2 de base, 2 unités de haut (=32px vertical).
- Livrables : `rock-1x1x1.png` et `rock-2x2x2.png` dans `packages/renderer/public/assets/tilesets/decorations/`, entrées correspondantes dans `decorations.tsj` avec propriétés custom (`kind`, `footprint_width`, `footprint_height`, `height_units`).

### Étape 6 — Génération PixelLab : arbre (assets) (M)

- Brief PixelLab (`create_map_object`) :
  - Arbre 1×1×3 = sprite 48×80 (empreinte sol 1×1 mais canopée qui déborde en largeur et en hauteur). Tronc marron, feuillage style PMD, ombre portée implicite.
- Le sprite dépasse verticalement et latéralement la tile d'ancre — son rendu doit occulter les Pokemon qui seraient derrière (depth = y de la tile de base).
- Livrable : `tree-1x1x3.png` + entrée dans `decorations.tsj` (`kind=tree`, `footprint_width=1`, `footprint_height=1`, `height_units=3`).

### Étape 7 — Renderer : affichage des objets decorations (renderer) (M)

- Créer `packages/renderer/src/grid/DecorationsLayer.ts` — itère sur `parseResult.decorationObjects` et instancie un sprite Phaser par objet.
- Charger chaque PNG du tileset Collection of Images dans le preload de la scène (`rock-1x1x1.png`, `rock-2x2x2.png`, `tree-1x1x3.png`, `tall-grass.png`).
- Positionnement : le sprite est ancré au **bottom-center** (`setOrigin(0.5, 1.0)`), placé sur le coord écran iso de la tile d'ancre sud de l'empreinte.
- Depth : `DEPTH_DECORATIONS_OVERLAY + anchorY` — trié par Y grille comme les sprites Pokemon, occlusion iso naturelle.
- Constantes `DEPTH_DECORATIONS_OVERLAY` dans `packages/renderer/src/constants.ts`, documentées dans `docs/design-system.md`.

### Étape 8 — Herbe haute : auto-placement + occlusion (renderer) (M)

> Fusion des ex-étapes 8 et 9 (même feature, mêmes sprites).

- **Auto-placement** : dans `DecorationsLayer`, après avoir dessiné le layer `decorations` explicite, itérer sur les tiles du `MapDefinition`. Pour chaque tile `terrain === TerrainType.TallGrass`, instancier un sprite herbe haute (frame `kind = tall_grass` du tileset decorations). Skip si une déco est déjà posée à la main sur cette tile (éviter le double-dessin). La **règle 100% auto** est explicite : jamais d'édition manuelle d'herbe haute dans Tiled, le layer terrain en `tall_grass` suffit.
- **Occlusion** : depth du sprite herbe = `DEPTH_POKEMON_BASE + gridY + 0.5` — le Pokemon sur la tile est masqué sous l'herbe (tête qui dépasse).
- Validation : un Bulbasaur placé sur une tile `tall_grass` apparaît avec la tête visible au-dessus de l'herbe, corps masqué.

### Étape 9 — Map de démo `decorations-demo.tmj` (data) (S)

- Créer `packages/renderer/public/assets/maps/decorations-demo.tmj` — 10×10, terrain mixte :
  - Zone herbe haute (4 tiles `tall_grass`)
  - Rocher 1×1×1 (1 objet déco + patch auto `obstacle height=1` sur 1 tile)
  - Rocher 2×2×2 (1 objet déco + patch auto `obstacle height=2` sur 4 tiles)
  - Arbre 1×1×3 (1 objet déco + patch auto `obstacle height=3` sur 1 tile)
- Servie comme map par défaut pour validation visuelle.
- **Marquages arène + pokeball** : ajoutés seulement si la section bonus est livrée.

### Étape 10 — Test d'intégration Spectre traverse (core) (S)

- Créer `packages/core/src/battle/scenarios/ghost-traversal.test.ts`.
- Scénario Gherkin :
  ```
  Given une map 5×5 avec un rocher 1×1×1 (obstacle height=1) en (2,2)
  And Ectoplasma (Ghost) en (0,2)
  And Bulbasaur en (4,2)
  When Ectoplasma planifie un chemin vers (4,2)
  Then le chemin passe par (2,2) (traversée spectre)
  But Ectoplasma ne peut pas s'arrêter en (2,2)
  ```
- Scénario bonus : Ectoplasma + Vol → traverse et peut s'arrêter (Vol prime).

### Étape 11 — Visual check + documentation port Babylon (renderer + docs) (S)

- Lancer `pnpm dev` sur `decorations-demo.tmj`, valider :
  - Les 4 types de décor s'affichent correctement
  - L'herbe haute masque bien les Pokemon dessus
  - Le rocher 2×2×2 a 4 tiles walkable par le haut pour les Vol
  - L'arbre dépasse visuellement mais ne masque pas les Pokemon devant
  - La pokeball centrale + marquages sont sous les sprites
- Screenshots dans `.screenshots/plan-064/` pour review humain.
- **Documenter les décisions de port Babylon** dans `docs/next.md` (section Babylon rewrite) : herbe haute = billboard 3D ou sprite screen-space ? rochers/arbre = meshes 3D ou billboards ? marquages = décalques de sol (`DecalMap`) ou sprites plaqués ?

## Bonus — Marquages arène + pokeball centrale (différé 2026-04-19)

> Sorti du MVP le 2026-04-19 parce que la pokeball peinte au sol couvre plusieurs tiles (pas un sprite 32×32 monolithique), ce qui complique la génération PixelLab. À traiter seulement après la livraison du MVP.

**3 approches possibles, à trancher au moment de faire le bonus** :

1. **PixelLab avec sprite multi-tiles découpé à l'import** : générer 1 sprite pokeball 96×96 ou 128×128 via `create_map_object`, le découper en quarts 32×32 côté script Python (pipeline plan 050), les poser sur un layer `decorations_ground` (tilelayer, pas objectgroup, parce que plat au sol). Même technique que pour le tileset terrain. Risque : coutures visibles si l'IA produit un dégradé non continu.
2. **Peinture manuelle dans Aseprite** : l'humain peint la pokeball et les marquages directement dans un PNG atlas `arena-markings.png`, même workflow que les marquages du plan 043. Le plus simple visuellement, mais demande ~1h de travail manuel.
3. **Génération procédurale par code** : un petit shader / post-process dessine un cercle pokeball centré sur une zone de la map, en overlay. Zéro asset, 100% paramétrable (centre, rayon, couleur), mais plus de code que d'intérêt visuel — probablement pas worth it pour un MVP.

**Recommandation par défaut** : **approche 2 (Aseprite manuel)** si l'humain veut juste une arène visuelle propre, **approche 1** si on tient à rester 100% PixelLab.

**Étapes du bonus** (une fois l'approche choisie) :
- Générer / peindre les sprites (pokeball + 2-4 variantes de lignes).
- Les intégrer au tileset decorations (ou dans un atlas séparé `arena-markings.png`).
- Ajouter un layer `decorations_ground` (tilelayer) dans `decorations-demo.tmj` avec les marquages posés.
- Vérifier le depth : `DEPTH_DECORATIONS_GROUND = DEPTH_GRID_TILES + 0.5` (au-dessus du sol, sous tout le reste).
- Pas de patch `MapDefinition` : les marquages sont décoratifs purs, ne touchent pas le gameplay.

## Critères de complétion

- `pnpm test` + `pnpm typecheck` + `pnpm lint` + `pnpm test:integration` : zéro erreur.
- Nouveau type `Ghost` traverse `Obstacle` dans `canTraverse`, couvert par tests unitaires + intégration.
- Parser extrait les objets du layer `decorations` (objectgroup) et patche automatiquement le `MapDefinition` avec les tiles `obstacle` + `height` correspondantes.
- Tileset `decorations.tsj` (Collection of Images, tailles variables) chargeable depuis un `.tmj`.
- 3 types d'obstacles + herbe haute générés via PixelLab, intégrés dans le tileset decorations.
- Marquages arène + pokeball = bonus différé, non requis pour la complétion du MVP.
- Herbe haute auto-placée sur toutes les tiles `tall_grass` sans édition manuelle.
- Pokemon sur `tall_grass` visuellement masqué par l'herbe (tête dépasse).
- Rocher 1×1×1 / 2×2×2 / arbre 1×1×3 posés correctement sur `decorations-demo.tmj`, avec les tiles `obstacle` + `height` correspondantes dans le layer terrain.
- Spectre (Ectoplasma) peut planifier un chemin à travers un rocher.
- Vol peut se poser sur un rocher 1×1×1 (1 slot) ou 2×2×2 (4 slots).

## Risques / Questions

- **PixelLab iso vs top-down** : le MCP `create_isometric_tile` produit des tiles iso. L'herbe haute et les rochers demandent un rendu iso strict — vérifier cohérence avec les sprites PMD existants. Si incohérence, fallback sur sprites fan-made ou retouche manuelle.
- **Arbre 1×1×3 et occlusion** : un arbre de 3 tiles de haut occupe verticalement de l'espace au-dessus de la tile de base. Si un Pokemon se trouve **derrière** l'arbre (plus loin en Y), il doit être occulté. Si **devant** (plus proche), il passe devant. Le tri par `y` de la tile de base résout ça naturellement, mais à vérifier sur des cas limites (Pokemon pile à côté).
- **Spectre et slot volant** : un Spectre qui aurait aussi le type Vol (aucun Gen 1 n'est dans ce cas, mais hypothétique) doit prioriser Vol (arrêt possible). `canStopOn` à bien ordonner.
- **Empreinte 2×2 et patch `MapDefinition`** : si un mappeur pose un rocher 2×2 qui chevauche une tile eau/lave, le patch en `obstacle` écrase le terrain spécial. À documenter comme contrainte de mapping (objectif : erreur de parsing explicite si chevauchement terrain incompatible).
- **Performance** : plusieurs dizaines de sprites décor (herbe haute auto-placée sur 20+ tiles) sur une grosse map. Vérifier que Phaser tient le FPS — un `SpriteGroup` avec frustum culling devrait suffire.
- **Rewrite Babylon à venir (Phase 3.5)** : tout ce travail est **à porter** sur Babylon ensuite. L'étape 11 produit un court doc dans `docs/next.md` listant les décisions 3D à prendre (billboards herbe haute, meshes rochers/arbres, décalques sol pour marquages).
- **Arbre 1×1×3 et tri par Y** : Phaser trie les sprites par `depth` scalaire. Le sprite arbre (32×96) est ancré sur la tile de base mais dépasse 2 tiles au-dessus en Y-screen. Un Pokemon pile derrière (même Y grille) peut se retrouver mal trié. Solution simple : `depth = DEPTH_DECORATIONS_OVERLAY + gridY_base` et accepter que les Pokemon à `gridY > gridY_arbre` passent devant (naturellement plus bas en Y grille = plus près de la caméra iso). À tester sur cas limite avant de statuer sur une solution plus complexe.

## Dépendances

- **Prérequis** : Plan 045 (format Tiled), 046 (hauteurs), 050 (tileset custom), 051 (terrain types) tous terminés. Étape 0 (Ghost traverse) est une dette du plan 045 à régler avant le reste du plan 064.
- **Débloque** : Plan « Interactions type/terrain + modification terrain par attaques » (Phase 3), rewrite Babylon (Phase 3.5 — décide du porting des décos en 3D), Phase 3.6 (éditeur de terrain / génération IA).
