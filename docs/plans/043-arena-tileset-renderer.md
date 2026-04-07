# Plan 043 — Tileset arène Pokemon + intégration renderer

**Statut** : done
**Créé** : 2026-04-07
**Objectif** : Remplacer les losanges verts dessinés par code par de vraies tiles texturées. Donner un look d'arène Pokemon à la carte POC.

---

## Contexte

Le renderer dessine actuellement des losanges via `Graphics.fillStyle(0x4a7c59)` — couleur vert uniforme pour toutes les tiles. `TileState` a déjà un champ `terrain` (normal, lava, water, tall_grass, ice) mais il n'est pas utilisé visuellement.

L'idée : générer des tiles pixel art via PixelLab, les charger comme sprites Phaser, et composer une arène Pokemon visuellement identifiable sur la carte POC existante.

## Contraintes

- **Budget PixelLab** : Tier 1, 2000 gen/mois. Être économe, itérer sur les prompts avant de masser.
- **Aller-retour visuels** : l'humain valide chaque batch de tiles avant d'avancer. Pouvoir voir les tiles ET la carte rendue rapidement.
- **Pas de dénivelé** : ce plan reste sur une carte plate. Les hauteurs viendront dans un plan ultérieur.
- **Pas de refacto core** : on change uniquement le renderer.

## Étapes

### Étape 1 — Recherche visuelle et validation style ✅

**But** : s'aligner sur le look cible avant de générer en masse.

1. ~~Collecter des images de référence d'arènes Pokemon (jeux, fan art)~~
2. ~~Générer 2-3 tiles de test via PixelLab en 64px (sol d'arène, bordure, herbe)~~
3. ~~Montrer à l'humain, itérer sur les prompts jusqu'à validation du style~~
4. ~~Documenter les prompts validés dans l'asset-manager (style guide)~~

**Résultat** : tileset existant **ICON Isometric Pack (Jao)** retenu — style pixel art, licence libre, tiles 32×32. Plus économe en budget PixelLab. Paramètres PixelLab documentés dans `asset-manager.md` pour la suite.

### Étape 2 — Récupérer le tileset arène complet ✅

**But** : produire toutes les tiles nécessaires pour une arène.

**Résultat** : tiles ICON Isometric Pack (Jao) copiées dans `packages/renderer/public/assets/tilesets/`. Tiles pertinentes sélectionnées (sol, bordure, herbe). Filtre NEAREST activé (scale ×2 → rendu pixel art propre).

### Étape 3 — Chargement des tiles dans Phaser ✅

**But** : charger les PNG comme textures Phaser au boot.

**Résultat** :
- `BattleScene.ts` : preload des tiles depuis `assets/tilesets/`
- `constants.ts` : mapping `TerrainType → texture key` centralisé
- Filtre `NEAREST` appliqué sur les textures tiles (cohérent avec le pattern sprites existant)

**Fichiers touchés** :
- `packages/renderer/src/scenes/BattleScene.ts`
- `packages/renderer/src/constants.ts`

### Étape 4 — Remplacer Graphics par Sprites dans IsometricGrid ✅

**But** : afficher les tiles texturées au lieu des polygones colorés.

**Résultat** :
- `IsometricGrid.drawGrid()` : `graphics.fillStyle()` + polygon → `scene.add.image()` positionné via `gridToScreen()`
- Layers Graphics de highlights (move, attack, enemy range) conservés séparément — lisibles par-dessus les tiles
- Tiles 32×32 scalées ×2 (`TILE_SPRITE_SCALE = 2`)
- **Marquages d'arène en overlay** : pokeball centrale + lignes latérales dessinés via Graphics au-dessus des tiles (non core — pur cosmétique renderer)

**Fichiers touchés** :
- `packages/renderer/src/grid/IsometricGrid.ts`
- `packages/renderer/src/constants.ts` (ajout `TILE_SPRITE_SCALE`)

### Étape 5 — Composer la carte arène

**But** : définir quelle tile va où pour former une arène Pokemon.

1. Mettre à jour `MapDefinition` de la carte POC pour utiliser les terrains (ou créer une map `arena-basic`)
2. Mapper les positions : herbe en bordure, sol d'arène au centre, marquages
3. Éventuellement ajouter un champ `tileVariant` dans TileState pour les variantes visuelles (cosmétique, pas de logique core)

**Fichiers touchés** :
- `packages/core/src/types/tile-state.ts` (optionnel : ajout `tileVariant`)
- Map definition (nouvelle carte ou mise à jour)

### Étape 6 — Polish et validation

1. Vérifier le rendu avec les sprites Pokemon dessus
2. Vérifier que les highlights (move, attack, preview) restent lisibles par-dessus les tiles
3. Ajuster les alpha/blend si nécessaire
4. Screenshot pour validation humain

---

## Hors scope

- Dénivelés / hauteur de tiles
- Autres biomes (lave, eau, glace)
- Transitions entre terrains (Wang tiles)
- Obstacles / line of sight
- Modifications des mécaniques core liées au terrain

## Risques

- **Cohérence visuelle PixelLab** : les tiles générées séparément peuvent ne pas raccorder. Mitigation : utiliser `create_tiles_pro` avec style matching.
- **Performance** : passer de Graphics à N sprites pourrait impacter le rendu sur grandes cartes. Mitigation : les cartes POC sont petites (8x8, 12x20).
- **Lisibilité highlights** : les tiles texturées pourraient rendre les overlays de mouvement/attaque moins visibles. Mitigation : ajuster l'alpha.
