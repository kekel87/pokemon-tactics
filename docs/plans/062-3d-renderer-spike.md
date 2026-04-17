# Plan 062 — Spike renderer 2D-HD (3D géométrie + sprites billboards)

**Statut** : draft
**Créé** : 2026-04-17
**Effort estimé** : 1-2 jours (spike exploratoire, pas d'implémentation finale)

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

## Stack à arbitrer (début de session)

Lancer `best-practices` avec la question : "Stack 3D web pour jeu tactique pixel-art avec billboards sprites — Babylon.js vs Three.js vs PlayCanvas, critères : maturité, pixel-art support, orthographic camera, sprite billboards directionnels, compat pnpm monorepo, TypeScript types."

**A priori** (à confirmer) :
- **Babylon.js** — maturité, billboard sprites natifs, TypeScript first-class, documentation solide, playground interactif. Mon choix par défaut.
- **Three.js** — écosystème plus vaste, plus bas niveau, demande plus de glue code pour les sprites/billboards.
- **PlayCanvas** — éditeur intégré (pas forcément utile vu qu'on a Tiled), moins adopté côté TypeScript.

## Procédure

1. **Worktree isolé** : `EnterWorktree` pour ne pas polluer main.
2. **Installer la stack** dans un nouveau package `packages/renderer-3d-spike/` (pnpm workspace).
3. **Point 1 (pixel-art)** : un seul billboard à l'écran, caméra ortho, comparer visuel vs Phaser.
4. **Point 2 (directional)** : charger un sprite PMDCollab, ajouter rotation caméra via touches Q/E.
5. **Point 3 (Tiled)** : loader la carte "2 pillars", extruder, rendu statique.
6. **Point 4 (occlusion)** : placer le Pokemon, vérifier le depth buffer.
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
