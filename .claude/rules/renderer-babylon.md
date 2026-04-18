---
globs: packages/renderer-babylon*/**, packages/renderer-babylon-spike/**
---

# Règles renderer Babylon.js

À activer au plan 064 (rewrite renderer). Pour l'instant s'applique à `packages/renderer-babylon-spike/`.

**Toujours lire `docs/references/babylon-gotchas.md` avant de toucher au rendu 3D.**

## Imports

- **Deep imports obligatoires** : `import { Vector3 } from "@babylonjs/core/Maths/math.vector"` — jamais `import { Vector3 } from "@babylonjs/core"` (casse le tree-shaking, +100 kB bundle)
- Inspector (`@babylonjs/inspector`) : **devDep uniquement**, chargement dynamique (`await import(...)`) en dev seulement

## Matériaux

- `GridMaterial` sur un `CreateBox({ size: 1 })` → toujours `gridOffset = new Vector3(0.5, 0, 0.5)` pour aligner aux arêtes (shader local-space)
- Sprites pixel-art : `alphaCutOff = 0.5` + `transparencyMode = 1` (ALPHATEST) — sinon pas de depth write, plus d'occlusion
- Textures pixel-art : `Texture.NEAREST_SAMPLINGMODE`, pas de mipmap
- Éviter PBR et lumières directionnelles → préférer un `ShaderMaterial` flat-shaded (style FFTA, cohérence pixel-art)

## UV atlas TexturePacker

Avec `invertY` défaut activé, calculer les UV dans le repère flipé :
```
vOffset = 1 - (y + h) / atlasHeight
```

## Rendu

- `renderingGroupId = 0` par défaut pour tous les meshes qui doivent s'occluder mutuellement (un groupId différent clear le depth buffer)
- `hardwareScalingLevel = 1` (résolution native) — ne jamais downsample globalement pour faire du pixel-art
- Pixel-art = assets pixel + NEAREST, pas de ruse renderer

## Couleurs / design system

Mêmes règles que le renderer Phaser actuel :
- Pas de hex inline → tout dans un `constants.ts`
- Depths préfixées `DEPTH_`
- Documenter dans `docs/design-system.md` les nouvelles constantes visuelles

## Core

- Importer le core via `@pokemon-tactic/core` — jamais de chemin relatif vers `packages/core`
- Le renderer reste passif : il observe l'état du core, ne le mute pas

## MCP

- `babylon-mcp` (immersiveidea) disponible dans `.mcp.json` pour `search_babylon_source` / `search_babylon_docs` — productif quand un shader ou matériau se comporte bizarrement
- Voir `docs/references/babylon-mcp-ecosystem.md` pour l'écosystème MCP Babylon (officiel à venir, communautaires)
