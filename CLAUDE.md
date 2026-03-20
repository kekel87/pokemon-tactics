# CLAUDE.md — Instructions pour Claude Code

## Contexte projet

Pokemon Tactics : jeu de combat tactique (Pokemon x FFT) en TypeScript + Phaser 4.
Monorepo pnpm workspaces. Core découplé du rendu. AI-playable.

## Documentation — quoi lire et quand

| Fichier | Quand le lire |
|---------|---------------|
| `docs/game-design.md` | Avant d'implémenter une mécanique de jeu |
| `docs/architecture.md` | Avant de créer un nouveau fichier/package ou changer la structure |
| `docs/decisions.md` | Quand on hésite sur un choix (la réponse est peut-être déjà là) |
| `docs/roadmap.md` | Pour savoir quoi faire ensuite |
| `docs/references.md` | Quand on cherche comment un problème a été résolu ailleurs |
| `docs/methodology.md` | Pour le workflow de travail |
| `plans/` | Lire le plan en cours avant de coder. Consulter les anciens si besoin de contexte. |

Ne pas tout charger d'un coup. Lire le fichier pertinent au moment pertinent.

## Principes de développement

- **Core découplé** : `packages/core` n'a AUCUNE dépendance UI/rendu. Logique pure uniquement.
- **Tests first** : chaque mécanique du core a des tests avant d'être rendue visuellement.
- **Petit et incrémental** : un changement = une chose.
- **Pas de sur-ingénierie** : commencer simple, refactorer quand nécessaire.
- **TypeScript strict** : `strict: true`, pas de `any` implicite, pas de `as` abusif.

## Conventions

- **Commits** : conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- **Langue du code** : anglais (variables, fonctions, types, commentaires)
- **Langue de la doc** : français
- **Imports** : path aliases `@pokemon-tactic/core`, `@pokemon-tactic/renderer`, etc.
- **Tests** : `.test.ts` à côté du fichier testé
- **Linter/Formatter** : Biome (remplace ESLint + Prettier)
- **Plans** : `plans/xxx-name.md` numérotés, avec statut en en-tête

## Stack

- TypeScript strict, ESM modules
- Phaser 4 pour le rendu
- Vitest pour les tests unitaires
- Playwright pour les tests visuels
- Vite pour le bundling
- Biome pour le linting/formatting
- pnpm workspaces pour le monorepo

## Ce qu'il ne faut PAS faire

- Ajouter des dépendances UI/Phaser dans `packages/core`
- Utiliser `any` sans justification
- Commiter des assets non libres de droits
- Pousser sur `main` sans que les tests passent
- Charger toute la doc en contexte quand un seul fichier suffit
