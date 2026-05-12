# Workflow et orchestration agents

## Principe
**Claude lance les agents quand nécessaire.** Humain ne demande pas. Tu vois le besoin → tu lances.

## 27 agents disponibles dans `.claude/agents/`

### Core (presque toujours utilisés)
- `code-reviewer` — review qualité avant commit
- `doc-keeper` — met à jour STATUS, decisions, implementations, README
- `test-writer` — tests Vitest, approche test-first
- `commit-message` — propose conventional commit
- `session-closer` — fin session, croise git log + backlog, marque bugs résolus
- `plan-reviewer` — review plans `docs/plans/`
- `game-designer` — équilibre mécaniques, cohérence données
- `core-guardian` — vérifie 0 dep UI dans core

### Spécialisés
- `asset-manager` — sprites, tilesets, sons (pixellab MCP)
- `data-miner` — données Pokemon (Showdown, PokeAPI, Bulbapedia)
- `move-pattern-designer` — patterns tactiques (targeting)
- `ai-player` — joue via API, teste mécaniques
- `sandbox-json` — config sandbox/CLI depuis description NL
- `level-designer` — cartes Tiled `.tmj`
- `visual-tester` — Playwright (proposer avant lancer, ≥2 min)
- `debugger` — diagnostic bugs (opus coûteux, proposer)
- `best-practices` — recherche standards (WebSearch/Fetch, proposer)
- `performance-profiler` — perf web (chrome-devtools)
- `dependency-manager` — audit deps npm
- `feedback-triager` — issues GitHub
- `publisher` — release GitHub (proposer)
- `release-drafter` — changelog
- `wiki-keeper` — wiki public (proposer)

### Memory files (pas agents, sont lus PAR les agents au démarrage)
- `data-miner-knowledge.md` — URLs stables sources Pokemon
- `debugger-knowledge.md`
- `move-pattern-designer-knowledge.md`
- `visual-tester-knowledge.md`

## Deux modes de lancement

### Auto sans demander (majorité)
Tu lances direct, synthétises résultat.

### Proposer avant (coûteux / publics)
- `visual-tester` — Playwright ≥2 min
- `debugger` — opus coûteux
- `best-practices` — WebSearch/Fetch
- `performance-profiler`
- `publisher` — publie release GitHub
- `wiki-keeper` — modifie wiki public

## Chaînes principales

### Plan rédaction
Tu écris → `plan-reviewer` (auto) → `game-designer` (auto si mécaniques) → tu présentes à humain.

### Fin de plan
`core-guardian` (si core) → `code-reviewer` → `doc-keeper` → propose `visual-tester` (si renderer) → gate CI → `commit-message`.

### Hors plan
`code-reviewer` (si significatif) → `doc-keeper` (si doc) → gate CI → `commit-message`.

### Fin session
`session-closer` → gate CI → `commit-message`.

## Règles de fond
- **Jamais > 1 agent long en foreground/turn** — longs en background
- Gate CI = `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`. **BLOQUANT** avant commit
- **Reporté → `docs/next.md`** (agenda persistant)

## Interdits importants
- **Git** : jamais commit/push/add. Humain gère versioning. Lecture seule (status, diff, log). Bloqué par hook PreToolUse.
- **Infra** : jamais install global. Bloqué par hook.
- **Changements structurels** : consulter humain AVANT modifier tsconfig, module resolution, structure, dépendances. Bug fixes simples OK.
- **Mémoire Claude vs doc projet** : recherches/décisions/contexte → doc projet (git). Mémoire Claude = préférences perso humain seulement.

## Décisions humaines récurrentes
- CI verte ≠ feature validée. **Attendre validation visuelle** humain avant commit final.
- Avant disable règle Biome : présenter options (corriger vs disable) à l'humain.
- Avant pattern rendu/physique non trivial : lancer `best-practices` AVANT d'implémenter.
- Avant agent générateur : trancher design complet avec humain.
