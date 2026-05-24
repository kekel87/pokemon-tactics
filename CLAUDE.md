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
| `docs/backlog.md` | Bugs + feedback playtest non traités (actifs uniquement) |
| `docs/backlog-archive.md` | Items backlog résolus (rare ; audit régression ou contexte fix passé) |
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

### Après impl — règle OBLIGATOIRE

**Dès que tu finis d'implémenter** (build OK, code écrit, tests passent), AVANT de dire "fait" / "terminé" / proposer la suite, tu DOIS :

1. Exécuter `git status --porcelain` pour confirmer fichiers modifiés.
2. Appeler `AskUserQuestion` avec un menu multi-select des étapes de chaîne, pré-cochées selon contexte.
3. Attendre la sélection humain. Exécuter en ordre fixe. Stop sur fail bloquant.

**Pas optionnel. Pas négociable.** Même si tu penses "le changement est petit". Même si tu as confiance. L'humain coche/décoche.

#### Format du menu (AskUserQuestion, multiSelect=true)

Question : `"Impl terminée. Étapes à lancer ?"`

Options (cocher pré-sélection selon règles ci-dessous) :

| Option | Pré-coché si |
|--------|--------------|
| `core-guardian` | `git diff --name-only HEAD` matche `packages/core/` |
| `code-reviewer` | >50 lignes changées OU nouveau fichier source |
| `doc-keeper` | STATUS/docs/decisions impactés, nouvelle mécanique, nouveau Pokemon/move/ability |
| `visual-tester` | **JAMAIS auto-coché** (≥2 min Playwright, humain décide) |
| `gate CI` (`/ci-gate`) | Toujours coché sauf si déjà passé dans le tour |
| `commit-message` (`/commit`) | Toujours coché |

Spéciaux selon contexte :
- **Plan en rédaction** (`docs/plans/*.md` draft non commit) : remplace par `[x] plan-reviewer`, `[ ] game-designer` (si mécaniques jeu)
- **Session fin** (humain dit "fin", "/status") : ajoute `[x] session-closer`

#### Ordre d'exécution fixe

`core-guardian → code-reviewer → doc-keeper → visual-tester → /ci-gate → /commit`

Stop sur fail bloquant (`core-guardian` UI-dep, `code-reviewer` Critical, `/ci-gate` rouge, `visual-tester` régression).

**Jamais commit/push auto** — `/commit` génère le titre, humain colle.

#### Exceptions

- Changes purement config (`.claude/`, doc seule) sans code TS → menu réduit (juste `/commit`).
- Bug fix 1 ligne sans test → menu mais `code-reviewer` décoché par défaut.

### Règles fond

- Jamais > 1 agent long en foreground/turn — longs en background
- Gate CI = `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`. **BLOQUANT** avant commit
- Reporté → `docs/next.md`

## Skills

| Cmd | Action |
|-----|--------|
| `/next` | Prochaine étape OU menu post-impl multi-select (selon contexte) |
| `/review-local` | Review code changements locaux |
| `/ci-gate [fast\|full\|slow]` | Gate CI local (lint, typecheck, build, test, integration). BLOQUANT avant commit |
| `/commit` | Génère message commit conventional via agent `commit-message`. Jamais auto-commit |
