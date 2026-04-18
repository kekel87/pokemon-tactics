# Plan 062 — Spike renderer 2D-HD (3D géométrie + sprites billboards)

**Statut** : done — 4/4 points validés (2026-04-18), **mais choix stack pas encore final** (voir plan 063)
**Créé** : 2026-04-17
**Effort estimé** : 1-2 jours (spike exploratoire, pas d'implémentation finale)
**Branche** : `plan-062-3d-renderer-spike`

## Contexte

Le renderer Phaser 4 iso 2D atteint ses limites :
- Occlusion derrière obstacles (plan 061 abandonné — silhouette bancale)
- Rotation de caméra impossible proprement
- Depth sorting manuel fragile sur terrains élevés

Référence visuelle cible : Triangle Strategy / FFTIC / Tactics Ogre PSP = **2D-HD** = sprites pixel-art en billboards sur géométrie 3D extrudée.

## Objectif du spike

**NE PAS** migrer le renderer. **VALIDER** qu'une stack 3D web peut porter notre pipeline existant sans perte de qualité visuelle. Décision go/no-go à la fin du spike.

## 4 points critiques à valider

Chaque point est un critère go/no-go individuel. Si un seul échoue, on reste en iso 2D et on débuggue l'occlusion autrement.

### 1. Pixel-art fidèle
- Orthographic camera (pas de perspective qui déforme les pixels)
- Texture filtering NEAREST (pas d'interpolation qui flou les pixels)
- Pixel-snapping (alignement des billboards sur la grille de pixels de l'écran)
- **Critère** : un sprite PMDCollab 32x32 rendu à taille naturelle doit être visuellement identique à son rendu Phaser actuel (pas de blur, pas d'aliasing).

### 2. Sprites directionnels sous rotation caméra
- Charger un sprite PMDCollab 8 directions (N/NE/E/SE/S/SW/W/NW)
- Billboard qui fait toujours face à la caméra
- Quand la caméra tourne de 90°, le sprite doit automatiquement basculer vers la bonne direction absolue (ex: un Pokemon "facing South" doit rester "facing South" dans le monde, même si la caméra tourne).
- **Critère** : rotation caméra 0° → 90° → 180° → 270°, le sprite montre bien S/W/N/E respectivement.
- **Piège connu** : la direction "face/flanc/dos" côté core (plan 052) est indépendante de l'angle caméra. À re-vérifier.

### 3. Extrusion Tiled
- Lire un JSON Tiled existant (carte sandbox "2 pillars" idéalement)
- Pour chaque cell, générer une boîte 3D de hauteur = height property
- Texturer les faces de la boîte (top + 4 côtés) depuis le tileset PNG
- **Critère** : la carte 3D générée ressemble visuellement à la version iso 2D, sans trous ni artefacts de texture.

### 4. Occlusion naturelle
- Placer un Pokemon (billboard) derrière un pilier 2-blocs
- Vérifier que le depth buffer masque naturellement la partie cachée du sprite
- **Critère** : aucun code custom d'occlusion nécessaire, le rendu fait "le bon truc" par défaut.

## Stack retenue : **Three.js**

Décision prise après `best-practices` (2026-04-17) — voir décision #265 de `docs/decisions.md`.

**Pourquoi Three.js (vs Babylon / PlayCanvas)** :
- Bundle ~168 kB gzip (vs ~700 kB Babylon tree-shaké).
- TypeScript natif, API idiomatique, types intégrés au repo (pas de `@types` séparé).
- Pattern pixel-art fidèle **éprouvé** : `RenderPixelatedPass` fournie nativement dans les examples officiels (r143+).
- Existence de jeux tactiques web open source en Three.js → `chongdashu/threejs-tactics-game` reproduit exactement notre cas (ortho + 8-dir sprites + TS).
- Communauté large (5M DL/semaine vs 13K Babylon).

**Pourquoi PAS Babylon.js** :
- Thread officiel confirme que `NEAREST_SAMPLINGMODE` ne produit pas de pixel-perfect sprites — **critère n°1 rédhibitoire**.
- 4× le bundle pour des features dont on n'a pas besoin (physics, GUI, inspector).

**Pourquoi PAS PlayCanvas** :
- TypeScript secondaire, ESM modules encore en RFC fin 2024, zéro exemple pixel-art 3D, communauté nulle sur ce use case.

### Gotchas Three.js à anticiper

- **Pixel-art** : utiliser le pattern `WebGLRenderTarget` bas-res (ex: 640×360) + upscale via `NearestFilter`, PAS `setPixelRatio(1)` seul (fragile sur DPR > 1). Exemple officiel : `webgl_postprocessing_pixel.html`.
- **Billboards 8-dirs** : `THREE.Sprite` face caméra auto, mais sélection directionnelle = manuel (~20 lignes). Calculer `atan2` entre position caméra et sprite → 8 secteurs de 45° → UV du spritesheet. **Combiner avec `pokemon.orientation` du core** (direction monde, indépendante de l'angle caméra).
- **Pixel-snapping** : pas natif. Clamp positions sur grille texel. Si les unités monde sont multiples de la taille d'un texel, le shimmering disparaît.
- **Extrusion Tiled** : pas de loader natif. Notre parser plan 045 produit `{ height }` par tile → `BoxGeometry(1, height, 1)` + UVs du tileset sur faces top/latérales. Aucune lib tierce.
- **Perf** : 20 sprites + carte 20×20 = non-problème d'après les exemples tactics trouvés. À confirmer dans le spike.

### Références clés (lues avant de coder)

1. **[chongdashu/threejs-tactics-game](https://github.com/chongdashu/threejs-tactics-game)** — FFT-like, Three.js + TS, ortho, 8-dir sprites. `spriteAnimator.ts` à étudier. ⚠️ vibe-coded, prendre le pattern pas le style.
2. **[KodyJKing/hello-threejs](https://github.com/KodyJKing/hello-threejs)** — 402 stars, TS pur, modulaire, auteur de `RenderPixelatedPass` officiel. Pattern pixel-art propre.
3. **[Three.js `webgl_postprocessing_pixel` (officiel)](https://threejs.org/examples/webgl_postprocessing_pixel.html)** — pipeline pixel-art de référence.
4. **[coldi/r3f-game-demo](https://github.com/coldi/r3f-game-demo)** — 653 stars, TS 97%, base réelle de "Colmen's Quest". Architecture tile-based propre (pas de billboards dir mais structure).
5. **[Dimetric ortho camera for retro pixel look (prisoner849)](https://discourse.threejs.org/t/dimetric-orthographic-camera-angle-for-retro-pixel-look/24455)** — setup caméra dimetric 60°/45° via `THREE.Spherical`, ratio pixels iso 2:1. Fiddle live.

### Références plan 062 non couvertes

Aucune des refs ci-dessus ne montre des **billboards directionnels 8 directions propres et récents en Three.js** — `chongdashu` est la seule ref pratique (vibe-coded). La technique (dot-product ou atan2 caméra→sprite, 8 secteurs, sélection UV/frame) est connue mais à coder à la main. **C'est le vrai travail du spike.**

## Procédure

1. **Installer Three.js + Vite** dans un nouveau package `packages/renderer-3d-spike/` (pnpm workspace). Versions : Three.js r170+, Vite 6, TS strict. Pas de worktree — l'humain gère le branching si besoin.
3. **Point 1 (pixel-art)** : un seul billboard à l'écran + `OrthographicCamera` setup dimetric (prisoner849) + `RenderPixelatedPass` (ou render-target manuel). Comparer visuel vs Phaser.
4. **Point 2 (directional)** : charger un sprite PMDCollab 8-dirs, ajouter rotation caméra via touches Q/E. Implémenter la sélection UV par `atan2(camera→sprite)` + 8 secteurs. Combiner avec `pokemon.orientation` du core (plan 052).
5. **Point 3 (Tiled)** : loader la carte sandbox "2 pillars" via le parser existant (plan 045), extruder en `BoxGeometry`, texturer top + sides.
6. **Point 4 (occlusion)** : placer le Pokemon billboard derrière un pilier 2-blocs, vérifier que le depth buffer masque naturellement sans hack.
7. **Verdict** : 4/4 pass → plan 063 rewrite renderer. <4 pass → retour iso 2D + fix occlusion autrement.

## Ce que le spike NE FAIT PAS

- Migration du renderer en prod
- UI (menus, timeline, panels) — on garde Phaser overlay pour l'instant si on pivote
- Animations de combat (attaque, dégâts, statuts) — après validation du spike
- Performance/optim — on valide la faisabilité, pas la perf

## Livrable

- Dossier `packages/renderer-3d-spike/` (à supprimer ou garder selon verdict)
- Section dans `docs/decisions.md` avec la décision actée + raisons
- Si go : plan 063 pour le rewrite renderer complet, phases et ordre
- Si no-go : plan 063 pour le fix occlusion iso 2D (mode debug visuel + correction)

## Notes

- Archive plan 061 : branche `plan-061-occlusion-before-3d-pivot` (commit `2426edf`). Code silhouette Phaser 4 conservé pour référence.
- Core, data, IA, LoS, CT, statuts : **intacts**, pas de migration nécessaire.
- Tiled comme éditeur : **garder** (parser existant OK). Éventuellement à ré-évaluer plus tard si besoin d'édition 3D native.
