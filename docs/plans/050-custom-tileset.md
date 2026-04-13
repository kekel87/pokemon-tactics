---
status: ready-for-visual-test
created: 2026-04-12
updated: 2026-04-13 (11 solides + 4 liquides livrés, 24 maps migrées, dead code nettoyé — reste validation visuelle humaine)
---

# Plan 050 — Tileset custom (remplacer JAO)

## Contexte

Depuis le plan 043, le jeu utilise le tileset **ICON Isometric Pack de Jao** (CC0, 32x32, 528 tiles, 22x24). Les denivele (plan 046) et la ligne de vue 3D (plan 047) sont termines, le format terrain est stabilise — c'est le bon moment pour remplacer le tileset.

Le tileset JAO actuel est limite sur 4 axes :
1. Lisibilite tactique : grille peu visible au bon endroit, hauteur mal rendue
2. Ambiance : textures ne collent pas a l'univers Pokemon
3. Couverture incomplete : variantes inegales entre terrains
4. Organisation : difficile a comprendre et etendre

## Objectifs

Produire un tileset custom :
- Qui match l'ambiance visuelle Pokemon (palette, shading doux)
- Organise de maniere lisible et extensible (ligne = terrain, colonnes = roles)
- Avec couverture homogene de chaque terrain
- Avec un rendu de hauteur qui distingue clairement les niveaux via des faces laterales
- Sans grille visible par defaut (le highlight se fait dynamiquement au survol)

## Cahier des charges (decide)

### Format des tiles

- **Taille source** : 32x32 (inchangee, `TILE_WIDTH=32`, `TILE_HEIGHT=16`, `TILE_SPRITE_SCALE=1`)
- **Pas de grille visible** : aucun lisere, aucun damier, aucune separation entre cases adjacentes du meme terrain
- **Highlight au hover uniquement** : dessine via Graphics Phaser au runtime (code existant)
- **Faces laterales** :
  - Dans le registre visuel du terrain (herbe -> terre brune, roche -> roche sombre, brique -> pierre taillee, etc.)
  - **Demi-tile A** : flanc = sommet (meme matiere, ex herbe/herbe)
  - **Demi-tile B** : flanc generique + sommet (ex terre brune sous herbe)

### Couverture — liste definitive des terrains

**Priorite 1 — terrains a effet (10)** — correspondent a l'enum `TerrainType` dans `packages/core/src/enums/terrain-type.ts` + roadmap Phase 3 ("Types de terrain + modificateurs") :

| # | TerrainType | Texture a produire |
|---|-------------|---------------------|
| 1 | Normal | Herbe normale |
| 2 | TallGrass | Texture d'herbe haute (touffes en sprites decor plus tard) |
| 3 | Water | Eau peu profonde |
| 4 | DeepWater | Eau profonde (bleu fonce) |
| 5 | Magma | Roche en fusion |
| 6 | Lava | Lave |
| 7 | Ice | Glace |
| 8 | Sand | Sable |
| 9 | Snow | Neige |
| 10 | Swamp | Marecage / poison |

**Priorite 2 — neutres visuels (6)** — tous mappes a `TerrainType.Normal` cote gameplay, juste variation visuelle pour varier les maps :

- Herbe courte (distincte visuellement de TallGrass)
- Roche / pierre
- Brique
- Pave / dallage
- Chemin de terre
- Plancher bois

**Exclu de ce plan** : `Obstacle` (arbres, rochers isoles, buissons, etc.). La roadmap prevoit un layer `decorations` Tiled + "Decors sur les maps" (ligne 195) en phase future — ce sera des **sprites separes**, pas des tiles du tileset terrain.

**Variantes** : 1 a 2 par terrain pour commencer (casser la repetition sans surcharger).

### Organisation — layout decide

**Principe** : lignes = roles, groupes par terrain, colonnes = variantes (extensibles a droite).

```
── TERRAIN (solide) ──────────────────────────────
Tile pleine  │ v1 │ v2 │ v3 │ ...
Demi-tile A  │ v1 │ v2 │ ...       (flanc = sommet)
Demi-tile B  │ v1 │ v2 │ ...       (flanc generique + sommet)
Escalier S   │ v1 │ v2 │ ...
Pente S      │ v1 │ v2 │ ...
(ligne vide — separateur)

── TERRAIN (liquide) ─────────────────────────────
Tile pleine  │ v1 │ v2 │ ...
(ligne vide — separateur)
```

**Pas de demi-tile pour les liquides** (simplification decidee).
**Pas de cascades** pour ce plan (ajout ulterieur si besoin).
**Pas de transitions** entre terrains (refera le tileset a ce moment-la).
**Pas de decors/obstacles** (spritesheet dedie prevu dans la roadmap).
**Pentes et escaliers** : deux options a trancher —
- **Option A — flip renderer** : ajouter le decodage des bits de flip Tiled dans `IsometricGrid.ts` (`gid & 0x80000000` etc.) + `sprite.setFlipX/Y`. ~20 lignes, tiles S suffisent dans le PNG.
- **Option B — tiles explicites** : dessiner Pente S + Pente E + Escalier S + Escalier E = 4 roles au lieu de 2. Zero code renderer, +2 lignes par groupe solide.

**Etat actuel** : le renderer (`IsometricGrid.ts:149`) fait `frameIndex = gid - firstgid` sans decoder les bits de flip — le flip Tiled est ignore. **Le flip ne fonctionne pas**.

**Ordre des terrains dans le PNG** :

| # | Groupe | TerrainType | Type |
|---|--------|-------------|------|
| 0 | normal_grass | Normal | solide |
| 1 | tall_grass | TallGrass | solide |
| 2 | rock | Normal | solide |
| 3 | brick_ruins | Normal | solide |
| 4 | sand | Sand | solide |
| 5 | pave | Normal | solide |
| 6 | path | Normal | solide |
| 7 | wood | Normal | solide |
| 8 | snow | Snow | solide |
| 9 | ice | Ice | solide |
| 10 | water | Water | liquide |
| 11 | deep_water | DeepWater | liquide |
| 12 | lava | Lava | liquide |
| 13 | magma | Magma | **solide** (roche volcanique refroidie, marchable) |
| 14 | swamp_poison | Swamp | liquide |

**Taille du PNG livré** (1 variante par role) :
- 11 solides x 6 lignes = 66 lignes
- 4 liquides x 2 lignes = 8 lignes
- Total : 74 lignes x 32px = **2368px de haut**
- Largeur : 1 colonne x 32px = **32px de large**
- Format tres haut/etroit — normal pour un tileset organise par groupe, Tiled scrolle verticalement

> Note : au moment de la rédaction initiale du plan, magma était prévu comme liquide et le tileset avait 5 liquides pour 70 lignes/2240px. La décision finale (2026-04-13) a reclassé magma en solide (roche volcanique), portant le total à 11 solides + 4 liquides = 74 tiles.

## Approche de generation — pistes evaluees

### PixelLab

**MCP** (`create_isometric_tile`) : texte uniquement, pas de reference image. Utile pour des premiers drafts guides par description.

**Web UI** (plus riche, non automatise) :
- **Rotate** — genere des vues directionnelles y compris isometriques a partir d'un sprite. Permet potentiellement de convertir des tiles Pokemon 2D top-down en iso.
- **Consistent Style** — generation guidee par image de reference
- **True Inpainting** — retouche style-aware de tiles existantes
- **Create Map** — tilesets complets

**Risque identifie** : la vraie difficulte n'est pas de generer 1 belle tile, c'est de generer **N tiles coherentes** (pentes qui matchent la base, demi-tiles qui gardent la palette). A valider sur un terrain complet avant rollout.

### Script 2D -> iso (partiellement automatisable)

- **Dessus iso (losange)** : transformation affine d'une tile top-down, faisable avec `sharp`. Mais la skew nearest-neighbor produit des diagonales crantees sur pixel art, donc le resultat brut sera a retoucher.
- **Faces laterales** : **non derivable** d'une tile top-down (pas d'info de flanc). Il faut une source separee (texture "terre") ou une peinture manuelle.

Conclusion : le script peut accelerer le cadrage mais ne produit pas un resultat final acceptable seul.

## Reference visuelle — DECISION : tilesets PMD

**Source principale retenue : les tilesets Pokemon Mystery Dungeon** (Red Rescue Team GBA, Explorers of Sky/Time/Darkness DS). Raisons :

1. **Coherence totale** avec nos sprites (deja issus de PMD via PMDCollab) — zero clash stylistique
2. **100% officiel Pokemon** — palette, shading, ambiance canon
3. **Couverture par donjon** — chaque donjon PMD est un biome complet avec sol + murs + variantes + features. Mapping naturel vers nos terrains :
   - Tiny Woods / Sinister Woods -> herbe/foret
   - Thunderwave Cave / Mt Thunder -> cave/roche
   - Great Canyon / Mt Steel -> roche/falaise
   - Frosty Forest / Crevice Cave -> neige/glace (terrains neutres futurs)
   - Magma Cavern / Mt Blaze -> lave
   - Stormy Sea / Waterfall Pond -> eau
   - Poison Marsh / Western Cave -> poison
4. **Sheets deja extraits** sur Spriters Resource.

**Limite a anticiper** : PMD est top-down legerement penche, pas iso strict. Il faudra :
- Conserver palette + motifs + shading tel quel (transposables)
- **Repeindre la geometrie** (losanges iso + faces laterales)

Cela renforce la piste **PixelLab Rotate** (web UI) : feed la tile top-down PMD -> demander la vue iso, tester sur un terrain complet avant rollout.

### Liens Spriters Resource

- [PMD Red Rescue Team (GBA)](https://www.spriters-resource.com/game_boy_advance/pokemonmysterydungeonredrescueteam/)
- [PMD Explorers of Sky (DS)](https://www.spriters-resource.com/ds_dsi/pokemonmysterydungeonexplorersofsky/)
- [PMD Explorers of Time/Darkness (DS)](https://www.spriters-resource.com/ds_dsi/pokemonmysterydungeonexplorersoftimedarkness/)

### References secondaires (abandonees apres decision PMD, gardees pour memoire)

Tileset fan-made HGSS/BW sauvegarde localement par l'humain (planche complete), utile comme reference secondaire pour :
- Le traitement des **falaises** (sommet + flanc avec pierres apparentes) — PMD l'a aussi en style top-down, mais le fan HGSS montre bien le passage sommet/flanc
- Les **transitions sol-sol**

Liens fan-made explores :
- [Kyle-Dove — Biome Tiles Public](https://www.deviantart.com/kyle-dove/art/Biome-Tiles-Public-274422390)
- [Akizakura16 — 4th gen Outdoor Tileset](https://www.deviantart.com/akizakura16/art/4th-gen-Outdoor-Tileset-613857695)
- [Eevee Expo — Ready to use Tilesets](https://eeveeexpo.com/resources/15/)

## Bonus deja evoque — Pokemon "dans" l'eau / lave

Trois approches possibles pour que les sprites aient l'air immerges :
1. **Crop du sprite** (`setCrop`) + sprite ripple autour des pieds — le plus simple, 1h de code
2. **Tile liquide dessinee par-dessus** — demande une tile speciale par liquide
3. **Geometry mask Phaser** — le plus propre, un peu plus de code

Reco : commencer par (1), peut etre realise independamment du tileset custom (marche deja avec JAO).

## Questions ouvertes / a decider

- [x] **Liste definitive des terrains** — decide 2026-04-13 (10 terrains a effet + 6 neutres, obstacle/deco exclus et traites plus tard en sprites)
- [x] **Layout exact** — decide 2026-04-13 (groupes par terrain, lignes = roles, colonnes = variants, voir section Organisation)
- [x] **Flip Tiled** — Option A retenue : support flip dans le renderer (decoder bits GID, setFlipX/Y)
- [x] **Approche de generation** — scripts Python (`extract-pmd-tile.py` + `make-iso-tile.py` + `build-terrain.py` + `assemble-tileset.py`), textures sources PMD 24×24, transformées en tiles iso 32×32. Workflow documenté dans `scripts/README.md`.
- [x] **Pipeline concret** — voir `scripts/README.md`. Régénération : éditer les args `--top`/`--side` de `build-terrain.py` puis relancer `assemble-tileset.py`.
- [x] **Migration maps** — 24 `.tmj` migrés vers `.tsj` externe (decide 2026-04-13)
- [x] **Extraction tileset externe `.tsj`** — `tileset.tsj` partagé par tous les `.tmj` (decide 2026-04-13, décision #243)

## Etapes proposees (haut niveau)

1. ~~Inventaire terrains + layout tileset~~ — decide
2. ~~**Support flip Tiled dans le renderer**~~ — fait (`decodeTiledGid` dans `packages/data/src/tiled/tiled-utils.ts`, applique dans `IsometricGrid.drawGridFromTileData`)
3. ~~Brief visuel (palette, shading) depuis les sheets PMD en references~~ — PMD retenu comme source unique
4. ~~Pipeline de generation deterministe~~ — trois scripts Python :
   - `scripts/extract-pmd-tile.py` extrait une tile 24x24 d'une sheet PMD (auto-detection X0, --scan pour reperer les sections)
   - `scripts/make-iso-tile.py` warp 2 textures (top + side) en tile iso 32x32, 4 shapes (full / half / ramp-s / stairs-s)
   - `scripts/build-terrain.py` assemble la colonne complete par terrain (5 tiles pour solide, 1 pour liquide)
5. ~~MVP 5 terrains generes et deployes~~ — voir section "Implementation MVP" ci-dessous
6. ~~Construction du `.tsj` externe~~ — `tileset.tsj` partagé par tous les `.tmj` via `{ "firstgid": 1, "source": "../tilesets/terrain/tileset.tsj" }`
7. ~~Migration des `.tmj` existants~~ — 24 maps migrées, inline tilesets → référence externe `.tsj`
8. **Test en jeu** — valider visuellement le rendu, l'empilement, les pentes/escaliers (reste à faire : validation humaine)
9. ~~Generation des terrains restants~~ — 11 solides + 4 liquides livrés (tall_grass, brique, pave, wood, snow, ice, magma-solid, deep_water, lava, swamp tous générés). 849/849 tests verts. Dead code renderer nettoyé (~100 lignes).
10. ~~Nettoyage~~ — scripts one-shot supprimés (`migrate-tmj-to-custom-tileset.py`, `remap-tmj-mvp-to-15.py`, `externalize-tmj-tileset.py`), constantes JAO retirées, `TILESET_KEY` renommé "icon-tileset" → "terrain", méthodes mortes (`drawGrid`, `drawTexturedGrid`, `drawArenaMarkings`, `drawIsoEllipse`) supprimées

## Implementation finale (2026-04-13)

**11 solides + 4 liquides generes**, tileset complet livré :

| # | terrain | type | source PMD (top) | source PMD (side) |
|---|---------|------|------------------|-------------------|
| 0 | herbe (normal_grass) | solide | `forest-path` ground (1,1) | `lightning-field` ground (1,1) |
| 1 | tall_grass | solide | `mystery-jungle-01f-15f` walls (1,1) | `mystery-jungle-01f-15f` ground (1,1) |
| 2 | roche (rock) | solide | `mt-thunder` ground (1,1) | identique au top |
| 3 | brique (brick_ruins) | solide | `buried-relic-b51f-b99f` ground (1,1) | identique au top |
| 4 | sable (sand) | solide | `northern-desert` ground (1,1) | `northern-desert` walls (1,1) |
| 5 | pave | solide | `buried-relic-b21f-b50f` ground (1,1) | identique au top |
| 6 | path | solide | `darknight-relic` ground (1,1) | identique au top |
| 7 | wood | solide | `darknight-relic` walls (1,1) | identique au top |
| 8 | snow | solide | `frosty-forest` ground (1,1) | `snow-path` ground (1,1) |
| 9 | ice | solide | `ice-maze` ground (1,1) | identique au top |
| 10 | magma (solide) | solide | `magma-cavern-b18f-b23f` ground (1,1) | identique au top |
| 11 | water | liquide | `miracle-sea` ground (1,1) | identique au top |
| 12 | deep_water | liquide | `miracle-sea` water (1,1) | identique au top |
| 13 | lava | liquide | `magma-cavern-b18f-b23f` lava (1,1) | identique au top |
| 14 | swamp | liquide | `poison-maze` ground (1,1) | identique au top |

**Tileset final** : 32×2368 px, 74 tiles (11×6 lignes solides + 4×2 lignes liquides + 15 séparateurs). Voir `docs/tileset-mapping.md` pour la table tile_id → (terrain, height, slope).

**Migration des maps** : les 24 `.tmj` migrés depuis l'inline tileset JAO vers la référence externe `tileset.tsj`. Les variantes directionnelles (pente E, escalier E) sont converties en tile S + flip horizontal Tiled. Les tiles unmapped (décorations JAO sans équivalent) sont mises à 0 (vide).

**Dettes techniques résolues** :
- `resolveTileProperties` transforme la direction selon les bits flipD/H/V (ordre Tiled D→H→V), couvert par 3 tests dans `tileset-resolver.test.ts`.
- `scripts/assemble-tileset.py` stacke les colonnes avec les séparateurs, préserve l'ordre CLI des groupes.
- magma reclassé solide (roche volcanique refroidie) — décision #242.
- Dead code renderer supprimé : méthodes `drawGrid()`, `drawTexturedGrid()`, `drawArenaMarkings()`, `drawIsoEllipse()`, constantes `ARENA_TILE_FRAME_*`, `ARENA_MARKING_*`, `ARENA_GRASS_BORDER_SIZE`, `DEPTH_GRID_MARKINGS`, field `markingsGraphics`, `TILESET_KEY` renommé "terrain".
- Helper test `loadTiledMapSync` dans `packages/data/src/testing/` — permet aux tests `parseTiledMap` de résoudre les tilesets externes sans fetch async.

**Reste à faire** : step 8 — validation visuelle humaine en jeu (rendu, empilement, pentes/escaliers).

## Dependances / prerequisites

Aucune — les denivele (046) et LoS (047) sont termines, le format terrain est fige.

## Impact estime

- `packages/renderer/public/assets/tilesets/terrain/` — nouveau PNG + nouveau `.tsj`
- `packages/renderer/src/constants.ts` — potentiellement frames tileset si on change le layout
- `packages/renderer/src/scenes/*` — preload nouveau tileset
- `packages/renderer/src/isometric/IsometricGrid.ts` — `getFillFrame()` a adapter au nouveau mapping
- `packages/data/src/maps/**/*.tmj` — re-mapping GID (potentiellement script de migration)
- `packages/renderer/src/scenes/CreditsScene.ts` + i18n — retirer credit Jao
- `docs/tileset-mapping.md` — reecriture complete pour le nouveau format

## Notes de session (2026-04-12)

- Critique JAO confirmee : grille trop visible, ambiance pas Pokemon, couverture inegale, organisation peu lisible
- PixelLab MCP limite au texte ; le web UI offre Rotate / Consistent Style / Inpainting (non automatisable)
- Pas de tileset Pokemon iso complet existant en fan-made (scene fan est top-down)
- Licence : l'humain accepte d'utiliser des references Pokemon (on est deja "hors-clou" avec les sprites PMD)
- Planche HGSS fan-made sauvegardee localement par l'humain comme reference secondaire
- **Decision finale** : les tilesets PMD (Red Rescue Team / Explorers of Sky) sont la source principale — coherence totale avec nos sprites, couverture par donjon, 100% canon Pokemon. PixelLab Rotate a tester pour la conversion top-down -> iso.

## Notes de session (2026-04-13 suite)

- Liste definitive des terrains arretee : 10 terrains a effet (TerrainType core) + 6 neutres visuels mappes Normal
- Obstacle exclu du tileset terrain : sera traite en sprites decor (layer `decorations` Tiled, roadmap ligne 195 "Decors sur les maps")
- TallGrass : texture uniquement dans ce plan, les touffes/brins viendront plus tard en sprites decor
- Prochaine action : telecharger et pre-classer les sheets PMD par terrain
- 263 sheets PMD telecharges dans `docs/references/pmd-tilesets/` (15Mo brut, organises par terrain), epures a 124 PNG par l'humain. Les fichiers de travail (textures extraites, tiles intermediaires, tileset assemble) vont dans `tiles/work/`.
- Layout du tileset decide : groupes par terrain, lignes = roles, colonnes = variants extensibles
- Solides : 5 roles (tile pleine, demi A, demi B, escalier S, pente S) + ligne vide
- Liquides : 1 role (tile pleine) + ligne vide. Pas de demi-tile, pas de cascade
- PNG depart : 32x2240px (70 lignes, 1 colonne), extensible a droite
- Point a verifier avant implementation : le renderer supporte-t-il le flip horizontal de tiles pour obtenir la direction E depuis S ?
