# CLAUDE.md

## Projet

Pokemon Tactics : combat tactique (Pokemon × FFTA), TypeScript + Phaser 4, monorepo pnpm. Core découplé du rendu. AI-playable.

## Humain

**Pas code**. Directeur créatif, architecte, reviewer. Dev web Angular/TS expérimenté, clean code, Godot+Phaser, temps limité.
Continuité : peut revenir après 1 mois → maintenir STATUS.md, `docs/plans/`, mémoire à jour.

Claude = dev principal, autonome implémentation, valide design avec humain.

## Docs — quoi lire quand

| Fichier | Trigger |
|---------|---------|
| `STATUS.md` | **Reprise** ("on en était où ?") |
| `docs/game-design.md` | Avant mécanique jeu |
| `docs/architecture.md` | Avant créer fichier/package, changer structure |
| `docs/decisions.md` | Hésitation sur choix |
| `docs/roster-poc.md` | Pokemon + movesets prototype |
| `docs/reflexion-patterns-attaques.md` | Avant pattern attaque |
| `docs/roadmap.md` | Quoi faire ensuite |
| `docs/references.md` | Comment résolu ailleurs |
| `docs/methodology.md` | Workflow |
| `docs/ai-system.md` | Avant modifier IA |
| `docs/abilities-system.md` | Avant ajouter/modifier talent |
| `docs/design-system.md` | Avant couleurs/depths/constantes visuelles |
| `docs/isometric-height-rendering.md` | Avant rendu iso hauteur/picking/layers multi-niveaux |
| `docs/tileset-mapping.md` | Tileset ICON, propriétés tiles |
| `docs/references/babylon-gotchas.md` | Avant renderer Babylon |
| `docs/references/babylon-mcp-ecosystem.md` | État MCP Babylon |
| `docs/backlog.md` | Bugs + feedback playtest non traités |
| `docs/implementations.md` | Liste Pokemon/Moves/Abilities/Items implémentés |
| `docs/plans/` | Plan en cours avant coder |
| `docs/next.md` | Agenda persistant (`/next`) |

Pas tout charger. Lire fichier pertinent moment pertinent.

## Exploration code TS

**Serena prioritaire sur Read/Grep/Edit** pour `.ts` (LSP, plus token-efficient).
Charger via `ToolSearch select:mcp__serena__*`. Appeler `initial_instructions` au démarrage.

U-A graph (`.understand-anything/knowledge-graph.json`, 1008 nodes, auto-update post-commit) pour questions architecture → `/understand-chat`.

## Principes

- **Core découplé** : zéro dep UI (détails `.claude/rules/core.md`)
- **Tests first** : mécanique core → tests avant visuel
- **Petit, incrémental** : 1 changement = 1 chose
- **TypeScript strict** : pas de `any` implicite, pas de `as` abusif
- **Pas de sur-ingénierie** : commencer simple

## Conventions

- **Commits** : conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) — **titre seul, jamais corps**. Détails → STATUS.md ou plan
- **Langue** : code anglais, doc français
- **Linter** : Biome
- **Plans** : `docs/plans/xxx-name.md` numérotés, statut en en-tête
- **Nommage** : pas d'abréviations (`traversalContext` pas `ctx`)
- **Écriture code** : Edit > Write. Petits Edit successifs, pas Write massif
- **Code mort** : zéro tolérance
- **Lint** : jamais désactiver règle Biome sans accord humain. Présenter options d'abord

Règles détaillées par package : `.claude/rules/*.md` (chargées via frontmatter `paths:` selon fichier touché).

## Stack

TypeScript strict ESM · Phaser 4 · Vitest · Playwright (`visual-tester`) · chrome-devtools MCP (`debugger`, `performance-profiler`) · Vite · Biome · pnpm workspaces.

## Interdits

- `any` sans justification
- Commiter assets non libres de droits
- Charger toute doc en contexte quand 1 fichier suffit
- **Git** : commit/push/add interdit. Lecture seule (`status`, `diff`, `log`). Bloqué par hook
- **Infra** : install global, modif nvm/npm config interdit. Bloqué par hook
- **Structurel** : consulter humain AVANT modifier tsconfig, module resolution, structure, dépendances. Bug fix simple OK
- **Mémoire vs doc** : recherches/décisions/contexte → doc projet (git), pas mémoire Claude. Mémoire = préférences perso humain seulement

## Agents

**Tu lances, humain demande pas.** Besoin asset → `asset-manager`. Données → `data-miner`. Tests → `test-writer`.

**Auto sans demander** : majorité. **Proposer avant** : `visual-tester` (Playwright ≥2 min), `debugger` (opus), `best-practices` (Web*), `balancer`, `performance-profiler`, `publisher`, `wiki-keeper`.

Détails : `docs/agent-orchestration.md`.

### Chaînes

- **Plan rédaction** : tu écris → `plan-reviewer` → `game-designer` (si mécaniques) → humain
- **Plan fin** : `core-guardian` (si core) → `code-reviewer` → `doc-keeper` → propose `visual-tester` (si renderer) → gate CI → `commit-message`
- **Hors plan** : `code-reviewer` (si significatif) → `doc-keeper` (si doc) → gate CI → `commit-message`
- **Session fin** : `session-closer` → gate CI → `commit-message`

### Règles fond

- Jamais > 1 agent long en foreground/turn — longs en background
- Gate CI = `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`. **BLOQUANT** avant commit
- Reporté → `docs/next.md`

## Skills

| Cmd | Action |
|-----|--------|
| `/next` | Prochaine étape (lit `docs/next.md` + STATUS + roadmap + plan) |
| `/review-local` | Review code changements locaux |
