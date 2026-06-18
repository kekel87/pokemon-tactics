# Plan 129 — POC Cobblemon : renderer voxel + modèles GLB (in-place `render-babylon`)

**Statut : in-progress** — branche/worktree `poc-cobblemon`. Démarré 2026-06-18.

## Objectif

POC exploratoire : évaluer une **nouvelle direction artistique** pour Pokemon Tactics — terrain **voxel type Minecraft** + Pokémon en **modèles 3D Cobblemon (GLB)** — **intégré dans le vrai jeu** (combat complet jouable), pas un viewer isolé. On fait **évoluer `render-babylon` en place** (le worktree EST l'isolation : `main` intact, pivot = on jette la branche).

⚠️ **DA non figée.** Si le résultat déçoit (perf, esthétique, friction), on pivote (low-poly custom, retour sprites…). Donc : garder le couplage « système de jeu ↔ source d'assets » faible. Le core + `view-core` (maps, géométrie) ne bougent pas ; seul le **chemin de rendu** change.

Origine : `docs/next.md` § Post-Babylon, chantier **h**. Prompt POC fourni par l'humain (déplacement 2026-06-18).

## Contraintes assets (règle dure CLAUDE.md)

- Textures Minecraft vanilla (Mojang) + modèles Cobblemon (IP Pokémon) = **pas libres de droits** → **jamais commités**. Déposés **localement**, gitignored (`packages/app/public/assets/minecraft/`, `…/pokemon/`).
- Le renderer **tombe en fallback procédural** (textures 16×16 teintées par groupe) quand le PNG MC est absent → le jeu tourne sans aucun asset copyrighté. Déposer les vrais PNG = upgrade instantané, zéro changement de code.
- Si la DA est validée → on substituera un pack style-MC sous licence libre (CC-BY) ou des tiles maison.

## Échelle (exigence humaine « coller au pixel MC »)

- Bloc MC = texture **16 px**, rendu **NEAREST**, pas de mipmap.
- Référentiel : **1 bloc = 1 unité monde** (footprint tuile déjà à 1 unité via `gridToWorldXZ`).
- UV latérale **répétée par unité de hauteur** → un bloc empilé garde une face 16 px constante (pas d'étirement).
- Pokémon GLB (temps 2) dimensionnés **en blocs** (style Cobblemon, 1 bloc ≈ 1 m) — un mon ~1–2 blocs de haut.

## Phases (forcées par la dispo des assets)

### Temps 1 — Terrain Minecraft dans le combat réel (DÉBLOQUÉ, en cours)

**1.1 — Re-skin blocs MC (risque minimal, contrat géométrique inchangé).**
- Mapping `VisualTerrainGroup → bloc MC` (`top`/`side`/couleur fallback/`liquid`).
- Charge `assets/minecraft/block/<nom>.png` (NEAREST), `onError` → texture procédurale teintée.
- UV latérale tilée par unité (déjà le cas dans `extrudeTerrain`).
- **Aucun changement** de `tileTopCenter`/picking/HUD/décor → combat **jouable immédiatement**, juste re-texturé MC.
- Validation : lancer un combat réel, terrain lisible, picking/curseur/HUD OK.

**1.2 — Vrais cubes voxel + proportions cubiques.**
- Colonnes de cubes **1×1×1** (au lieu d'un box étiré), hauteur de step = 1 unité (proportions MC exactes).
- Ajuste l'échelle de hauteur render-babylon (local, n'affecte pas `render-canvas2d`) + `tileTopCenter` voxel cohérent → sprites/curseur/highlights/field-terrains suivent.
- Blocs spéciaux : transparence eau/lave, demi-blocs (slab), herbe top≠side.

**1.3 — Benchmark FPS.** `BENCHMARK.md` : map seule / map + N Pokémon. Si chute → greedy meshing (merge cubes adjacents identiques) ou thin instances, comparer.

### Temps 2 — Pokémon en GLB Cobblemon (BLOQUÉ sur convertisseur)

- Remplace les billboards sprites PMD (`directional-billboard.ts`) par des modèles GLB animés.
- Toutes animations dispo testées (idle/walk/faint/attack/air/water…), mécanisme de switch debug.
- Échelle calée sur les blocs (point Échelle ci-dessus). Inclure volants + aquatiques.
- Effets de capacités (particules Bedrock → `ParticleSystem` Babylon) = sous-étape.

### Temps 3 — Convertisseur Bedrock → GLB (offline)

- Script `.geo.json` + `.animation.json` + texture → GLB (mesh + bones + clips glTF).
- Sous-ensemble **pragmatique** de Molang (analyser un échantillon avant de coder).
- Sources : repo open-source Cobblemon (cable-mc). Tester sur 3–5 mons non Phase 1.
- `PIPELINE_LIMITATIONS.md`.

## Livrables

- `render-babylon` évolué (terrain voxel + GLB), combat jouable dans la nouvelle DA.
- `BENCHMARK.md`, `PIPELINE_LIMITATIONS.md`.
- Décision finale : **valider la DA** ou **pivoter** (à trancher avec l'humain après temps 1+2).

## Décisions

- Renderer modifié **en place** (pas de package parallèle) — choix humain 2026-06-18.
- Fallback procédural obligatoire (zéro asset copyrighté commité).
- Phasage **forcé** par l'absence de GLB (pas un choix de scope) : terrain d'abord, modèles après convertisseur.
