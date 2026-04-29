---
globs: packages/renderer-babylon*/**, packages/renderer-babylon-spike/**
---

# Règles renderer Babylon.js

Plan 064 (rewrite renderer). Applique à `packages/renderer-babylon-spike/`.

**Lire `docs/references/babylon-gotchas.md` avant de toucher au rendu 3D.**

## Imports

- **Deep imports obligatoires** : `import { Vector3 } from "@babylonjs/core/Maths/math.vector"` — jamais `import { Vector3 } from "@babylonjs/core"` (casse tree-shaking, +100 kB bundle)
- Inspector (`@babylonjs/inspector`) : **devDep uniquement**, chargement dynamique (`await import(...)`) en dev seulement

## Matériaux

- `GridMaterial` sur `CreateBox({ size: 1 })` → toujours `gridOffset = new Vector3(0.5, 0, 0.5)` pour aligner aux arêtes (shader local-space)
- Sprites pixel-art : `alphaCutOff = 0.5` + `transparencyMode = 1` (ALPHATEST) — sinon pas de depth write, plus d'occlusion
- Textures pixel-art : `Texture.NEAREST_SAMPLINGMODE`, pas de mipmap
- Éviter PBR et lumières directionnelles → `ShaderMaterial` flat-shaded (style FFTA, cohérence pixel-art)

## UV atlas TexturePacker

Avec `invertY` défaut activé, calculer UV dans repère flipé :
```
vOffset = 1 - (y + h) / atlasHeight
```

## Rendu

- `renderingGroupId = 0` par défaut — groupId différent clear le depth buffer
- `hardwareScalingLevel = 1` (résolution native) — jamais downsample pour pixel-art
- Pixel-art = assets pixel + NEAREST, pas de ruse renderer

## Couleurs / design system

- Pas de hex inline → tout dans `constants.ts`
- Depths préfixées `DEPTH_`
- Documenter nouvelles constantes visuelles dans `docs/design-system.md`

## Core

- Importer core via `@pokemon-tactic/core` — jamais chemin relatif vers `packages/core`
- Renderer passif : observe état du core, ne mute pas

## MCP

- `babylon-mcp` (immersiveidea) dans `.mcp.json` pour `search_babylon_source` / `search_babylon_docs` — utile quand shader/matériau se comporte bizarrement
- Voir `docs/references/babylon-mcp-ecosystem.md` pour écosystème MCP Babylon
