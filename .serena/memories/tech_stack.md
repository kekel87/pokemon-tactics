# Stack technique

## Langages / runtime
- TypeScript strict ESM (`strict: true`, pas de `any` implicite, pas de `as` abusif)
- Node.js (via pnpm)

## Frameworks / libs
- **Phaser 4** — renderer 2D iso actuel (`packages/renderer/`)
- **Babylon.js** — renderer 2D-HD futur (`packages/renderer-babylon-spike/`, Phase 3.5 différée)
- **Vitest** — tests unitaires
- **Playwright** — tests visuels (via agent `visual-tester`)
- **Vite** — bundling
- **Biome** — linting + formatting (remplace ESLint + Prettier)

## Outils
- **pnpm workspaces** — monorepo
- **Tiled** — format de carte (`.tmj`)
- **PMDCollab** — source de sprites Pokemon (`pnpm extract-sprites`)
- **TexturePacker** — atlas (avec attention `invertY` pour UV Babylon)

## MCP servers
- `serena` — exploration code TS via LSP
- `understand-anything` — knowledge graph (`.understand-anything/knowledge-graph.json`, 1008 nodes)
- `chrome-devtools` — debug runtime / perf
- `playwright` — tests visuels
- `pixellab` — génération assets pixel-art
- `context7` — docs libs à jour
- `babylon-mcp` (immersiveidea) — recherche source/docs Babylon

## Format de données
- IDs en `kebab-case` (`leech-seed`, pas `leechSeed`)
- Reference data : `packages/data/reference/*.json`, **alignée Pokemon Champions** (pas Gen 9 classique)
- Statuts Champions : paralysie 12.5%, gel 25%/3t, sommeil sample([2,3,3])
- Régénérer reference via `pnpm data:update` (jamais éditer à la main)
