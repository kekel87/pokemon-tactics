# CLAUDE.md — Instructions pour Claude Code

## Contexte projet

Pokemon Tactics: jeu combat tactique (Pokemon x FFTA) en TypeScript + Phaser 4.
Monorepo pnpm workspaces. Core découplé du rendu. AI-playable.

## Rôle de l'humain

Humain **pas code**. Directeur créatif, architecte, reviewer.
Claude Code = **dev principal** — autonome implémentation, valide design avec humain.
Profil: dev web Angular/TS expérimenté, clean code advocate, expérience Godot + Phaser, temps limité.
**Continuité**: humain peut revenir après 1 mois. Maintenir STATUS.md, docs/plans/ et mémoire à jour pour reprendre sans friction.

## Documentation — quoi lire et quand

| Fichier | Quand le lire |
|---------|---------------|
| `STATUS.md` | **En premier** — reprise après pause ("on en était où ?") |
| `docs/game-design.md` | Avant implémenter mécanique jeu |
| `docs/architecture.md` | Avant créer fichier/package ou changer structure |
| `docs/decisions.md` | Hésitation sur choix (réponse peut-être déjà là) |
| `docs/roster-poc.md` | Pokemon et movesets prototype |
| `docs/reflexion-patterns-attaques.md` | Avant attribuer/implémenter pattern attaque |
| `docs/roadmap.md` | Quoi faire ensuite |
| `docs/references.md` | Comment problème résolu ailleurs |
| `docs/methodology.md` | Workflow travail |
| `docs/ai-system.md` | Avant modifier IA (scoring, profils, AiTeamController) |
| `docs/abilities-system.md` | Avant ajouter/modifier talent (hooks, émission `AbilityActivated`, tests) |
| `docs/design-system.md` | Avant ajouter/modifier couleurs, depths ou constantes visuelles renderer |
| `docs/isometric-height-rendering.md` | Avant toucher rendu isométrique avec hauteur, picking ou layers Tiled multi-niveaux |
| `docs/tileset-mapping.md` | Structure tileset ICON et propriétés tiles |
| `docs/references/babylon-gotchas.md` | Avant toucher renderer Babylon (plan 064+). Pièges GridMaterial, UV, depth, skipLibCheck, tree-shaking. |
| `docs/references/babylon-mcp-ecosystem.md` | État MCP Babylon (officiel + communautaires), avril 2026. |
| `docs/backlog.md` | Bugs connus + feedback playtest non traités |
| `docs/plans/` | Lire plan en cours avant coder. Anciens si besoin contexte. |

Pas tout charger d'un coup. Lire fichier pertinent moment pertinent.

## Principes de développement

- **Core découplé**: logique pure, zéro dépendance UI (détails dans `.claude/rules/core.md`)
- **Tests first**: chaque mécanique core a tests avant rendue visuellement
- **Petit et incrémental**: un changement = une chose
- **Pas de sur-ingénierie**: commencer simple, refactorer quand nécessaire
- **TypeScript strict**: `strict: true`, pas de `any` implicite, pas de `as` abusif

## Conventions

- **Commits**: conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) — **titre seul, jamais corps**. Humain colle que première ligne. Tout "pourquoi / détails / contexte reprise" va dans `STATUS.md` ou plan en cours (`docs/plans/xxx-*.md`), pas dans message.
- **Langue code**: anglais (variables, fonctions, types, commentaires)
- **Langue doc**: français
- **Linter/Formatter**: Biome (remplace ESLint + Prettier)
- **Plans**: `docs/plans/xxx-name.md` numérotés, statut en en-tête
- **Nommage**: pas d'abréviations (`traversalContext` pas `ctx`, `pokemonInstance` pas `pkmn`)
- **Écriture code**: préférer Edit à Write. Construire gros fichiers par petits Edit successifs, pas Write massif
- **Code mort**: zéro tolérance. Pas de fonctions/branches/imports inutilisés.

> Règles détaillées par package (core, renderer, data, tests) dans `.claude/rules/` — chargées auto selon fichiers touchés.
> Règles transversales (lint, conventions nommage): `.claude/rules/quality.md` — toujours applicables.
> **Lint**: jamais désactiver règle Biome sans accord explicite humain. Présenter options d'abord.

## Stack

- TypeScript strict, ESM modules
- Phaser 4 pour rendu
- Vitest pour tests unitaires
- Playwright pour tests visuels (agent `visual-tester`)
- chrome-devtools MCP pour debug runtime et perf (agents `debugger`, `performance-profiler`) — voir `docs/agent-orchestration.md` section "MCP navigateur"
- Vite pour bundling
- Biome pour linting/formatting
- pnpm workspaces pour monorepo

## Ce qu'il ne faut PAS faire

- Utiliser `any` sans justification
- Commiter assets non libres de droits
- Charger toute doc en contexte quand un seul fichier suffit
- **Git**: jamais commit/push/add — humain gère versioning. Lecture seule (status, diff, log). Bloqué par hook PreToolUse.
- **Infra**: jamais installer globalement ni modifier nvm/npm config. Bloqué par hook PreToolUse.
- **Changements structurels**: consulter humain AVANT modifier tsconfig, module resolution, structure dossiers, dépendances. Bug fixes simples pas besoin approbation
- **Mémoire Claude vs doc projet**: recherches, comparatifs, décisions, contexte technique vont dans doc projet (docs/plans/, docs/, decisions.md) — versionnée dans git, accessible partout. Mémoire Claude sert que pour préférences personnelles humain.

## Orchestration des agents

**Humain demande pas agent. Toi les lances quand nécessaire.** Besoin asset → `asset-manager`. Données Pokemon → `data-miner`. Tests → `test-writer`. Tu vois besoin, tu lances.

**Deux modes**:

1. **Auto sans demander** — majorité. Tu lances direct et synthétises résultat.
2. **Tu proposes avant lancer** — uniquement agents coûteux ou actions publiques:
   - `visual-tester` (Playwright long, ≥ 2 min)
   - `debugger` (opus coûteux)
   - `best-practices` (WebSearch/Fetch)
   - `balancer` (N combats headless)
   - `performance-profiler`
   - `publisher` (publie release GitHub)
   - `wiki-keeper` (modifie wiki public)

Détails par agent et table triggers: **`docs/agent-orchestration.md`**.

### Chaînes principales

- **Rédaction plan**: tu écris → `plan-reviewer` (auto) → `game-designer` (auto si mécaniques/équilibre) → tu présentes à humain.
- **Fin plan**: `core-guardian` (si core touché) → `code-reviewer` → `doc-keeper` → proposer `visual-tester` si renderer touché → gate CI → `commit-message`.
- **Hors plan**: `code-reviewer` (si significatif) → `doc-keeper` (si doc) → gate CI → `commit-message`.
- **Fin session**: `session-closer` → gate CI → `commit-message`.

### Règles de fond

- Jamais plus d'un agent long en foreground par turn — longs en background.
- Gate CI = `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`. **BLOQUANT** avant tout commit.
- **Reporté / skippé va dans `docs/next.md`** — agenda persistant que tu maintiens. Humain lit via `/next` pour rien oublier.

## Skills

| Commande | Action |
|----------|--------|
| `/next` | Prochaine étape + agenda (lit `docs/next.md` + STATUS + roadmap + plan en cours) |
| `/review-local` | Review code sur changements locaux |