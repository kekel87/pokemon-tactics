# Idée — Éditeur de carte voxel (in-app)

> **Statut** : note d'idée, rien d'engagé. À mûrir plus tard.
> Déclencheur : l'humain veut un builder de carte façon **Goxel, mais en plus simple** — juste poser / remplacer / supprimer un cube ou un asset. Le POC Cobblemon a confirmé l'envie que **nos cartes restent « voxel based »**.

## Vision

Un petit éditeur intégré au jeu (ou outil compagnon) pour construire les cartes en **voxels** au lieu d'éditer des `.tmj` Tiled à la main. Objectif : que l'humain (et plus tard les joueurs ?) sculptent une carte par cubes, posent des décorations, tracent les zones de spawn, et obtiennent un fichier de carte valide directement consommable par le jeu.

Inspiration : **Goxel** (édition voxel libre), mais **volontairement minimal** — pas de palette de modes complexes. Le cœur :

- **Poser** un cube (tile de terrain) à une position grille `(x, y, z)`.
- **Remplacer** un cube existant (changer type/hauteur/matériau).
- **Supprimer** un cube.
- Même triptyque pour les **assets de décoration** (rochers, arbres, hazards — cf. déco voxel déjà en exploration, `docs/next.md`).

## Deux natures d'objets à éditer

1. **Blocs (tiles)** = le terrain lui-même. Hauteur, type de terrain (`tall-grass`, `deep-water`, glace, etc.), traversabilité. C'est ce qui définit la topologie tactique.
2. **Assets (décoration)** = posés *sur* une tile. Billboards aujourd'hui → voxel `.glb` demain (cf. `docs/references/voxel-tile-placement.md`). Non-bloquants ou hazards selon le cas.

→ L'éditeur doit distinguer clairement « j'édite le sol » vs « je pose un objet dessus ».

## Zones de spawn

Tracer les **zones de spawn** directement dans l'éditeur (peindre des tiles spawn par format). Aujourd'hui = objectgroups Tiled séparés par format (`spawns-1v1`, `spawns-2v2`…, cf. règle « 1 layer/format » + symétrie centrée). L'éditeur doit produire la même structure (ou son équivalent voxel) sans qu'on bidouille le `.tmj`.

## Vérificateur de conformité (« conformity checker »)

Besoin explicite : un **validateur intégré** qui dit en direct si la carte est jouable. Doit reprendre / étendre les règles de `validateTiledMap` :

- Pas de pentes interdites (contraintes rendu iso : pas de pentes N/O).
- Règles de traversée : `MAX_CLIMB = 0.5`, `MAX_DESCENT = 1.0`.
- Cohérence des layers / hauteurs.
- Zones de spawn présentes, symétriques, bonne taille par format (ex. 1v1 ×2.5 = 15 tiles).
- Tileset partagé respecté.

→ Idéalement **feedback live** dans l'éditeur (surligner en rouge les tiles non conformes) + un rapport au save. Refuser l'export d'une carte non conforme, ou exporter avec warnings explicites.

## Format de carte — on abandonne Tiled / `.tmj`

Décision humaine : **plus de Tiled ni de `.tmj`**. Besoin d'un format adapté à des cartes voxel. Recherche faite — verdict :

**Aucun format voxel « standard » ne convient seul.** Les standards existants stockent géométrie + couleur, **pas** la sémantique gameplay dont on a besoin (type de terrain par tile, traversabilité, hauteurs, zones de spawn par format, références déco) :

- **MagicaVoxel `.vox`** = de-facto standard de l'édition voxel (RIFF, métadonnées). Mais limites (255 matériaux/palette, max 2000×1000×2000) et **0 notion de gameplay**. Bon pour sculpter du visuel, pas pour porter une carte tactique.
- **glTF / `.glb`** = standard temps-réel, parfait pour le **rendu** Babylon (matériaux + textures dans un fichier). Mais c'est un format de *mesh*, lossy de toute sémantique de jeu. À générer à la volée, pas à stocker comme source.

**Reco : format maison en JSON, versionné** (`schemaVersion`). C'est exactement la nature de `.tmj` (du JSON) **sans la dette Tiled**. Une carte = grille voxel = liste de cellules `{x, y, z, terrainType, height, …}` + couche déco (`{cell, assetId, …}`) + couches de spawn par format (`spawns-1v1`…). Avantages :

- Porte nativement nos données tactiques (traversabilité, types, spawns) → le vérificateur de conformité lit directement le format.
- Diff git lisible, tests faciles (comme les `.tmj` aujourd'hui).
- Découplé du rendu (cf. principe core) : le moteur consomme le JSON, le renderer en dérive les meshes.

**Interop optionnelle** (plus tard, pas v1) :
- **Import `.vox`** pour sculpter une silhouette de terrain dans MagicaVoxel/Goxel puis l'enrichir chez nous (mapping couleur→terrainType).
- **Export `.glb`** d'une carte pour preview/partage externe.

À confronter à `docs/architecture.md` (format des assets/maps actuels) et au pipeline de chargement de carte avant de figer le schéma.

## Questions ouvertes (à trancher plus tard)
- **Intégration** : panneau in-app (Babylon, on a déjà la scène 3D + picking iso) vs outil séparé. Le picking iso multi-niveaux existe déjà (`docs/isometric-height-rendering.md`) → réutilisable pour le placement voxel.
- **Périmètre** : outil interne (humain seul) d'abord, éditeur joueur (UGC) plus tard ?
- **Réutiliser de l'existant** : chercher des libs/POC d'édition voxel web avant de coder (réflexe research-before-reinventing). Goxel est desktop/C ; voir s'il existe un équivalent web embarquable ou un format d'échange.

## Liens

- `docs/references/voxel-tile-placement.md` — poser un asset voxel `.glb` sur une tile.
- `docs/isometric-height-rendering.md` — picking iso, hauteurs, layers multi-niveaux.
- `docs/tileset-mapping.md` — propriétés des tiles.
- `docs/next.md` § « décorations voxel » — exploration assets voxel en cours.
- Agent `level-designer` — connaît les contraintes carte actuelles (format `.tmj`, `validateTiledMap`).
