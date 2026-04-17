# CLAUDE.md — Instructions pour Claude Code

## Contexte projet

Pokemon Tactics : jeu de combat tactique (Pokemon x FFTA) en TypeScript + Phaser 4.
Monorepo pnpm workspaces. Core découplé du rendu. AI-playable.

## Rôle de l'humain

L'humain **ne code pas**. Il est directeur créatif, architecte et reviewer.
Claude Code est le **développeur principal** — autonome sur l'implémentation, mais valide les choix de design avec l'humain.
Profil : dev web Angular/TS expérimenté, clean code advocate, expérience Godot + Phaser, temps limité.
**Continuité** : l'humain peut revenir après 1 mois. Maintenir STATUS.md, docs/plans/ et la mémoire à jour pour reprendre sans friction.

## Documentation — quoi lire et quand

| Fichier | Quand le lire |
|---------|---------------|
| `STATUS.md` | **En premier** — quand on reprend le projet après une pause ("on en était où ?") |
| `docs/game-design.md` | Avant d'implémenter une mécanique de jeu |
| `docs/architecture.md` | Avant de créer un nouveau fichier/package ou changer la structure |
| `docs/decisions.md` | Quand on hésite sur un choix (la réponse est peut-être déjà là) |
| `docs/roster-poc.md` | Pour les Pokemon et movesets du prototype |
| `docs/reflexion-patterns-attaques.md` | Avant d'attribuer ou implémenter un pattern d'attaque |
| `docs/roadmap.md` | Pour savoir quoi faire ensuite |
| `docs/references.md` | Quand on cherche comment un problème a été résolu ailleurs |
| `docs/methodology.md` | Pour le workflow de travail |
| `docs/ai-system.md` | Avant de modifier l'IA (scoring, profils, AiTeamController) |
| `docs/design-system.md` | Avant d'ajouter ou modifier des couleurs, depths ou constantes visuelles dans le renderer |
| `docs/isometric-height-rendering.md` | Avant de toucher au rendu isométrique avec hauteur, au picking ou aux layers Tiled multi-niveaux |
| `docs/tileset-mapping.md` | Pour comprendre la structure du tileset ICON et les propriétés des tiles |
| `docs/backlog.md` | Bugs connus et feedback playtest non traités |
| `docs/plans/` | Lire le plan en cours avant de coder. Consulter les anciens si besoin de contexte. |

Ne pas tout charger d'un coup. Lire le fichier pertinent au moment pertinent.

## Principes de développement

- **Core découplé** : logique pure, zéro dépendance UI (détails dans `.claude/rules/core.md`)
- **Tests first** : chaque mécanique du core a des tests avant d'être rendue visuellement
- **Petit et incrémental** : un changement = une chose
- **Pas de sur-ingénierie** : commencer simple, refactorer quand nécessaire
- **TypeScript strict** : `strict: true`, pas de `any` implicite, pas de `as` abusif

## Conventions

- **Commits** : conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) — **titre seul, jamais de corps**. L'humain ne colle que la première ligne. Tout "pourquoi / détails / contexte de reprise" va dans `STATUS.md` ou le plan en cours (`docs/plans/xxx-*.md`), pas dans le message.
- **Langue du code** : anglais (variables, fonctions, types, commentaires)
- **Langue de la doc** : français
- **Linter/Formatter** : Biome (remplace ESLint + Prettier)
- **Plans** : `docs/plans/xxx-name.md` numérotés, avec statut en en-tête
- **Nommage** : pas d'abréviations (`traversalContext` pas `ctx`, `pokemonInstance` pas `pkmn`)
- **Écriture de code** : préférer Edit à Write. Construire les gros fichiers par petits Edit successifs, pas un Write massif
- **Code mort** : zéro tolérance. Pas de fonctions/branches/imports inutilisés.

> Les règles détaillées par package (core, renderer, data, tests) sont dans `.claude/rules/` — chargées automatiquement selon les fichiers touchés.

## Stack

- TypeScript strict, ESM modules
- Phaser 4 pour le rendu
- Vitest pour les tests unitaires
- Playwright pour les tests visuels
- Vite pour le bundling
- Biome pour le linting/formatting
- pnpm workspaces pour le monorepo

## Ce qu'il ne faut PAS faire

- Utiliser `any` sans justification
- Commiter des assets non libres de droits
- Charger toute la doc en contexte quand un seul fichier suffit
- **Git** : ne jamais commit/push/add — l'humain gère le versioning. Lecture seule (status, diff, log). Bloqué par hook PreToolUse.
- **Infra** : ne jamais installer globalement ni modifier nvm/npm config. Bloqué par hook PreToolUse.
- **Changements structurels** : consulter l'humain AVANT de modifier tsconfig, module resolution, structure de dossiers, dépendances. Les bug fixes simples n'ont pas besoin d'approbation
- **Mémoire Claude vs doc projet** : les recherches, comparatifs, décisions et contexte technique vont dans la doc du projet (docs/plans/, docs/, decisions.md) — versionnée dans git, accessible partout. La mémoire Claude ne sert que pour les préférences personnelles de l'humain.

## Orchestration des agents

**L'humain ne demande pas d'agent. C'est toi qui les lances quand nécessaire.** Si tu as besoin d'un asset → `asset-manager`. De données Pokemon → `data-miner`. De tests → `test-writer`. Tu vois le besoin, tu lances.

**Deux modes** :

1. **Auto sans demander** — la majorité. Tu lances direct et tu synthétises le résultat.
2. **Tu proposes avant de lancer** — uniquement pour les agents coûteux ou aux actions publiques :
   - `visual-tester` (Playwright long, ≥ 2 min)
   - `debugger` (opus coûteux)
   - `best-practices` (WebSearch/Fetch)
   - `balancer` (N combats headless)
   - `performance-profiler`
   - `publisher` (publie une release GitHub)
   - `wiki-keeper` (modifie le wiki public)

Détails par agent et table de triggers : **`docs/agent-orchestration.md`**.

### Chaînes principales

- **Rédaction d'un plan** : tu écris → `plan-reviewer` (auto) → `game-designer` (auto si mécaniques/équilibre) → tu présentes à l'humain.
- **Fin d'un plan** : `core-guardian` (si core touché) → `code-reviewer` → `doc-keeper` → proposer `visual-tester` si renderer touché → gate CI → `commit-message`.
- **Hors plan** : `code-reviewer` (si significatif) → `doc-keeper` (si doc) → gate CI → `commit-message`.
- **Fin de session** : `session-closer` → gate CI → `commit-message`.

### Règles de fond

- Jamais plus d'un agent long en foreground par turn — les longs en background.
- Gate CI = `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`. **BLOQUANT** avant tout commit.
- **Ce qui est reporté / skippé va dans `docs/next.md`** — agenda persistant que tu maintiens. L'humain le lit via `/next` pour ne rien oublier.

## Skills

| Commande | Action |
|----------|--------|
| `/next` | Prochaine étape + agenda (lit `docs/next.md` + STATUS + roadmap + plan en cours) |
| `/review-local` | Review de code sur les changements locaux |
