# Plan 129 — POC Cobblemon : renderer voxel + modèles GLB (in-place `render-babylon`)

**Statut : CLÔTURÉ — pivot (DA rejetée)** — branche/worktree `poc-cobblemon`. 2026-06-18.

## Verdict (2026-06-18)

**On ne retient PAS cette direction. Retour / maintien du rendu 2D-HD sprites.** Le POC a
atteint son but : trancher la DA sur pièces. Techniquement la chaîne fonctionne bout-en-bout
(terrain voxel, pipeline Bedrock→GLB, 3 mons animés en combat, vol dynamique). **Raison du
rejet : esthétique** — jugé pas assez beau ; préférence assumée pour le 2D-HD sprites (avis
partagé par un tiers). Les limites de productisation (layering poser additif, multi-texture
render controller, strip root locomotion, posture vol/nage, flicker membranes — voir
§ Limites) renforcent que le coût ne valait pas le gain esthétique.

`main` n'a jamais été touché (le worktree était l'isolation). **La branche reste comme archive
documentée** de l'expérience (réutilisable si la question 3D revient). Worktree supprimable :
`bash .claude/scripts/worktree.sh rm poc-cobblemon` (la branche est conservée).

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
- ✅ **Conversion + intégration Dracaufeu** (`charizard.glb`, volant) et **Léviator** (`gyarados.glb`, nageur). `GLB_POKEMON_IDS` = `{venusaur, charizard, gyarados}`. GLBs gitignored.
- ✅ **Menu déroulant debug** (dev-only) dans `combat-scene` : `<select>` overlay listant tous les clips du/des modèles 3D présents ; sélection → joue le clip en boucle. Remplace l'ancien cycleur clavier. Méthodes `animationNames()` / `playClip(name)` sur `GlbPokemonActor`.
- ✅ **Validation humaine des clips** : le cœur des anims corps (`idle`, `ground_walk`, `air_idle`/`air_fly`/`air_glide`, `physical`, `special`, `idle_quirk`) est propre et jouable.
- ✅ **Vol dynamique** (`glb-pokemon-actor.ts`) : l'état volant est désormais dérivé du **clip actif** (pas d'un flag statique). Un clip `air_*` → le modèle plane (lift +0.8 bloc) et ses attaques sont classées `air_physical`/`air_special`/`air_status` ; un clip sol → posé + catégories sol. L'intention sol/air est portée explicitement par `Idle`/`Walk` du jeu : `FlyingIdle` est choisi au-dessus de l'eau via `FLYING_GLIDE_CANDIDATES`, `Idle` sinon — Dracaufeu vole donc uniquement quand il vole réellement, et reste au sol en idle/fallback. Démo : sélectionner un clip `air_*` dans le menu debug → décollage immédiat.
- ✅ **Détection de période de boucle — argmin** (`bake-molang.ts`) : au lieu de prendre le premier raccord sous tolérance (qui acceptait un faux positif à 4 s sur le `ground_idle` de Dracaufeu → petit saut visible), on sélectionne désormais la fenêtre qui **minimise** l'erreur de raccord (argmin) dans un budget de 16 s. Quand la vraie période dépasse ce budget (ex. `ground_idle` Dracaufeu ≈ 40 s, dû à un composant lent à fréquence 0.7), on bake le meilleur loop disponible (11.67 s) sans erreur fatale.
- ✅ **Préprocessing géométrique** (`convert.py`) : (a) **strip des cubes `*_hidden`** — les bones `*_hidden` portent des membranes alternatives que le render controller Cobblemon masque ; ils n'apparaissent jamais simultanément avec leur jumelle → les garder provoque du z-fighting ; ils sont supprimés avant l'export GLB. (b) **Décalage de profondeur des membranes coplanaires** — les membranes plates (épaisseur 0) qui se chevauchent réellement dans le même plan sont détectées par clustering de chevauchement et reçoivent un léger décalage (~0.5 px borné) pour éviter le z-fighting résiduel dans ce sous-ensemble.
- Décision techno confirmée (humain) : **Blender+Python** d'abord pour le résultat final ; version **pur TS** (`gltf-transform`) plus tard pour comparer.

**Prochaine étape : décision DA** — le POC (terrain voxel + 3 Pokemon animés + menu debug clips) est fonctionnel. Valider avec l'humain : continuer dans cette direction artistique (batcher d'autres espèces, affiner pipeline, intégrer machine d'états posers) ou pivoter (low-poly custom, retour sprites). Les limites ci-dessous sont les éléments à peser pour cette décision.

### Limites connues (productisation)

Ces catégories de clips sont **non jouables seules dans l'état actuel du POC** — pas des bugs, mais des chantiers identifiés pour la productisation.

1. **Layering additif — poser Cobblemon non réimplémenté** : les clips additifs (`*_quirk`, `blink`, `cry`) sont conçus pour être superposés à l'idle par la machine d'états Cobblemon (poser). Joués seuls, ils n'animent que le visage ou une partie du corps — le reste est au repos. Résoudre : réimplémenter le layering additif côté Babylon (blending par masque d'os).

2. **Strip root locomotion** : les clips de locomotion (`runspeed`, variantes `run`) embarquent une translation de la racine (root motion) — le modèle sort de l'écran lorsqu'on les joue seuls. En jeu, le déplacement est géré séparément par le moteur. Résoudre : stripper la translation du root de ces clips lors de la conversion (post-traitement `gltf-transform` ou option `convert.py`).

3. **Multi-texture render controller (feu de Dracaufeu absent)** : Cobblemon utilise un render controller pour animer des textures séparées (`charizard_flame1-4.png`) simulant les flammes de la queue. Le convertisseur actuel n'applique qu'une seule texture → le feu est absent du GLB. Résoudre : support multi-texture dans le pipeline de conversion.

4. **Posture vol/nage** : Dracaufeu (volant) et Léviator (nageur) affichent l'idle au sol, car leurs squelettes/anims ne sont pas conçus pour reposer sur le sol. Résoudre : hauteur de vol/nage configurable + posture aérienne/aquatique correcte (chantier rendu + machine d'états posers).

5. **Poses partielles** (`recoil`, `air_recoil`, `hold_item`) : n'animent que peu d'os (corps au repos). Destinées à être combinées avec d'autres clips. Jouables seules uniquement à titre de débogage.

6. **Clips monture** (`ride_*`) : nécessitent un cavalier et des queries de vélocité non fournies au baker. Non bakés correctement → résultat vide ou incorrect. Hors périmètre POC (aucun cavalier dans le jeu).

7. **Flicker résiduel de membranes** : un z-fighting léger persiste sur certaines petites membranes internes d'aile (visible sur Dracaufeu). Cause : Minecraft sépare les surfaces coplanaires via un ordre de rendu par cube, des valeurs `inflate` par segment, et une visibilité par render controller — le pipeline réplique partiellement ces mécanismes (strip des bones `*_hidden` + nudge des chevauchements coplanaires) mais pas le layering/ordre de rendu complet. Éliminer entièrement le flicker résiduel exigerait de reproduire le pipeline de rendu d'entités Minecraft, ce qui constitue un vrai chantier moteur, hors scope POC.

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
