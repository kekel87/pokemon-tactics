# Babylon — Asset lifecycle & disposal (mini-spec Jalon 1)

> Phase 5 (plan 119), Jalon 1. Stratégie de chargement et de libération des
> ressources Babylon pour éviter les fuites mémoire et les chargements inutiles.
> À relire avant tout code qui crée des meshes/textures/matériaux Babylon.

## Principe

Babylon ne libère **rien** automatiquement. Tout `Engine` / `Scene` / `Mesh` /
`Material` / `Texture` créé doit être `dispose()` explicitement, sinon fuite GPU.
Règle : **qui crée, dispose**. Chaque module renderer expose une méthode `dispose()`
qui libère ce qu'il a créé, dans l'ordre inverse de création.

## Hiérarchie de disposal

```
Engine.dispose()              ← libère tout le contexte WebGL (dernier recours)
└─ Scene.dispose()            ← libère meshes/materials/textures/lights de la scène
   ├─ DirectionalBillboard.dispose()  → material, texture, plane, root
   └─ ExtrudedTerrain.dispose()       → root.dispose(false, true) (récursif enfants)
```

`Scene.dispose()` libère en cascade tout ce qui est attaché à la scène. Mais on
garde des `dispose()` granulaires par module pour les cas où on retire **un seul**
objet sans détruire la scène (ex: un Pokemon KO retiré du terrain, changement de map).

## Chargement (load)

| Asset | Quand | Comment |
|-------|-------|---------|
| **Terrain** | À l'entrée en scène combat | `loadTiledMap(url)` (fetch + parse + validate) puis `extrudeTerrain`. 1 fois par combat. |
| **Sprites Pokemon** | À l'entrée en scène combat | **Seulement les Pokemon engagés** via `extractEngagedPokemonIds` (déjà utilisé côté Phaser). Pas les 80 du roster. |
| **Atlas (png+json)** | Lazy par sprite | `DirectionalBillboard.load()` fetch JSON + attend `texture.onLoadObservable`. |
| **Inspector** | Jamais en prod | `await import("@babylonjs/inspector")` dynamique, **dev only**. Doit être strippé du build prod au Jalon 5 (shim type + devDep). |

## Pooling (à décider Jalon 3)

Pour N Pokemon simultanés (jusqu'à 12) :
- **Textures partagées** : si 2 instances du même Pokemon, partager la texture atlas
  (1 `Texture` par atlasPngUrl, ref-comptée) plutôt que 2 uploads GPU.
- **Géométrie partagée** : le plane billboard est trivial (4 verts), pas besoin de
  pool de meshes. Chaque billboard a son plane.
- Décision Jalon 3 : implémenter un cache `Map<atlasUrl, Texture>` côté un
  `SpriteFactory` si le profiling montre un coût d'upload notable.

## Règles dures

1. Tout module qui crée des objets Babylon expose `dispose()`.
2. `dispose()` libère dans l'ordre inverse de création.
3. Détacher les listeners `window` (keydown/wheel/resize) dans `dispose()`.
4. Annuler les chargements async en vol (flag `loadCancelled`) pour ne pas
   manipuler une scène détruite après un `await`.
5. Inspector = dev only, jamais dans le bundle prod (vérifié au Jalon 5).

## État Jalon 1

- `DirectionalBillboard.dispose()` ✅ (material, texture, plane, root)
- `ExtrudedTerrain.dispose()` ✅ (`root.dispose(false, true)`)
- `createBabylonPreview().dispose()` ✅ (listeners + sprite + terrain + scene + engine, flag `loadCancelled`)
- Pooling : non implémenté (1 seul sprite en Jalon 1). À revoir Jalon 3.
