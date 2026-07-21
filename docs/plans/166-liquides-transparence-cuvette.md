# Plan 166 — Liquides : transparence + cuvette + immersion des sprites

> **Statut : DONE (2026-07-21, validé human-testing)**
> Phase : Post-Babylon, polish visuel 2D-HD (roadmap « Eau & liquides »).
> 100 % visuel — le core garde la vraie hauteur (déplacement / chute / portée inchangés).
>
> ⚠️ Le design a évolué en cours de human-testing par rapport au draft ci-dessous (conservé pour
> l'historique). Voir **§ Bilan** en fin de fichier pour l'implémentation finale et les écarts.

## Objectif

Rendre les tuiles liquides jolies : surface en creux (bassin), eau translucide laissant voir un fond, et sprites qui s'enfoncent dans le liquide.

## Modèle géométrique

Le corps rendu d'une tuile liquide (`bodyHeight = max(0.5, tile.height) × TILE_HEIGHT_SCALE`) est découpé en **6 tranches**. Surface commune à **5/6** (creux de 1/6 sous le sol solide voisin).

### Cas A — liquides profonds / infranchissables
Groupes : `deep_water`, `lava`.
- Boîte **opaque** unique, sommet ramené à **5/6** du corps (texture liquide actuelle, sides = top assombri comme aujourd'hui).
- Pas de fond visible.

### Cas B — liquides franchissables
Groupes : `water`, `swamp`.
- **Fond opaque** 0 → 3/6, texture **sable** (`sable-top`/`sable-side`) — provisoire.
- **Eau translucide** 3/6 → 5/6 (boîte de 2/6 de haut), alpha-blend.

### Immersion des sprites
Tout Pokemon **au sol** (hors Volant / Lévitation) sur une tuile liquide (A ou B) → pieds ancrés à **3/6** du corps au lieu du sommet. Effet « il nage » (profond) / « pieds dans l'eau » (franchissable). Volant/Lévitation restent au niveau du sommet plein (planent au-dessus).

## Technique (recherche `best-practices` validée)

Pattern déjà en prod dans `babylon-field-terrains.ts` : `MATERIAL_ALPHABLEND` + `disableDepthWrite` + `zOffset` + `alphaIndex`, **rendingGroupId 0** (garder l'occlusion croisée sprite/terrain — piège n°1). Fresnel natif `StandardMaterial` (bord plus dense) et scroll UV (rides) = itérations ultérieures, hors périmètre v1.

## Constantes (`packages/view-core/src/constants.ts` + ré-export babylon)

- `LIQUID_SURFACE_RATIO = 5 / 6` — sommet de la surface (tous les liquides).
- `LIQUID_DEPTH_RATIO = 3 / 6` — sommet du fond sable (Cas B) **et** ancrage des pieds des sprites au sol (A et B).
- `BABYLON_LIQUID_WATER_ALPHA = 0.6` (babylon-constants) — alpha de la nappe.
- `BABYLON_LIQUID_ALPHA_INDEX` — tri de la nappe translucide (mirror `BABYLON_FIELD_TERRAIN_ALPHA_INDEX`).
- Sets de groupes : `DEEP_LIQUID_GROUPS = {deep_water, lava}`, `WALKABLE_LIQUID_GROUPS = {water, swamp}`, helper `isLiquidGroup(group)`.

## Étapes

1. **Constantes + doc** : ratios (view-core), alpha + alphaIndex (babylon-constants), doc `design-system.md`.
2. **`terrain-extruder.ts`** : brancher par groupe. `bodyHeight = tileBodyHeight(tile.height)`.
   - **Non-liquide** → inchangé.
   - **Cas A** (`deep_water`, `lava`) → boîte opaque unique, `scaling.y = bodyHeight × 5/6`, centrée à `bodyHeight × 5/6 / 2`. Texture/side inchangés (top actuel + top assombri). Reste `tile_x_y` pickable.
   - **Cas B** (`water`, `swamp`) → **deux** boîtes, même parent, même XZ :
     - Fond sable opaque `tile_x_y` : `scaling.y = bodyHeight × 3/6`, centré à `bodyHeight × 3/6 / 2`. Textures `sable-top`/`sable-side`. **`isPickable = true`**, metadata `{tile:{x,y}}`.
     - Nappe eau translucide `liquid_surface_x_y` : `scaling.y = bodyHeight × 2/6`, centré à `bodyHeight × 4/6 / 2 + bodyHeight × 3/6 /2` (soit de 3/6 à 5/6, pas de chevauchement avec le fond → anti-z-fighting). **`isPickable = false`**. Matériau alpha-blend.
   - Étendre `createMaterialFactory` : + matériau **sable fond** + matériau **eau translucide** (`transparencyMode = MATERIAL_ALPHABLEND`, `alpha = BABYLON_LIQUID_WATER_ALPHA`, `disableDepthWrite = true`, `disableLighting = true`, `alphaIndex`, groupe 0). `dispose()` nettoie ces matériaux + textures.
   - **`ExtrudedTerrain.dispose()`** : `root.dispose(false, true)` couvre déjà les meshes enfants `liquid_surface_*` (même parent) ; vérifier que la factory dispose les nouveaux matériaux.
3. **Immersion sprites** (`combat-scene.ts`) : helper `standHeightAt(x, y, isAirborne)` → si tuile liquide **et** `!isAirborne` : `Y = bodyHeight × LIQUID_DEPTH_RATIO` ; sinon `tileTopCenter` plein. `isAirborne` = **détection réelle à confirmer à l'impl** (trait Volant/Lévitation, Vol Magnétik, `smackedDown`, Gravité — réutiliser la source existante du renderer pour flyers/glide, pas réinventer). Appliqué : placement initial, `positionOnTile`, endpoints de `tweenRootPosition`/glide.
   - **Ombre** : suit le Y du sprite (déjà enfant du billboard ?) → à vérifier ; masquage par le fond acceptable v1. Barre PV reste à la tête (non affectée).
4. **Highlights / curseur** : créés à `tileTopCenter` (hauteur pleine 6/6) → reposent **au-dessus** de la surface recessée (5/6) → a priori aucun changement. Ajuster seulement si occlusion visuelle constatée en human-testing.
5. **Tests** : pas de test unit renderer (Babylon = WebGL, pas headless en unit). **e2e** `scene-graph.spec.ts` sur `sandbox-flat` : présence `liquid_surface_*` (groupe 0, material transparent), non pickable ; sprite au sol sur tuile liquide à Y ≈ `bodyHeight × 3/6`. Cahier `docs/test-plan.md` §11.

## Cycle de vie des ressources

- `ExtrudedTerrain.dispose()` (changement de scène / replay / exit) nettoie `root` + tous les enfants (dont `liquid_surface_*`) + la factory (matériaux + textures liquides).
- Chaque `extrudeTerrain(scene, loaded)` → factory neuve → aucun matériau réutilisé d'une scène précédente.
- Resize (`ResizeObserver`) → aucun impact (meshes 3D non rescalés).

## Risques / points de vigilance

- **Tri transparence groupe 0 vs sprites (groupe 2) / silhouette (groupe 1)** : Babylon clear le depth entre groupes → l'eau (groupe 0) est **toujours** rendue avant les sprites → un sprite immergé n'est PAS occulté par l'eau (elle passe derrière). Acceptable v1 (eau translucide, sprite lu dedans) ; valider en human-testing.
- **Ombre + barre PV** : barre PV relative à la tête (OK) ; ombre au pied peut être masquée par le fond/eau (acceptable v1).
- **Clip dur du sprite** (couper net à la ligne d'eau) : NON en v1 — enfoncement + recouvrement translucide seulement. À réévaluer au vu du rendu.
- **`tile.height` liquide élevé** (empilement) : découpage en 6 sur le corps total → fond sable épais possible ; acceptable, à surveiller sur maps réelles.

## Hors périmètre v1 (draft initial)

Fresnel de bord, animation de surface (scroll UV / rides), écume de rivage, clip dur du sprite, texture de fond dédiée (autre que sable).

---

## Bilan (2026-07-21) — implémentation finale, reconciliée avec le draft

Le design a évolué en human-testing. Différences principales avec le draft ci-dessus :

### Modèle géométrique — l'eau profonde change de camp

Le draft rangeait `deep_water` dans le même « Cas A opaque » que `lava` (boîte pleine, pas de fond
visible). En pratique, l'eau profonde est rendue en **colonne translucide 0 → 5/6, sans fond** (on
voit "à travers" jusqu'à la nappe, mais aucun sable en dessous — elle se lit comme sans fond). La
lave, elle, reste dans le groupe **fond + nappe** comme l'eau/le marais (fond = roche en fusion,
`liquidFloorGroup`), mais avec une opacité de nappe très haute (`0.99`) pour lire quasi-opaque tout
en restant dans la passe transparente (sinon elle X-ray-silhouetterait un mon immergé — piège
identifié en risque #1 du draft, confirmé et évité).

Donc 3 cas réels, pas 2 :
- **Fond + nappe** (`water`, `swamp`, `lava`) : fond opaque 0→3/6 + nappe translucide 3/6→5/6.
- **Colonne sans fond** (`deep_water`) : translucide 0→5/6, aucun fond.
- Le reste du modèle (surface commune 5/6, cuvette 1/6) est inchangé du draft.

### Rendering group — divergence assumée du groupe 0 vers le groupe sprite (2)

Le draft prévoyait `renderingGroupId 0` pour « garder l'occlusion croisée sprite/terrain ». Le risque
#1 du draft anticipait correctement que Babylon clear le depth entre groupes et qu'un sprite immergé
ne serait pas occulté par une eau en groupe 0. La solution retenue en pratique est l'**inverse** de
l'hypothèse du draft : la nappe/colonne translucide est passée en **groupe sprite (2)**, avec un
`alphaIndex` dédié (`BABYLON_LIQUID_SURFACE_ALPHA_INDEX = 1`, sous l'écume `= 2`) — dessinée **après**
les billboards, donc un sprite immergé est vu à travers l'eau (résultat recherché), tout en restant
occulté par un vrai mur terrain (groupe 0) devant. Aucune régression sur la silhouette X-ray (qui ne
teste que le terrain groupe 0, pas la nappe).

Faces latérales intérieures entre deux tuiles liquides adjacentes cullées (matériau invisible dédié,
non prévu dans le draft) — évite l'effet « murs sous l'eau » d'un bassin multi-tuiles.

### Fond du draft confirmé

Constantes `LIQUID_SURFACE_RATIO`/`LIQUID_DEPTH_RATIO` (5/6, 3/6), ancrage des pieds au sol
(`LIQUID_DEPTH_RATIO`), Volant/Lévitation au sommet plein (`LIQUID_SURFACE_RATIO`) : tous confirmés
identiques au draft, aucune retouche après validation visuelle.

### Ajouts non prévus au draft (retour human-testing)

- **Écume de flottaison procédurale** (`shaders/water-foam-material.ts`) — le draft excluait
  explicitement toute « écume de rivage » du périmètre v1. Ajoutée après retour humain (l'immersion
  manquait de feedback visuel à la ligne de flottaison) : `ShaderMaterial` procédural, tri
  `gl_FragDepth`, teinte per-liquide, retirée à la sortie du liquide.
- **Anim d'entrée/sortie liquide** — nouveau `MovementVerticalMode` (`flat`/`step`/`jump`,
  `view-core/movement-animation.ts`). Le dip d'immersion produisait une glissade diagonale
  visuellement incorrecte avec l'ancien binaire Walk/Hop ; un demi-bloc (≤0.5, non-rampe, incluant le
  dip liquide) est désormais un **step** (marche) plutôt qu'un `Hop`. Effet de bord positif : corrige
  aussi le même artefact sur les demi-blocs de terrain solide (hors liquide).
- **Hauteur des tuiles liquides — `full` reste `height=1.0`** (`tileset.tsj`). Le « demi-bloc » ne
  concerne que le **calcul de hauteur (gameplay)**, pas le rendu : un mon s'enfonce à 3/6 = `0.5` via
  la submersion et son déplacement est lu comme un `step` (demi-bloc émergent). Un premier jet avait
  passé les `full` à `0.5`, ce qui écrasait le corps du liquide (`bodyHeight = max(0.5, tile.height) ×
  SCALE`) et réduisait les 6 tranches à un demi-bloc en creux — annulé (décision #697).

### Périmètre non traité (reporté, hors ce plan)

Fresnel de bord natif, scroll UV/rides sur la nappe, clip dur du sprite à la ligne d'eau, texture de
fond dédiée par liquide (au-delà de sable/roche) — inchangé du draft, toujours hors périmètre.

### Tests

Pas de test unit renderer (Babylon = WebGL). **e2e** `scene-graph.spec.ts` (`sandbox-flat`) : fond
`tile_4_2` (groupe 0, pickable) + nappe `liquid_surface_4_2` (groupe sprite 2, `transparent`).
Cahier `docs/test-plan.md` §3.14. Human-testing validé (transparence, cuvette, eau profonde sans
fond, immersion, écume, anim d'entrée/sortie).

### Décisions

Décisions #691–#697 (`docs/decisions.md`).
