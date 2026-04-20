# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu par l'humain via `/next`.

## À faire maintenant

- **[PROCHAIN] Plan 065 — Fix depth unifié + picking modifier + occlusion dynamique** (2026-04-20, **draft prêt** : `docs/plans/065-occlusion-fade-depth-fix.md`). Plan en **3 parties** :
  - **Partie A — Fix depth** : bug structurel identifié — tiles surélevées à depth `[0, 205]`, Pokemon à `[520+]`, donc Pokemon TOUJOURS devant les piliers en tri. Cause du bug "Pokemon par-dessus pilier" sur `sandbox-los.tmj`. Fix : unifier les tiles `elevation > 0` dans `DEPTH_POKEMON_BASE`. Les décos le font déjà.
  - **Partie B — Picking Alt-click** : résout l'ambiguïté de sélection quand le diamond d'un haut de pilier recouvre pixel-parfait celui d'une tile derrière. `Alt` maintenu → préfère la 2e meilleure candidate (depth inférieure). Liseré jaune en feedback. Indépendante de A et C.
  - **Partie C — Fade dynamique** : pattern fading foliage per-sprite, détection par frame via footprint grid + screen bbox overlap. Scope : décos + tiles `height > 0`. Alpha 0.4, epsilon 0.5 contre scintillement, pipeline reset→test→apply.
  - Sans Partie A, Partie C inutile (fade jamais déclenché). Partie A livre déjà une amélioration visible seule. Partie B = QoL autonome.
  - `best-practices` + `plan-reviewer` consultés, 6 edits appliqués (Partie B ajoutée après review humaine). **Prêt pour exécution dès validation humaine.**
  - **Condition de report Phase 3.5** : si ce plan réussit visuellement → Babylon repoussé après Phase 7 (décision #272).
- **Finir Phase 3 AVANT pivot Babylon** (décision humain 2026-04-18). Ordre actualisé 2026-04-20 :
  1. ~~Plan 064 — Décorations / obstacles Tiled~~ — **done 2026-04-19** (gate CI vert, marquages arène différés en bonus).
  2. **Plan 065 — Occlusion dynamique fade** (nouveau, à rédiger).
  3. Interactions type/terrain + modification terrain par attaques.
  4. Roster d'attaques tirant parti du terrain/dénivelé (si pertinent).
  5. **Occlusion X-ray plan 060 SKIPPÉE** (résolue soit par plan 065 en iso, soit nativement par Babylon).
- **Bonus plan 064 différé — marquages arène + pokéball centrale** : 3 approches documentées dans `docs/plans/064-decorations-obstacles.md` (PixelLab multi-tiles découpé, peinture manuelle Aseprite, génération procédurale). Reco : approche 2 (manuelle) pour une arène propre rapide, ou reporter post-Babylon pour utiliser `DecalMap`. Ne pas oublier.
- **Éditeur de terrain / génération IA + choix/ajout de maps** → **Phase 3.6 « Maps & Éditeur », positionnée après Phase 7** (liée à Babylon). Voir `docs/roadmap.md`.
- **Rewrite renderer Babylon (Phase 3.5) → déplacée APRÈS Phase 7** (décision 2026-04-20, conditionnée par la réussite du plan 065). Plan numéroté au moment de sa rédaction. Pistes à garder sous le coude quand on l'ouvre :
  - Shim type Inspector (`src/types/babylonjs-inspector.d.ts` → `declare module "@babylonjs/inspector" { export {}; }`) pour tester `skipLibCheck: false`.
  - Audit bundle `rollup-plugin-visualizer`, cible 180-220 kB gzip vs 273 kB spike.
  - Flat-shaded `ShaderMaterial` custom (cohérence pixel-art FFTA).
  - `GridMaterial.gridOffset = (0.5, 0, 0.5)` (shader local-space).

## Reporté / à refaire

- **Plan 061 silhouette d'occlusion** — archivé sur branche `plan-061-occlusion-before-3d-pivot` (commit `2426edf`). Bancal visuellement (silhouette blanche transparente au lieu de tintée équipe, détection partielle sur piliers stackés). Obsolète post-pivot : la 3D résout le problème nativement.
- **UI (menus, panels, timeline, log)** — à décider : rester en Phaser overlay 2D au-dessus du canvas 3D, ou passer en HTML/CSS par-dessus. À trancher après le spike selon la stack retenue.

## Fait récemment

- 2026-04-19 — **Plan 064 livré (done)**. Décorations Tiled : Ghost traverse tous les obstacles (core `canTraverse`/`canStopOn` étendus), parser objectgroup `decorations` + patch auto `MapDefinition`, tileset Collection of Images `decorations.tsj`, 4 sprites PixelLab (tall-grass, rock 1×1×1, rock 2×2×2, tree 1×1×3), renderer `DecorationsLayer` (auto-placement herbe haute + sprites explicites), map `decorations-demo.tmj`, 6 scénarios Gherkin (`scenarios/ghost-traversal.scenario.test.ts`), subpath export `@pokemon-tactic/core/testing`. Gate CI : 1067 unit / 107 integration / 6 scenario. Marquages arène + pokeball = bonus différé.
- 2026-04-19 — **Validation humaine des règles gameplay plan 064** : Ghost traverse tous les obstacles (y compris arbre), `|heightDiff| >= 2` bloque la mêlée dans les deux sens. Plan 064 débloqué pour passer `ready`.
- 2026-04-18 — **Verdict spike 063 = Babylon.js retenu** (décision #269, commit `13eeebb`). Renderer 2D-HD sera Babylon. Rewrite reporté **après Phase 3** (décision humain : finir Phase 3 rapidement d'abord).
- 2026-04-18 — **Spike plan 063 Babylon livré**. Package `packages/renderer-babylon-spike/` créé sur main (`@babylonjs/core` ^8 + `@babylonjs/gui` ^8 + `@babylonjs/inspector` devDep, Vite 8). Code port Three.js → Babylon livré (main, directional-billboard, terrain-extruder, load-tiled-map). Build OK (81 kB gzip main chunk). **Point 8 TS strict mesuré** : 7 erreurs **toutes dans `@babylonjs/inspector`** (React/JSX/Fluent UI), 0 dans Babylon core ni notre code. Validation visuelle bloquée par sandbox Claude qui tue les dev servers background — à reprendre en dev server owned par l'humain.
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

**Plan 064 terminé (2026-04-20).** Prochain plan : interactions type/terrain + modification terrain par attaques. Ouvrir avec `docs/roadmap.md` Phase 3 pour l'item suivant.

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. À consulter si on veut comprendre ce qui a été tenté en 2D iso avant de pivoter.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. L'item principal en premier.
- **Reporté** : format `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : format `- YYYY-MM-DD — ce qui a été fait`. Cap à 10, vire les plus anciens.
- Mettre à jour à la fin d'un plan, à la fin d'une étape significative, ou quand un agent est reporté.
- Si un item passe de "À faire" à "Fait", le déplacer.
- Si un item dans "Reporté" devient impertinent, le supprimer avec une ligne dans "Fait".
