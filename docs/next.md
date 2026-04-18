# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu par l'humain via `/next`.

## À faire maintenant

- **Choix stack renderer 2D-HD rouvert** (2026-04-18). Spike plan 062 Three.js validé 4/4, mais les outils Babylon (Inspector v2 officiel, GUI Editor WYSIWYG, UI native, MCP communauté) n'avaient pas été suffisamment pesés. Décision #266 mise en suspens. Décisions #267 (spike Babylon parallèle) et #268 (pivot = nouvelle phase après Phase 3) actées.
- **Prochaine action possible** : démarrer **plan 063 spike Babylon.js** (branche `plan-063-babylon-spike`, miroir du 062 — 4 points critiques + 4 points tooling + compile TS strict sans `skipLibCheck`). À lancer quand on veut — pas urgent car le pivot attend la fin de Phase 3.
- **Phase 3 Terrain & Tactics — items restants à livrer AVANT pivot** (voir `docs/roadmap.md`) :
  - Interactions type/terrain + modification terrain par attaques
  - Système de décorations Tiled (tileset `decorations.tsj` — marquages arène + herbes hautes + décos)
  - Éditeur de terrain / génération IA
  - Maps variées + roster d'attaques terrain/dénivelé
  - **Occlusion X-ray plan 060 restant SKIPPÉE** (sera résolue nativement par le renderer 2D-HD)
- **Finaliser commit spike 062** sur branche `plan-062-3d-renderer-spike` (déjà fait côté code, reste à push).
- **Drop stash `plan-060-full-wip`** (obsolète post-pivot).
- **Valider visuellement 4 points du spike** une fois l'ancre réparée :
  1. Carte 10×7 extrudée, couleurs par terrain
  2. Pokemon billboard visible, animé Idle
  3. ← / → rotation caméra : la frame du Pokemon change
  4. A/Z tourne le Pokemon dans le monde
  5. **Occlusion** naturelle via depth buffer (pas de hack custom)
- **Si 4/4 pass** → rédiger plan 063 (rewrite renderer complet).
- **Drop stash `plan-060-full-wip`** (devenu obsolète post-pivot).

## Reporté / à refaire

- **Plan 061 silhouette d'occlusion** — archivé sur branche `plan-061-occlusion-before-3d-pivot` (commit `2426edf`). Bancal visuellement (silhouette blanche transparente au lieu de tintée équipe, détection partielle sur piliers stackés). Obsolète post-pivot : la 3D résout le problème nativement.
- **UI (menus, panels, timeline, log)** — à décider : rester en Phaser overlay 2D au-dessus du canvas 3D, ou passer en HTML/CSS par-dessus. À trancher après le spike selon la stack retenue.

## Fait récemment

- 2026-04-18 — **Débat stack Three.js vs Babylon.js rouvert**. `best-practices` a mis en évidence des avantages Babylon mal pesés (Inspector v2 officiel maintenu 2026, GUI Editor WYSIWYG, `@babylonjs/gui` intégré, MCP communautaire, Node Particle Editor) + un point contre-intuitif (Babylon a plus de conflits `lib.dom` avec TS 6.0 que Three.js). Décisions #267 et #268 : plan 063 spike Babylon en parallèle, pivot = nouvelle phase après Phase 3.
- 2026-04-18 — **Spike plan 062 validé 4/4**. Pixel-art, directional billboard sous rotation caméra, extrusion Tiled, occlusion depth buffer natif — tous OK. Ancre sprite calibrée (`footAnchor: 0.34` Bulbasaur Idle). Bundle 131 kB gzip. Statut plan 062 : done, stack pas encore finale.
- 2026-04-17 — **Spike point 3 : Tiled extrusion** livré. `loadTiledMap` + `extrudeTerrain` chargent `sandbox-los.tmj` (10×7, 3 niveaux d'élévation) et extrudent chaque cell en `BoxGeometry` colorée par terrain. Bundle 131 kB gzip.
- 2026-04-17 — **Spike point 2 : directional billboard 8-dirs** livré. `DirectionalBillboard` class charge atlas PMDCollab (bulbasaur), compute `(worldFacing - cameraAzimuth) → 8 secteurs → UV`, Idle animé. Touches A/Z pour tourner le Pokemon, ← / → caméra. Point 1 (pixel-art) validé visuellement par l'humain.
- 2026-04-17 — **Spike plan 062 scaffold** : `packages/renderer-3d-spike/` (Three.js r170, Vite 8, TS strict). Point 1 câblé (ortho dimetric + `RenderPixelatedPass` + NEAREST filter + sample scene). Typecheck + build OK (125 kB gzip).
- 2026-04-17 — **`best-practices` : stack 2D-HD = Three.js** (vs Babylon/PlayCanvas). Bundle 168 kB, pixel-art natif (`RenderPixelatedPass`), refs `chongdashu`, `KodyJKing`, `coldi`, prisoner849. Décisions #265-266 dans `decisions.md`, plan 062 mis à jour.
- 2026-04-17 — **Décision pivot 2D-HD** actée. Renderer Phaser 4 iso abandonné. Plan 061 silhouette archivé sur branche (invisible bug + détection partielle). Discussion : Tactics Ogre PSP / Triangle Strategy / FFTIC = sprites billboards sur blocs 3D extrudés depuis tileset Tiled.
- 2026-04-17 — Plan 061 tenté (silhouette outline + masque FilterList Phaser 4) → bancal visuellement → abandonné → pivot décidé.
- 2026-04-17 — Plan 060 Section A : curseur FFTA (4 variantes, touche H, settings) + fix depth curseur sol (commit d2037e1).
- 2026-04-17 — Cleanup orchestration `.claude/` (commit 288f79c).
- 2026-04-16 — Plan 059 : timeline CT prédictive scrollable.

---

## Contexte pour la prochaine session

Tout est en ordre. Démarrer direct le spike (pas de worktree, l'humain gère le branching si besoin) :

1. `pnpm init` dans `packages/renderer-3d-spike/`, installer `three` + `vite` + TS strict.
2. Étudier `chongdashu/threejs-tactics-game` (GitHub) pour la ref billboard directionnel avant d'écrire le point 2.
3. Attaquer point 1 (pixel-art).

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. À consulter si on veut comprendre ce qui a été tenté en 2D iso avant de pivoter.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. L'item principal en premier.
- **Reporté** : format `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : format `- YYYY-MM-DD — ce qui a été fait`. Cap à 10, vire les plus anciens.
- Mettre à jour à la fin d'un plan, à la fin d'une étape significative, ou quand un agent est reporté.
- Si un item passe de "À faire" à "Fait", le déplacer.
- Si un item dans "Reporté" devient impertinent, le supprimer avec une ligne dans "Fait".
