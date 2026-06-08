# Babylon — Densité pixel sprites, ancrage au sol & projection overlay

> Phase 5. Comment dimensionner les sprites et tout élément 2D futur (curseur,
> icônes, badges, textes flottants) pour une grille de pixels cohérente, et comment
> les ancrer correctement au terrain et à l'overlay DOM.

## Valeur validée (2026-06-08)

**Sprites Pokemon : `pixelsPerWorldUnit = 24`** — soit **la même densité que les
textures de terrain (24px/unité)** → pixel parity ≈ **1:1**. C'est le look validé
à l'œil par le directeur créatif. Cf. `SPRITE_PIXELS_PER_UNIT` dans `babylon-preview.ts`.

Conséquence : les gros Pokemon (Onix, Léviator) rendent gros, les petits petits —
c'est correct (un sprite PMD est dessiné à la densité de la tile PMD).

## ⚠️ Historique — le facteur ×2 fantôme (corrigé)

Au Jalon 1, une analyse a conclu à tort que les sprites devaient être à **0.5×**
(48px/u) en « compensation du foreshortening du sol ». C'était un **artefact** :
`DirectionalBillboard` créait son plane en `2×2` (`baseScale = scale ?? 2`, hérité
du spike) PUIS multipliait par `scaling`. Toutes les mesures pixel calculaient
`h / pixelsPerWorldUnit` (le scaling) **en ignorant ce plane 2×2** → le rendu réel
était **2× la valeur affichée**. L'indicateur disait « 0.5× / 48px/u » mais le sol
voyait du **24px/u = 1:1**.

Le cleanup a retiré le `baseScale` (plane = unité 1×1), exposant le facteur. Valeur
réelle remise à **24px/u**. **La théorie « 0.5× = sin(élévation) » ne tient pas** :
elle expliquait un nombre corrompu. Le look validé est bien **1:1**.

## Principe encore valable pour les éléments 2D futurs

Le sol 3D est un plan incliné (foreshortening) ; un billboard vertical ne l'est
pas. Donc l'apparence d'un texel de sol diffère d'un texel de billboard, MÊME à
densité source égale. À l'usage, l'œil accepte une densité source identique (1:1)
pour les sprites — pattern 2D-HD classique (le sprite est dessiné à la taille
pixel de la tile). Pour de futurs éléments :

| Type | Plan | Densité |
|------|------|---------|
| Posé à plat sur le sol (highlight tile, zone AoE, ombre, curseur-case) | suit le sol | partage la grille du sol d'office |
| Billboard vertical (sprite, icône flottante, badge, texte combat) | droit | **24px/u** (même densité source que le sol) |

Ne PAS réintroduire un facteur 0.5 « magique ». Si un jour le rendu paraît
incohérent, mesurer proprement (sans base-plane fantôme) avant d'ajouter un facteur.

## Dépend de l'angle caméra

Le ressenti dépend de l'élévation iso (`atan(1/√2) ≈ 35.26°`). Si on change l'angle,
re-juger la densité sprite à l'œil sur du rendu propre (plane unité).

---

## Modèle d'ancrage sprite au sol (décisions #440, #441)

### Source de vérité : marqueurs PMD dans `offsets.json`

`scripts/extract-sprites.ts` lit les marqueurs de pixels du sprite PMDCollab :

| Couleur | Signification | Formule |
|---------|---------------|---------|
| NOIR | Tête du Pokemon | `headOffsetY = headY - centerY` (pixels, relatif au centre du frame) |
| VERT | Centre du corps | `bodyOffsetY = bodyY - centerY` |
| BLANC | Point de sol | toujours à `centerY + 4` → `footOffsetY = 4` (constant tous sprites) |

### Logique d'ancrage (identique à Phaser)

En Phaser (`PokemonSprite.updatePosition`), l'**origine (0.5, 0.5)** du frame (= centre du frame) est posée sur le centre de la face haute de la tile (`gridToScreen`) plus un offset constant `POKEMON_SPRITE_GROUND_OFFSET_Y = -2` px. En d'autres termes : **le centre du frame est sur la tile, pas les pieds**.

Babylon reproduit exactement cela : `plane.position.y = footOffsetY / pixelsPerWorldUnit`. Comme `footOffsetY = 4` (constant), c'est effectivement un lift constant — mais data-sourcé depuis `offsets.json`. La constante `BABYLON_SPRITE_GROUND_OFFSET_PX = 5` sert de fallback avant le chargement du JSON.

Puisque `renderingGroupId = 1`, la moitié inférieure du frame qui chevauche la tile par le bas n'est pas clippée par le terrain — comportement cohérent avec le 2.5D de Phaser.

### Méthodes rejetées

- **Ancrage sur `bodyOffsetY`** : soulève les Pokemon à corps long (Onix, Léviator) qui flottent.
- **Lift d'1 unité pour "poser les pieds"** : première tentative de correction ; aggravait le flottement au lieu de le corriger.

### Ancre HUD (barre PV)

`plane.position.y + headOffsetY / pixelsPerWorldUnit + BABYLON_HUD_ANCHOR_MARGIN_PX / pixelsPerWorldUnit`

La marge `BABYLON_HUD_ANCHOR_MARGIN_PX = 20` mirore `uiOffsetY = headOffsetY * scale - 16` de Phaser (décision #441).

---

## Helper projection monde→écran (Jalon 2a, décision #442)

`world-projection.ts` expose `projectAnchors(scene, camera, anchors, cssWidth, cssHeight)`.

### Points clés d'implémentation

```
Vector3.ProjectToRef(
  worldPos,
  Matrix.Identity(),       // world matrix = Identity (les positions sont déjà en world-space)
  scene.getTransformMatrix(),
  camera.viewport.toGlobal(cssW, cssH),
  screenPos
)
```

**⚠️ Gotcha** : le 2ᵉ argument doit être `Matrix.Identity()`, **pas** `camera.getWorldMatrix()` — utiliser la world matrix de la caméra collapse tous les points vers l'origine de la caméra.

### Viewport CSS vs backing-store

Toujours passer `cssWidth`/`cssHeight` issus de `canvas.clientWidth`/`clientHeight` (taille CSS logique), **jamais** `canvas.width`/`canvas.height` (taille backing-store). Les deux diffèrent quand `hardwareScalingLevel ≠ 1`. Si on projette sur la taille backing-store, les éléments DOM sont décalés par un facteur `hardwareScalingLevel`.

### Pattern read→write sans layout thrash

```typescript
// 1. Lire toutes les positions projetées (pas de lecture DOM)
const projected = anchors.map(anchor => project(anchor.worldPos));
// 2. Écrire tous les transforms d'un coup
for (const [i, el] of elements.entries()) {
  el.style.transform = `translate(${projected[i].x}px, ${projected[i].y}px)`;
}
```

Pixel-snap via `Math.round` sur x et y. Visibilité : si `z < 0 || z > 1` (hors frustum), `display: none`.
