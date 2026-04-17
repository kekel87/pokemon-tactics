# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu par l'humain via `/next`.

## À faire maintenant

- **Pivot 2D-HD (3D géométrie + sprites billboards)** — décision actée 2026-04-17. Le renderer 2D iso Phaser 4 atteint ses limites (occlusion, rotation impossibles proprement). Cible : stack à la Triangle Strategy / FFTIC / Tactics Ogre PSP.
- **Premier pas : spike 1-2 jours (plan 062)** pour valider 4 points critiques avant de s'engager :
  1. Pixel-art fidèle (orthographic camera, NEAREST filtering, pixel-snapping)
  2. Sprites PMDCollab directionnels compatibles rotation caméra (recalculer face/flanc/dos selon angle de vue)
  3. Extrusion Tiled → boîtes 3D texturées (garder le parser existant)
  4. Occlusion naturelle via depth buffer (plus de hack silhouette)
- **Stack à arbitrer au début du spike** : Babylon.js (privilégié pour sa maturité 2D/3D + billboards natifs) vs Three.js (plus bas niveau, écosystème plus vaste) vs PlayCanvas. Lancer `best-practices` au début de la prochaine session pour trancher.
- **Drop stash `plan-060-full-wip`** (devenu obsolète post-pivot).

## Reporté / à refaire

- **Plan 061 silhouette d'occlusion** — archivé sur branche `plan-061-occlusion-before-3d-pivot` (commit `2426edf`). Bancal visuellement (silhouette blanche transparente au lieu de tintée équipe, détection partielle sur piliers stackés). Obsolète post-pivot : la 3D résout le problème nativement.
- **UI (menus, panels, timeline, log)** — à décider : rester en Phaser overlay 2D au-dessus du canvas 3D, ou passer en HTML/CSS par-dessus. À trancher après le spike selon la stack retenue.

## Fait récemment

- 2026-04-17 — **Décision pivot 2D-HD** actée. Renderer Phaser 4 iso abandonné. Plan 061 silhouette archivé sur branche (invisible bug + détection partielle). Discussion : Tactics Ogre PSP / Triangle Strategy / FFTIC = sprites billboards sur blocs 3D extrudés depuis tileset Tiled.
- 2026-04-17 — Plan 061 tenté (silhouette outline + masque FilterList Phaser 4) → bancal visuellement → abandonné → pivot décidé.
- 2026-04-17 — Plan 060 Section A : curseur FFTA (4 variantes, touche H, settings) + fix depth curseur sol (commit d2037e1).
- 2026-04-17 — Cleanup orchestration `.claude/` (commit 288f79c).
- 2026-04-16 — Plan 059 : timeline CT prédictive scrollable.
- 2026-04-16 — CI : gate integration tests + fix PlacementPhase + tileset brightness uniforme.

---

## Contexte pour la prochaine session

**Ouvrir avec `/next`** puis :

1. Lire `docs/plans/062-3d-renderer-spike.md` (draft à rédiger au début de la prochaine session) — plan de spike détaillé.
2. Lire `docs/decisions.md` — chercher la décision sur le pivot 2D-HD (à enregistrer).
3. Lancer `best-practices` : "stack 3D web pour jeu tactique pixel-art avec billboards — Babylon.js vs Three.js vs PlayCanvas". Critères : maturité, pixel-art support, orthographic camera, sprite billboards directionnels, compat pnpm monorepo, TypeScript types.
4. Démarrer le spike dans un worktree isolé (`isolation: "worktree"`) pour ne pas polluer main tant qu'on n'a pas validé les 4 points critiques.

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. À consulter si on veut comprendre ce qui a été tenté en 2D iso avant de pivoter.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. L'item principal en premier.
- **Reporté** : format `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : format `- YYYY-MM-DD — ce qui a été fait`. Cap à 10, vire les plus anciens.
- Mettre à jour à la fin d'un plan, à la fin d'une étape significative, ou quand un agent est reporté.
- Si un item passe de "À faire" à "Fait", le déplacer.
- Si un item dans "Reporté" devient impertinent, le supprimer avec une ligne dans "Fait".
