---
status: done
created: 2026-03-20
updated: 2026-03-20
---

# Plan 001 — Setup monorepo

## Objectif

Mettre en place la structure monorepo complète (pnpm workspaces, TypeScript strict, Vite, Vitest, Biome) avec les packages `core`, `renderer` et `data` vides mais fonctionnels, afin que toutes les sessions suivantes aient un environnement de développement opérationnel.

## Contexte

Le projet est en Phase 0 (POC). Toute la documentation est rédigée et les décisions d'architecture sont prises. Aucun code n'existe encore. Cette session pose les fondations techniques sur lesquelles toutes les mécaniques de jeu seront construites. Le plan 002 pourra immédiatement commencer à coder les modèles core.

## Étapes

- [x] Étape 1 — Initialiser la racine du workspace
  - Créer `package.json` racine avec `"private": true` et les scripts `dev`, `build`, `test`, `lint`
  - Créer `pnpm-workspace.yaml` déclarant `packages/*`
  - Créer `.gitignore` (node_modules, dist, .vite, coverage)
  - Créer `.npmrc` avec `shamefully-hoist=false` et `strict-peer-dependencies=false`

- [x] Étape 2 — Configurer TypeScript
  - Créer `tsconfig.base.json` à la racine avec `strict: true`, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `esModuleInterop: true`
  - Définir les path aliases : `@pokemon-tactic/core`, `@pokemon-tactic/renderer`, `@pokemon-tactic/data`
  - Chaque package héritera de ce `tsconfig.base.json`

- [x] Étape 3 — Configurer Biome
  - Créer `biome.json` à la racine
  - Activer les règles : format (2 espaces, double quotes), lint (recommended + a11y désactivé)
  - Ajouter le script `lint` dans `package.json` racine : `biome check --apply .`
  - Vérifier que `biome check .` passe sur un fichier TypeScript vide

- [x] Étape 4 — Créer `packages/core`
  - Créer `packages/core/package.json` : nom `@pokemon-tactic/core`, `type: module`, zero dépendance UI
  - Créer `packages/core/tsconfig.json` héritant de `../../tsconfig.base.json`
  - Créer `packages/core/src/index.ts` vide (export placeholder commenté)
  - Créer `packages/core/src/models/` (dossier vide avec `.gitkeep`)
  - Créer `packages/core/src/battle/` (dossier vide avec `.gitkeep`)
  - Créer `packages/core/src/grid/` (dossier vide avec `.gitkeep`)
  - Vérifier que `tsc --noEmit` passe dans ce package

- [x] Étape 5 — Créer `packages/data`
  - Créer `packages/data/package.json` : nom `@pokemon-tactic/data`, `type: module`
  - Créer `packages/data/tsconfig.json` héritant de `../../tsconfig.base.json`
  - Créer la structure de dossiers : `base/`, `overrides/`
  - Créer `packages/data/base/pokemon.ts` avec un type `BasePokemon` minimal et un export vide `[]`
  - Créer `packages/data/base/moves.ts` avec un type `BaseMove` minimal et un export vide `[]`
  - Créer `packages/data/base/type-chart.ts` avec un export vide
  - Créer `packages/data/overrides/tactical.ts` et `overrides/balance-v1.ts` vides
  - Créer `packages/data/src/index.ts` qui ré-exporte tout
  - Vérifier que `tsc --noEmit` passe dans ce package

- [x] Étape 6 — Créer `packages/renderer`
  - Créer `packages/renderer/package.json` : nom `@pokemon-tactic/renderer`, dépendance sur `phaser@4` et `@pokemon-tactic/core`
  - Créer `packages/renderer/tsconfig.json` héritant de `../../tsconfig.base.json`
  - Créer `packages/renderer/src/main.ts` avec un commentaire placeholder (pas de code Phaser encore)
  - Créer `packages/renderer/public/` (dossier pour les assets)
  - Créer `packages/renderer/vite.config.ts` avec resolve des path aliases et plugin TypeScript
  - Créer `packages/renderer/index.html` minimal pointant vers `src/main.ts`
  - Vérifier que `vite build` passe dans ce package

- [x] Étape 7 — Configurer Vitest
  - Créer `vitest.config.ts` à la racine avec `include: ['packages/*/src/**/*.test.ts']`
  - Créer un test de smoke dans `packages/core/src/index.test.ts` : `expect(true).toBe(true)`
  - Vérifier que `pnpm test` passe depuis la racine

- [x] Étape 8 — Scripts racine et vérification finale
  - Ajouter dans `package.json` racine :
    - `"dev": "pnpm --filter @pokemon-tactic/renderer dev"`
    - `"build": "pnpm -r build"`
    - `"test": "vitest run"`
    - `"lint": "biome check ."`
  - Vérifier que `pnpm install` installe tout sans erreur
  - Vérifier que `pnpm test` passe
  - Vérifier que `pnpm lint` passe
  - Vérifier que `pnpm build` passe (renderer)
  - Vérifier que les path aliases sont résolus correctement entre packages

## Critères de complétion

- `pnpm install` : aucune erreur
- `pnpm test` : le test de smoke passe
- `pnpm lint` : aucune erreur Biome
- `pnpm build` : le renderer compile sans erreur
- `packages/core` n'a aucune dépendance vers Phaser ou tout autre package UI (vérifiable dans son `package.json`)
- Les path aliases `@pokemon-tactic/core` et `@pokemon-tactic/data` sont résolvables depuis `packages/renderer`
- La structure de dossiers correspond exactement à `docs/architecture.md` section 3

## Risques / Questions

- Phaser 4 est encore en beta/RC : vérifier la version disponible sur npm avant de la déclarer en dépendance. Utiliser `phaser@next` si la v4 stable n'est pas publiée.
- `moduleResolution: NodeNext` avec pnpm workspaces peut nécessiter d'ajouter `"exports"` dans chaque `package.json`. À tester à l'étape 4.
- Les path aliases TypeScript (`@pokemon-tactic/*`) doivent être déclarés à la fois dans `tsconfig.json` ET dans `vite.config.ts` pour que Vite les résolve. Ne pas oublier la config Vite.
- Biome peut avoir des conflits de version avec certaines versions de Node.js. Vérifier la compatibilité.

## Dépendances

- **Avant ce plan** : aucune (c'est le premier plan, aucun code n'existe)
- **Ce plan débloque** : Plan 002 (modèles core : Pokemon, Move, Grid, BattleState)
