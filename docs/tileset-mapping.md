# Tileset Mapping — Custom Tileset (PMD-based)

Référence du tileset `tileset.png` (1 colonne × 74 lignes, 32×2368 px, 74 tiles — 11 solides + 4 liquides).
Les IDs sont 0-indexés. En Tiled, GID = tile_id + firstgid (firstgid=1).

**Fichier source** : `packages/renderer/public/assets/tilesets/terrain/tileset.png`
**Définition Tiled** : `packages/renderer/public/assets/tilesets/terrain/tileset.tsj` (référence externe partagée par tous les `.tmj`)

Le tileset est **généré** automatiquement par les scripts Python de `scripts/`
à partir de textures 2D extraites des tilesets PMD (Pokemon Mystery Dungeon).
Voir `scripts/README.md` pour la pipeline complète et `docs/plans/050-custom-tileset.md`
pour le contexte du remplacement de JAO.

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

### Terrains liquides (4 × 2 lignes chacun)

| tile_id | groupe     | terrain (gameplay) | sheet + top | sheet + flanc |
|---------|------------|--------------------|-------------|---------------|
| 66      | water      | water              | `miracle-sea` ground (1,1) | identique au top |
| 68      | deep_water | deep_water         | `miracle-sea` water (1,1) | identique au top |
| 70      | lava       | lava               | `magma-cavern-b18f-b23f` lava (1,1) | identique au top |
| 72      | swamp      | swamp              | `poison-maze` ground (1,1) | identique au top |

Chaque groupe liquide ne contient qu'une `full`, suivi d'une ligne vide.

### Séparateurs

Lignes 5, 11, 17, 23, 29, 35, 41, 47, 53, 59, 65, 67, 69, 71, 73 — tile transparente sans propriété. Si une map y pointe, le renderer n'affiche rien.

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

## Rôles par groupe liquide (1 ligne)

1. **Tile pleine** — unique rôle pour le moment. Pas de demi-tile, pas de pente,
   pas de cascade (décision plan 050).

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
