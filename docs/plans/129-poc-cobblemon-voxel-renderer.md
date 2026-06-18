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

**Recherche faite (`best-practices`, 2026-06-18) : aucune lib Node clé-en-main, aucun loader runtime Bedrock pour Babylon/Three. On ne réinvente PAS Molang.** Pipeline retenu = Blender headless + `mcblend` pour la reconstruction, + un **baker Molang** maison (le seul vrai code) qui pré-évalue les expressions via `@bridge-editor/molang` (npm, MIT). Draft humain validé, raffiné ci-dessous.

**Source — Cobblemon GitLab `cable-mc/cobblemon`** (sparse-checkout de `common/src/main/resources/assets/cobblemon/`) :
- `bedrock/pokemon/models/NNNN_nom/…geo.json` — géométrie (bones, cubes, pivots, UV)
- `bedrock/pokemon/animations/NNNN_nom/…animation.json` — keyframes + expressions Molang
- `bedrock/pokemon/posers/NNNN_nom/…` — **machine d'états** (idle↔walk↔faint) — NON convertible GLB → à réimplémenter en logique Babylon (étape ultérieure, hors convertisseur)
- `textures/pokemon/NNNN_nom/…png` — atlas
(NB : structure par sous-dossiers `models/`,`animations/`,`posers/`,`textures/` + dossier `NNNN_nom` par espèce — PAS `{nom}/{nom}.geo.json` à plat.)

**Étapes :**
1. **Récupération** : sparse-checkout git des 4 sous-arbres ci-dessus (assets copyrightés → local, gitignored).
2. **Baker Molang (le code maison)** : parser `animation.json` ; pour chaque canal bone avec expression Molang procédurale (`math.sin(q.anim_time*…)`, `q.life_time`…), **échantillonner à 30 fps sur un cycle** via `@bridge-editor/molang` → réécrire en keyframes purs. Les anims déjà keyframe passent telles quelles. **Sortie : un `animation.json` 100 % keyframe.**
3. **Reconstruction Blender headless + mcblend** : `blender --background --python convert.py -- <geo> <anim_baked> <png> <out.glb>` → import `.geo.json` (mesh+armature+UV), injecte les keyframes, applique la texture.
4. **Export GLB** : `bpy.ops.export_scene.gltf` — 1 `.glb`/Pokémon, clips nommés (idle/walk/faint/physical…).
5. **Babylon** : `SceneLoader.ImportMeshAsync` → `AnimationGroups` par nom ; jouer selon l'état de jeu. (La machine d'états des `posers` = logique appli, pas dans le GLB.)

**Dépendances (accord humain requis — structurel) :**
- **Blender** (système, ~200 Mo) — **installé par l'humain** (install global interdit à Claude). + addon **`mcblend`**.
- npm **`@bridge-editor/molang`** (baker).
- Nouveau dossier pipeline : `scripts/cobblemon-pipeline/` (clone + baker TS + `convert.py` Blender + orchestrateur).

**Prototype d'abord (1 Pokémon = Bulbizarre `0001_bulbasaur`)** : valider la chaîne bout-en-bout (au moins idle + marche affichés dans le combat Babylon) AVANT de batcher. Puis 3–5 mons (dont volant + aquatique).

**Risques / limites (→ `PIPELINE_LIMITATIONS.md`) :** dép Blender ; Molang procédural baké approximé (durée/fps choisis) ; `posers` (machine d'états) à refaire côté appli ; pivots/échelle Bedrock (Y-up, 1/16 bloc — géré par mcblend) ; pas de mipmaps atlas.

**Stretch (hors POC)** : extraire en plugin/loader Babylon réutilisable (voire contribution upstream). Pour le jeu, **GLB offline** reste le bon choix (zéro conversion runtime).

**Avancement (2026-06-18) :**
- ✅ Récupération assets (sparse GitLab + curl raw, local gitignored). License Cobblemon = **CC BY-NC** (commitable avec attribution comme les sprites PMD — à trancher productization).
- ✅ **Baker Molang** `scripts/cobblemon-pipeline/bake-molang.ts` (`@bridge-editor/molang`, degrés Bedrock, cache+optimizers OFF sinon `q.anim_time` foldé à 0). Bulbizarre → 9 clips keyframés, oscillations correctes (patte -47°→+7°).
- ✅ **`convert.py` v1** (Blender 5.1.1 + mcblend) : `.geo.json` → GLB **statique texturé** (skin:1, PNG embarquée, 57 meshes). À corriger : `alphaMode` BLEND → MASK (cutout pixel-art).
- ✅ **Temps 2 — Affichage statique Florizarre en combat réel** (détails ci-dessous).
- ✅ **Temps 3 v2 — Animations Florizarre** (détails ci-dessous).
- Décision techno confirmée (humain) : **Blender+Python** d'abord pour le résultat final ; version **pur TS** (`gltf-transform`) plus tard pour comparer.

**Prochaine étape : décision DA** — le POC (terrain voxel + affichage statique + animations) est fonctionnel. Valider avec l'humain : continuer dans cette direction artistique (batcher d'autres espèces, affiner pipeline, intégrer machine d'états posers) ou pivoter (low-poly custom, retour sprites).

### Temps 3 v2 — Animations Florizarre ✅ (2026-06-18)

**Baker Molang robuste** (`scripts/cobblemon-pipeline/bake-molang.ts`) :
- try/catch par expression → fallback 0 + rapport des échecs. Les seuls échecs sur Florizarre sont des `q.r.velocity_y(...)` dans les clips monture (`ride_*`) — hors sujet POC, non bloquants.
- Gère les keyframes Bedrock au format objet `{pre, post, lerp_mode}` (catmullrom) — valeur extraite = `post ?? pre`.
- **Détection de période de boucle** : les clips idle/walk Cobblemon omettent `animation_length` et reposent sur un `query.anim_time` continu (défaut Bedrock `anim_time_update`). Ils ne bouclent proprement que sur leur vraie période mathématique (LCM des composantes trig ; ex. idle Florizarre = 8 s car mix `cos(t×90×1)` [4 s] + `cos(t×90×1/2)` [8 s]). Détection numérique : échantillonnage du signal, recherche du plus petit W où la pose se répète. Sans ça, un `animation_length` arbitraire (4 s) produisait un saut visible au wrap.
- Fin exclusive pour les boucles (pas de keyframe dupliquée t=0 / t=length).

**`convert.py` v2** (`scripts/cobblemon-pipeline/convert.py`) : injecte les keyframes bakés sur l'armature mcblend → 1 NLA track nommé par clip → 1 animation glTF par clip (= `AnimationGroups` Babylon). Convention de conversion repère **Bedrock → Blender inversée depuis la source mcblend** (`common.py get_mcrotation` / `animation.py load_poses`) : rotation euler XZY `(bx, bz, −by)`, position `(lx, lz, ly)/16`, scale `(sx, sz, sy)`. Exacte pour les bones à pivot sans rotation au repos.

**Facing** (`packages/render-babylon/src/glb-pokemon-actor.ts`) : le modèle 3D s'oriente selon la convention `worldFacing` du jeu (`sprite-facing.ts` : angle XZ, South=+X / East=+Z / North=−X / West=−Z). Le modèle face +Z local → yaw φ = π/2 − worldFacing (le modèle tourne en sens inverse de l'angle, pas un offset constant).

**Résultat validé humain** : Florizarre animé (idle qui boucle sans saut visible) et orienté correctement dans le combat.

**Limites connues (→ `PIPELINE_LIMITATIONS.md`) :**
- Clips monture (`ride_*` / `rider_*`) non bakés correctement — queries vélocité non fournies au baker, échecs silencieux.
- Pas de clip `faint` chez Florizarre (KO non animé pour cette espèce).
- Le GLB Florizarre reste gitignored (asset CC BY-NC).
- Machine d'états `posers` (idle ↔ walk ↔ faint) à réimplémenter côté Babylon (hors convertisseur).

### Temps 2 — Affichage statique ✅ (2026-06-18)

**Contrat `PokemonActor`** (`packages/render-babylon/src/pokemon-actor.ts`) : interface seam commun entre le billboard sprite PMD (`DirectionalBillboard`) et le nouveau rendu 3D GLB. Permet de switcher la source de rendu sans toucher à l'orchestrateur.

**`GlbPokemonActor`** (`packages/render-babylon/src/glb-pokemon-actor.ts`) : charge le GLB Cobblemon via `loadAssetContainerAsync` et rend Florizarre (`venusaur.glb`) en combat réel.

Décisions d'implémentation :
- **Échelle** : facteur unique ×0.45, calé sur la hitbox Cobblemon (géo native 2.31 blocs × baseScale 1.2 ≈ 2.8 blocs → trop gros) pour tenir dans ~1 tuile. À affiner par espèce plus tard.
- **Centrage tuile** : via les **locators de pieds Cobblemon** (`locator_foot_*`, métadonnée embarquée dans la géo) — centroïde XZ = point d'aplomb sur la grille. Fallback `locator_middle` puis bbox. La bbox seule est biaisée (fleur/lianes/pivot sur le visage faussent le centrage).
- **Matériaux** : forcés en `ALPHATEST` cutout (`alphaCutOff 0.5`) + filtre `NEAREST` + `backFaceCulling off` — le GLB exporte `alphaMode BLEND` par défaut, ce qui produit des faces transparentes ou manquantes sans ce correctif.
- **Invariant grille respecté** : 1 Florizarre = 1 tuile occupée (footprint gameplay inchangé ; le modèle déborde visuellement mais n'occupe qu'une case).

**Toggle opt-in `use3dModels`** (défaut `false`) : `SandboxConfig.use3dModels` → `CombatSceneOptions.use3dModels` → factory `createPokemonActor` gated sur `GLB_POKEMON_IDS` (= `{venusaur}` pour l'instant). La suite sprite existante est intacte ; activer le GLB ne requiert que le flag.

**Validé visuellement par l'humain** : Florizarre (`venusaur.glb`) s'affiche correctement en combat avec `use3dModels: true` en sandbox.

## Livrables

- `render-babylon` évolué (terrain voxel + GLB), combat jouable dans la nouvelle DA.
- `BENCHMARK.md`, `PIPELINE_LIMITATIONS.md`.
- Décision finale : **valider la DA** ou **pivoter** (à trancher avec l'humain après temps 1+2).

## Décisions

- Renderer modifié **en place** (pas de package parallèle) — choix humain 2026-06-18.
- Fallback procédural obligatoire (zéro asset copyrighté commité).
- Phasage **forcé** par l'absence de GLB (pas un choix de scope) : terrain d'abord, modèles après convertisseur.
