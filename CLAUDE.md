# CLAUDE.md

## Projet

Pokemon Tactics : combat tactique (Pokemon × FFTA), TypeScript + Babylon.js 8, monorepo pnpm. Core découplé du rendu. AI-playable.

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
| `docs/test-plan.md` | Cahier de recette visuelle — avant valider un changement de rendu, avant release |
| `.claude/rules/e2e.md` | Conventions harness Playwright e2e (fixtures, POMs, seed, hook scène) |

Pas tout charger. Lire fichier pertinent moment pertinent.

## Exploration code TS

U-A graph (`.understand-anything/knowledge-graph.json`, 1008 nodes, auto-update post-commit) pour questions architecture → `/understand-chat`.

## Principes

- **Core découplé** : zéro dep UI (détails `.claude/rules/core.md`)
- **Tests first** : mécanique core → tests avant visuel
- **Petit, incrémental** : 1 changement = 1 chose
- **TypeScript strict** : pas de `any` implicite, pas de `as` abusif
- **Pas de sur-ingénierie** : commencer simple

## Conventions

- **Commits** : conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) — **titre seul, jamais corps**, version courte/concise. Détails → STATUS.md ou plan
  - **Scope** : 1 seul scope max (`feat(data): ...`). Si plusieurs scopes → **pas de scope du tout** (`feat: ...`), jamais `feat(scope1, scope2): ...`
- **Langue** : code anglais, doc français
- **🔴 Noms FR officiels — RÈGLE DURE** : toute communication à l'humain (texte, tableaux, menus `AskUserQuestion`, listes) utilise les **noms FR officiels** des moves/talents/Pokemon (ex: `Lame de Roche`, `Provoc`, `Florizarre`). **JAMAIS l'ID anglais seul.** ID EN entre parenthèses uniquement si précision technique requise. L'humain ne connaît PAS les noms EN. Source : `packages/data/reference/moves.json` (`names.fr`) ou `packages/data/src/i18n/*.fr.json`. Récidive = grosse friction (rappelé >10×)
- **Linter** : Biome
- **Plans** : `docs/plans/xxx-name.md` numérotés, statut en en-tête
- **Nommage** : pas d'abréviations (`traversalContext` pas `ctx`)
- **Écriture code** : Edit > Write. Petits Edit successifs, pas Write massif
- **Code mort** : zéro tolérance
- **Lint** : jamais désactiver règle Biome sans accord humain. Présenter options d'abord

Règles détaillées par package : `.claude/rules/*.md` (chargées via frontmatter `paths:` selon fichier touché).

## Stack

TypeScript strict ESM · Babylon.js 8 · Vitest · Playwright (`visual-tester` + harness e2e `pnpm test:e2e`) · chrome-devtools MCP (`debugger`, `performance-profiler`) · Vite · Biome · pnpm workspaces.

## Interdits

- `any` sans justification
- Commiter assets non libres de droits
- Charger toute doc en contexte quand 1 fichier suffit
- **Git** : commit/add/push/amend autorisés APRÈS validation du message en chat. Claude propose le message (titre seul, court), l'humain valide, puis Claude commit + push. Jamais commit sans proposition+validation préalable. Destructeurs interdits (checkout, reset, merge, restore, clean, rm, branch -d, tag -d) — bloqués par deny-list. **`git rebase` autorisé** (l'humain déteste les merges → intégration worktree → main par rebase, jamais merge). **Exception merge : `git merge --ff-only` autorisé** (non destructif ; autres merges = humain via GUI). Garde dans hook `block-forbidden-commands.sh`
- **Infra** : install global, modif nvm/npm config interdit. Bloqué par hook
- **Structurel** : consulter humain AVANT modifier tsconfig, module resolution, structure, dépendances. Bug fix simple OK
- **Mémoire vs doc** : recherches/décisions/contexte → doc projet (git), pas mémoire Claude. Mémoire = préférences perso humain seulement
- **Noms EN seuls** : présenter un move/talent/Pokemon par son ID anglais seul à l'humain est INTERDIT. Voir règle dure Conventions. Hook `french-names-reminder.sh` réinjecte la règle chaque tour

## Agents

**Tu lances, humain demande pas.** Besoin asset → `asset-manager`. Données → `data-miner`. Tests → `test-writer`.

**Auto sans demander** : majorité. **Proposer avant** : `visual-tester` (Playwright ≥2 min), `debugger` (opus), `best-practices` (Web*), `balancer`, `performance-profiler`, `publisher`, `wiki-keeper`.

Détails : `docs/agent-orchestration.md`.

### Après impl — règle OBLIGATOIRE

**Dès que tu finis d'implémenter** (build OK, code écrit, tests passent), AVANT de dire "fait" / "terminé" / proposer la suite, tu DOIS :

1. Exécuter `git status --porcelain` pour confirmer fichiers modifiés.
2. Appeler `AskUserQuestion` avec un menu multi-select des étapes de chaîne, pré-cochées selon contexte.
3. Attendre la sélection humain. Exécuter en ordre fixe. Stop sur fail bloquant.

**Raccourci** : l'humain peut afficher ce menu à tout moment (même mid-session, hors fin d'impl) via `/menu` ou en envoyant le mot **`menu`** seul. Traiter "menu" nu comme un appel au skill `/menu`.

**Pas optionnel. Pas négociable.** Même si tu penses "le changement est petit". Même si tu as confiance. L'humain coche/décoche.

#### Format du menu (AskUserQuestion)

⚠️ `AskUserQuestion` plafonne à **4 options par question**. Le menu est donc **découpé en 3 questions `multiSelect`** dans **un seul appel** `AskUserQuestion` (3 entrées dans `questions`), groupées par phase et dans l'ordre :

**Q1 — `"Tests ?"`** (multiSelect)

| Option | Pré-coché si |
|--------|--------------|
| `e2e (test-writer)` | changement **observable automatisable** (DOM/écran, ou mécanique pilotable via journal/scène) → l'agent `test-writer` ajoute/MAJ le scénario e2e **et** le cahier `docs/test-plan.md` (case 🤖/👁 + §11). Décoché si purement pixel/anim |
| `human-testing` | changement observable (move/ability/mécanique/UI/rendu/IA) — **mode interactif**, voir § dédié |
| `visual-tester` | **JAMAIS auto-coché** (≥2 min Playwright, je pilote) |

**Q2 — `"Validations locales ?"`** (multiSelect)

| Option | Pré-coché si |
|--------|--------------|
| `core-guardian` | `git diff --name-only HEAD` matche `packages/core/` |
| `code-reviewer` | >50 lignes changées OU nouveau fichier source |
| `doc-keeper` | STATUS/docs/decisions impactés, nouvelle mécanique, nouveau Pokemon/move/ability |

**Q3 — `"Finalisation ?"`** (multiSelect)

| Option | Pré-coché si |
|--------|--------------|
| `gate CI` (`/ci-gate`) | Toujours coché sauf si déjà passé dans le tour |
| `commit-message` (`/commit`) | Toujours coché |

Spéciaux selon contexte :
- **Plan en rédaction** (`docs/plans/*.md` draft non commit) : Q2 remplacée par `[x] plan-reviewer`, `[ ] game-designer` (si mécaniques jeu)
- **Session fin** (humain dit "fin", "/status") : ajoute `[x] session-closer`

#### Ordre d'exécution fixe

`e2e (test-writer) → human-testing → visual-tester → core-guardian → code-reviewer → doc-keeper → /ci-gate → /commit`

Stop sur fail bloquant (`core-guardian` UI-dep, `code-reviewer` Critical, `/ci-gate` rouge, `visual-tester` régression).

**`human-testing` — mode interactif (par défaut)** : je ne dump pas tout, je déroule **un scénario à la fois**, je lance, tu regardes, tu valides.
1. Analyse `git diff HEAD` → scénarios observables (noms FR).
2. Par scénario : commande `pnpm dev:sandbox '{...}'` pré-remplie, moves/Pokemon validés (`packages/data` ; doute → agent `sandbox-json`).
3. **Boucle** : (a) je lance la commande du scénario courant ; (b) résumé en chat — **quoi tester** (1-2 lignes) + **résultat attendu** (noms FR) ; (c) **pause**, tu testes ; (d) ta réponse `suivant`/`ok` → scénario suivant ; bug/retour → on traite avant de continuer.
4. Tous scénarios passés → on enchaîne `/ci-gate`, `/commit`. Exclusif de `visual-tester` en général.

**Commit/push après validation** — `/commit` génère le titre court (1 scope max, sinon aucun), Claude le **propose en chat**, l'humain valide, **puis Claude commit + push**. Jamais commit sans validation préalable du message.

#### Exceptions

- Changes purement config (`.claude/`, doc seule) sans code TS → menu réduit (juste `/commit`).
- Bug fix 1 ligne sans test → menu mais `code-reviewer` décoché par défaut.

### Règles fond

- Jamais > 1 agent long en foreground/turn — longs en background
- Gate CI = `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e`. **BLOQUANT** avant commit. ⚠️ L'e2e tourne **uniquement au gate local** (pas en CI GitHub : rendu Babylon WebGL instable en headless ubuntu)
- Reporté → `docs/next.md`

## Skills

| Cmd | Action |
|-----|--------|
| `/next` | Prochaine étape OU menu post-impl multi-select (selon contexte) |
| `/menu` (ou mot `menu`) | Affiche le menu interactif post-impl multi-select à la demande, même mid-session |
| `/review-local` | Review code changements locaux |
| `/ci-gate [fast\|full\|slow]` | Gate CI local (lint, typecheck, build, test, integration). BLOQUANT avant commit |
| `/commit` | Génère message commit conventional court via agent `commit-message`, le propose en chat. Après validation humaine → commit + push |
| `/worktree` | Crée/liste/supprime un git worktree (`.worktrees/<branche>/`) pour N sessions Claude en // : deps reflink-copiées (CoW, ≈0 disk), port Vite déterministe par worktree. `add <branche> [base] \| list \| status \| clean \| relink \| rm` |
