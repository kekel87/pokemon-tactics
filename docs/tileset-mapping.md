# Tileset Mapping — Custom Tileset (PMD-based)

Référence du tileset `tileset.png` (1 colonne × 74 lignes, 32×2368 px, 74 tiles — 11 solides + 4 liquides).
Les IDs sont 0-indexés. En Tiled, GID = tile_id + firstgid (firstgid=1).

**Fichier source** : `packages/renderer/public/assets/tilesets/terrain/tileset.png`
**Définition Tiled** : `packages/renderer/public/assets/tilesets/terrain/tileset.tsj` (référence externe partagée par tous les `.tmj`)

Le tileset est **généré** automatiquement par les scripts Python de `scripts/`
à partir de textures 2D extraites des tilesets PMD (Pokemon Mystery Dungeon).
Voir `scripts/README.md` pour la pipeline complète et `docs/plans/050-custom-tileset.md`
pour le contexte du remplacement de JAO.

## Provenance des textures (spriters-resource.com)

Chaque texture terrain est extraite (via `scripts/extract-pmd-tile.py`) d'une **sheet
de donjon PMD** rippée sur [spriters-resource.com](https://www.spriters-resource.com/).
Les sheets originales sont conservées **read-only, gitignorées** dans
`docs/references/pmd-tilesets/<catégorie>/*.png`. Le tableau ci-dessous donne la
source exacte de chaque sheet utilisée (asset-id + URL vérifiés octet-pour-octet
contre les fichiers locaux, 2026-07-23).

> **Crédit / licence** : toutes les sheets retenues sont rippées et formatées par
> le contributeur **`SilverDeoxys563`** (sections « Dungeon Tiles »). Mention sur
> les sheets : *« No credit is necessary, but it's always appreciated! »*. Assets
> de fan-rip de jeux Nintendo/The Pokémon Company — usage de **référence de
> développement uniquement**, non redistribuables tels quels (cf. `docs/decisions.md`
> sur les assets libres de droits).

| Sheet (fichier local) | Donjon | Jeu | asset-id | URL | Sert (terrains) |
|---|---|---|---|---|---|
| `normal_grass/forest-path` | Forest Path | Explorers of Time/Darkness (DS) | 85768 | [/asset/85768/](https://www.spriters-resource.com/ds_dsi/pokemonmysterydungeonexplorersoftimedarkness/asset/85768/) | herbe (top) |
| `normal_grass/lightning-field` | Lightning Field | Red Rescue Team (GBA) | 85275 | [/asset/85275/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85275/) | herbe (flanc) |
| `tall_grass_forest/mystery-jungle-01f-15f` | Mystery Jungle 01F–15F | Explorers of Time/Darkness (DS) | 84968 | [/asset/84968/](https://www.spriters-resource.com/ds_dsi/pokemonmysterydungeonexplorersoftimedarkness/asset/84968/) | tall_grass (top+flanc) |
| `rock/mt-thunder` | Mt. Thunder | Red Rescue Team (GBA) | 19788 | [/asset/19788/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/19788/) | roche |
| `brick_ruins/buried-relic-b51f-b99f` | Buried Relic B51F–B99F | Red Rescue Team (GBA) | 85417 | [/asset/85417/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85417/) | brique |
| `sand/northern-desert-01f-07f` | Northern Desert 01F–07F | Explorers of Time/Darkness (DS) | 37112 | [/asset/37112/](https://www.spriters-resource.com/ds_dsi/pokemonmysterydungeonexplorersoftimedarkness/asset/37112/) | sable (top+flanc) |
| `brick_ruins/buried-relic-b21f-b50f` | Buried Relic B21F–B50F | Red Rescue Team (GBA) | 85416 | [/asset/85416/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85416/) | pave |
| `brick_ruins/darknight-relic` | Darknight Relic | Red Rescue Team (GBA) | 40730 | [/asset/40730/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/40730/) | path (ground) + wood (walls) |
| `snow/frosty-forest` | Frosty Forest | Red Rescue Team (GBA) | 85202 | [/asset/85202/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85202/) | snow (top) |
| `snow/snow-path` | Snow Path | Red Rescue Team (GBA) | 85186 | [/asset/85186/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85186/) | snow (flanc) |
| `ice/ice-maze` | Ice Maze | Red Rescue Team (GBA) | 85201 | [/asset/85201/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85201/) | ice |
| `lava_magma/magma-cavern-b18f-b23f` | Magma Cavern B18F–B23F | Red Rescue Team (GBA) | 85239 | [/asset/85239/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85239/) | magma (Ground) + lava (Lava) |
| `water/miracle-sea` | Miracle Sea | Explorers of Time/Darkness (DS) | 85996 | [/asset/85996/](https://www.spriters-resource.com/ds_dsi/pokemonmysterydungeonexplorersoftimedarkness/asset/85996/) | water + deep_water |
| `swamp_poison/poison-maze` | Poison Maze | Red Rescue Team (GBA) | 85483 | [/asset/85483/](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/asset/85483/) | swamp |

> **Doublons écartés** : `Lightning Field` (id 75142) et `Mt. Thunder` (id 75100)
> existent en second exemplaire (uploadeur `FluffyBunny`, section « Dungeon Boss
> Rooms ») à des **dimensions différentes** qui ne matchent PAS nos fichiers — ce
> sont d'autres découpes. Les ids retenus ci-dessus (85275 / 19788, 813×770) sont
> les seuls à correspondre octet-pour-octet.

Les catégories dans `docs/references/pmd-tilesets/` contiennent **d'autres sheets
candidates non retenues** (autres donjons du même biome) — utiles si on veut
changer l'aspect d'un terrain ou en ajouter un nouveau sans re-chercher sur
spriters.

## Phase 6 — variants d'autotile & animation (à exploiter plus tard)

Deux choses présentes dans les sheets source mais **pas encore extraites**, à
garder en tête pour l'éditeur de map 3D (Phase 6) :

- **Variants d'autotile** : chaque section de terrain d'une sheet PMD contient un
  **jeu complet de variantes** (centre plein + bords + coins intérieurs/extérieurs
  + péninsules), organisé par la « Legend » de bitmask à gauche de la sheet. On
  n'extrait aujourd'hui **que la tuile centrale pleine** (col_local 1, row 1). Pour
  l'autotiling de l'éditeur, il faudra extraire l'ensemble du bloc de variantes de
  chaque terrain (ex. la colonne « Lava » de Magma Cavern = centre + coins/bords,
  **pas** des frames d'animation — corrigé 2026-07-23).
- **Animation par palette-cycling (source PMD, non retenue)** : PMD anime l'eau/la
  lave **par rotation de palette** (pas par frames multiples). Les sheets exposent,
  à droite, les **bandes de palette** (une colonne = un slot de couleur, une ligne
  = une frame) et une note de vitesse (ex. `Lava-Ground speed: Every 3 frames`).
  Notre pipeline fige **une seule ligne de palette** → texture statique, et reste
  ainsi : reconstruire ce cycle (bake de frames hors-ligne ou LUT de palette dans
  un shader) n'a **pas été implémenté** et n'est pas retenu comme approche.
  **L'animation des liquides est faite (2026-07-23), mais procéduralement** —
  `LiquidShimmerPlugin` (`packages/render-babylon/src/shaders/liquid-shimmer-plugin.ts`)
  synthétise lueur/scintillement/ondulation par shader au-dessus de la texture
  statique, sans rejouer le palette-cycling source ni des frames. Détails :
  `docs/design-system.md` § Liquides, décision #707.

## Organisation

**Principe** : 1 colonne × 26 lignes, groupes par terrain empilés verticalement,
chaque groupe terminé par une ligne vide (séparateur). Les colonnes supplémentaires
(variants visuels) seront ajoutées à droite dans une future version.

Convention de hauteur :
- **full** : `height=1` (un niveau d'élévation complet)
- **half-a/half-b** : `height=0.5`
- **stairs/ramp** : `height=0.5`, `slope="south"` (variantes E/N/W obtenues au runtime via flip Tiled)

### Terrains solides (11 × 6 lignes chacun)

Coordonnées source : `(section, col_local ∈ {0,1,2}, row_global)` — voir convention plus bas.

| tile_id | groupe     | terrain (gameplay) | sheet + top | sheet + flanc |
|---------|------------|--------------------|-------------|---------------|
| 0–4     | herbe      | normal             | `forest-path` ground (1,1) | `lightning-field` ground (1,1) |
| 6–10    | tall_grass | tall_grass         | `mystery-jungle-01f-15f` walls (1,1) | `mystery-jungle-01f-15f` ground (1,1) |
| 12–16   | roche      | normal             | `mt-thunder` ground (1,1) | identique au top |
| 18–22   | brique     | normal             | `buried-relic-b51f-b99f` ground (1,1) | identique au top |
| 24–28   | sable      | sand               | `northern-desert` ground (1,1) | `northern-desert` walls (1,1) |
| 30–34   | pave       | normal             | `buried-relic-b21f-b50f` ground (1,1) | identique au top |
| 36–40   | path       | normal             | `darknight-relic` ground (1,1) | identique au top |
| 42–46   | wood       | normal             | `darknight-relic` walls (1,1) | identique au top |
| 48–52   | snow       | snow               | `frosty-forest` ground (1,1) | `snow-path` ground (1,1) |
| 54–58   | ice        | ice                | `ice-maze` ground (1,1) | identique au top |
| 60–64   | magma      | magma              | `magma-cavern-b18f-b23f` ground (1,1) | identique au top |

Chaque groupe solide contient, dans l'ordre : `full` · `half-a` (flanc homogène) · `half-b` (flanc générique) · `stairs-s` · `ramp-s`, suivi d'une ligne vide (séparateur).

> **magma = solide** : roche volcanique refroidie, marchable. À ne pas confondre avec `lava` (liquide, coulée en fusion).

### Terrains liquides (4 × 3 lignes PNG chacun, 1 seule tuile active)

Chaque groupe liquide ne contient plus qu'un `full` (purge des demi-blocs liquides, 2026-07-23, plan 169 — le rendu volume liquide est incompatible avec une tuile liquide en demi-hauteur, cf. `docs/design-system.md` § Liquides et décision #711). Les 2 lignes PNG restantes du groupe (ex-`half-a` + séparateur) sont désormais **mortes/réservées** : le PNG n'a **pas** été re-coupé pour ne pas décaler tous les ids liquides suivants, ces rangs n'ont simplement plus d'entrée dans `tileset.tsj`.

| tile_id | groupe     | role   | terrain    | sheet + top                      |
|---------|------------|--------|------------|----------------------------------|
| 66      | water      | full   | water      | `miracle-sea` shallow water      |
| 69      | deep_water | full   | deep_water | `miracle-sea` deep water         |
| 72      | lava       | full   | lava       | `magma-cavern-b18f-b23f` lava    |
| 75      | swamp      | full   | swamp      | `poison-maze` ground             |

> Ids 67/70/73/76 (ex-`half-a` liquide) : retirés de `tileset.tsj` **et** de `LIQUID_GROUP_BY_LOCAL_ID` (`tiled-map.ts`). Les 3 maps de jeu qui en pointaient (Archipel des Pontons/`naval-arena`, Tourbière/`swamp`, Volcan Actif/`volcano`) ont été migrées vers `full`. Le magma `half-a` (**solide**, id distinct du magma liquide) n'est pas concerné — conservé tel quel.

Note : water (shallow, turquoise clair) et deep_water (bleu foncé) sont **visuellement distincts** depuis la régénération du tileset 2026-04-23. Avant, les deux GIDs produisaient la même couleur par bug d'extraction.

**Hauteur des liquides (plan 166, 2026-07-21, corrigé)** : les liquides `full` gardent `height=1.0` (rendu 6-tranches à pleine hauteur — fond 3/6, nappe 5/6, air 1/6). Le « demi-bloc » ne concerne **que le calcul de hauteur (gameplay)**, pas le rendu : un mon posé sur un liquide s'enfonce à 3/6 = `0.5` via la submersion et son déplacement est lu comme un `step` — le demi-bloc est donc émergent. Un premier jet avait passé les `full` à `0.5`, ce qui écrasait le corps du liquide (`bodyHeight = max(0.5, tile.height) × SCALE`) → annulé (décision #697). Détail du rendu (fond + nappe, cuvette, immersion) → `docs/design-system.md` §Liquides.

### Séparateurs

Lignes 5, 11, 17, 23, 29, 35, 41, 47, 53, 59, 65, 68, 71, 74, 77 — tile transparente sans propriété. Si une map y pointe, le renderer n'affiche rien.

## Rôles par groupe solide (5 lignes)

Dans l'ordre, pour chaque terrain solide :

1. **Tile pleine** (`full`) — bloc cubique complet, height=0
2. **Demi-tile A** (`half-a`) — demi-bloc, flanc = texture du dessus (homogène), height=0.5
3. **Demi-tile B** (`half-b`) — demi-bloc, flanc = texture générique (terre), height=0.5
4. **Escalier S** (`stairs-s`) — 4 marches descendant vers le sud, slope=south
5. **Pente S** (`ramp-s`) — pente descendant vers le sud, slope=south

Les variantes E (escalier E, pente E) sont obtenues **au rendu** via le flip
horizontal de Tiled (bit 31 du GID), décodé par `decodeTiledGid` dans
`packages/data/src/tiled/tiled-utils.ts`.

## Rôles par groupe liquide (1 ligne active)

1. **Tile pleine** (`full`) — height=1.0 (bloc plein — rendu 6-tranches à pleine hauteur). Invariant renforcé côté renderer (`terrain-extruder.ts`) : `bodyHeight` d'un groupe liquide est clampé à ≥ 1 quoi qu'il arrive.

Le `full` reste un bloc plein (`1.0`) : c'est la submersion (mon enfoncé à 3/6) qui donne le « demi-bloc » côté gameplay, pas la hauteur de la tuile (décision #697). Pas de pente ni de cascade sur les liquides (décision plan 050, toujours valable).

**Ex-demi-tile liquide (`half-a`, height=0.5, ajoutée 2026-04-23) — purgée 2026-07-23** (plan 169) : un rendu volume liquide n'a pas de sens en demi-hauteur (le renderer clampe désormais le corps liquide à `≥ 1` de toute façon). Retirée de `tileset.tsj` et de `LIQUID_GROUP_BY_LOCAL_ID` ; les 3 maps de jeu qui l'utilisaient sont passées en `full`. Décision #711.

## Génération

Le tileset est reproductible depuis les textures PMD via :

```bash
# 1. Extraire les textures top+flanc depuis les sheets PMD (col/row 0-indexés)
python3 scripts/extract-pmd-tile.py <sheet.png> --col X --row Y

# 2. Construire une colonne complète (5 tiles pour un terrain solide)
python3 scripts/build-terrain.py --name <terrain> --type solid \
  --top <top.png> --side <side.png> --out col-<terrain>.png

# Pour un liquide : --type liquid (produit 1 tile au lieu de 5)

# 3. Assembler les colonnes + séparateurs → tileset final (cf. historique dans
#    docs/plans/050-custom-tileset.md, à factoriser dans un script dédié si on
#    répète l'opération).
```

**Convention des coordonnées** : `(section, col_local, row_global)` où :
- `col_local ∈ {0, 1, 2}` dans la section (chaque section fait **3 colonnes de large**)
- `row_global` est compté depuis le premier tile de la sheet (row 0, 1, 2…)

**Attention — les sections varient d'une sheet à l'autre**. Le layout "standard"
(Legend | Walls | Wall Alt 1 | Wall Alt 2 | Ground | Ground Alt | Water | Water Sparkle)
n'est qu'une base ; les sheets plus complexes insèrent `Unused Wall`, `Wall A/B`,
`Water-Ground`, ou une section `Lava` dédiée. Magma Cavern décale aussi la grille
de ~52 px vers le bas à cause d'un header plus haut.

**Toujours inspecter les labels de la sheet** avant de choisir les colonnes :

```bash
python3 scripts/extract-pmd-tile.py <sheet.png> --scan
# Ouvrir <sheet.png> dans un viewer pour lire les labels de sections au-dessus
# de la grille. Le script auto-détecte Y0 (origine de la grille) et l'affiche.
```

Sections rencontrées en pratique pour les sheets actuellement utilisées :

| Sheet | Layout (col start → section) |
|-------|------------------------------|
| `forest-path`, `lightning-field`, `mt-thunder`, `northern-desert`, `darknight-relic`, `frosty-forest`, `snow-path`, `ice-maze`, `buried-relic-b21f-b50f`, `buried-relic-b51f-b99f` | Layout standard 8 sections (Legend=0, Walls=3, Wall Alt 1=6, Wall Alt 2=9, Ground=12, Ground Alt=15, Water=18, Water Sparkle=21) |
| `mystery-jungle-01f-15f` | +Unused Wall(12), +Unused Ground(24) → Ground=15, Water=27, Water Sparkle=30 |
| `poison-maze` | Une seule Wall Alt → Walls=3, Wall Alt=6, Ground=9, Ground Alt 1=12, Ground Alt 2=15, Unused Ground=18, Water-Ground=21, Water=24 |
| `miracle-sea` | Pas de Water Sparkle → Ground=12, Water-Ground=15, Water=18 |
| `magma-cavern-b18f-b23f` | Grille décalée Y0=213. Walls A(3), Wall Alt 1 A(6), Wall Alt 1 B(9), Wall Alt 2 A(12), Wall Alt 2 B(15), Ground=18, Ground Alt 1=21, Ground Alt 2=24, **Lava=27** |

## Hauteur (empilement vertical)

Quand une tile est surélevée (`height` entier dans le `.tmj`), le renderer
empile des copies de la **tile pleine du même terrain** en dessous pour
combler le vide visuel. Le lookup se fait via `IsometricGrid.getFillFrame()`.

La hauteur absolue d'une colonne vient de la propriété `height` du `.tmj`
(entier ≥ 0) ; la propriété `height` du tileset (0 ou 0.5) est un modifieur
local appliqué au sommet.

## Renderer — flip Tiled

Le renderer décode les 3 bits de flip Tiled (`0x80000000`, `0x40000000`,
`0x20000000`) via `decodeTiledGid`, puis applique `sprite.setFlipX/Y`
dans `IsometricGrid.drawGridFromTileData` (`packages/renderer/src/grid/IsometricGrid.ts`).
Le lookup `resolveTileProperties` fait abstraction des bits de flip pour
retrouver les propriétés du tile.

## Ajouter un nouveau terrain

1. Choisir 2 textures PMD (top + side) — voir `scripts/README.md` pour
   le workflow d'extraction
2. Lancer `build-terrain.py` pour générer la colonne
3. Régénérer le PNG final via `assemble-tileset.py` (concat vertical avec
   séparateurs)
4. Mettre à jour `tileset.tsj` — ajouter les nouvelles entrées dans `tiles[]`
   (height, terrain, slope) et bumper `tilecount` + `imageheight`
5. Mettre à jour la table `tile_id → (terrain, height, slope)` ci-dessus
