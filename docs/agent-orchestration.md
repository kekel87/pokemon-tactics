# Orchestration des agents

**Principe** : l'humain ne demande jamais un agent. Claude décide et lance selon le contexte.

- **Auto (sans demander)** : tu lances direct.
- **Proposer avant** : seulement agents coûteux ou actions publiques (liste ci-dessous).

Résumé dans `CLAUDE.md`. Ce fichier contient le détail par agent.

## Agents — mode de déclenchement

### Auto — tu lances sans demander

| Agent | Quand |
|---|---|
| `core-guardian` | Après tout changement `packages/core/` |
| `plan-reviewer` | Après rédaction/modif d'un plan, **avant** de le présenter à l'humain |
| `game-designer` | Après rédaction de plan impactant mécaniques/équilibre, **avant** présentation ; ajout/modif données Pokemon |
| `test-writer` | Avant/pendant implémentation d'une mécanique core ; ajout/suppression/modif d'un move |
| `asset-manager` | Quand tu as besoin de produire/placer/transformer un asset |
| `data-miner` | Quand tu as besoin d'extraire ou formatter des données Pokemon |
| `move-pattern-designer` | Ajout/modif de moves (attribution du pattern tactique) |
| `dependency-manager` | Avant d'ajouter une dépendance npm |
| `ci-setup` | Modif pipeline CI / GitHub Actions |
| `feedback-triager` | Quand tu veux trier des issues GitHub |
| `sandbox-json` | Quand tu as besoin d'une config sandbox |
| `code-reviewer` | Fin de plan / changements significatifs hors plan |
| `doc-keeper` | Fin de plan / quand doc impactée |
| `session-closer` | Fin de session (déclenché par toi ou `/next` si pertinent) |
| `commit-message` | Après gate CI OK, en fin de chaîne |

### Proposer avant de lancer

| Agent | Raison |
|---|---|
| `visual-tester` | Playwright ≥ 2 min |
| `debugger` | Modèle opus, analyse multi-step coûteuse |
| `best-practices` | WebSearch + WebFetch coûteux |
| `balancer` | Lance N combats headless, long |
| `performance-profiler` | Profiling coûteux |
| `publisher` | Publie une release GitHub (public) |
| `wiki-keeper` | Modifie le wiki GitHub (public) |

### Sur demande explicite uniquement

| Agent | Contexte |
|---|---|
| `level-designer` | L'humain dit "crée une map X" |
| `ai-player` | L'humain dit "fais jouer l'IA sur X" |

## Foreground vs background

Lance en **background** (`run_in_background: true`) :
- `visual-tester`, `best-practices`, `debugger`, `balancer`, `performance-profiler`

Foreground (< 30s) :
- `core-guardian`, `commit-message`, `plan-reviewer`, `sandbox-json`, `dependency-manager`

Quand tu lances un agent en background :
1. Dis à l'humain qu'il tourne.
2. Continue sur d'autres tâches (pas d'attente active).
3. Synthétise le résultat à l'arrivée.

**Règle d'or** : jamais plus d'un agent long en foreground par turn.

## 🔴 Subagents en session worktree — CWD (RÈGLE DURE)

**Piège confirmé (plan 137, 2026-06-21)** : un subagent hérite du **CWD du checkout principal** (`/home/.../pokemon-tactics`), **PAS** du worktree, même si le prompt mentionne le chemin du worktree. S'il lance `git status`/`git diff`/`git log` ou utilise des chemins relatifs, il lit l'état du **checkout principal** (souvent une autre branche, du travail parallèle de l'humain) → il croit le travail absent et peut conclure n'importe quoi (un agent a wronguement « reverté » son propre travail, croyant le plan non implémenté ; il a accusé `rtk` à tort — `rtk` était exact, c'était le mauvais répertoire).

Quand tu lances un subagent pour du travail **dans un worktree** (`.worktrees/<branche>/`) :
1. **Première instruction du prompt = `cd <chemin absolu du worktree>`** avant toute commande, et vérifier `git rev-parse --show-toplevel` == le worktree.
2. Donner **tous les chemins en absolu** (Edit/Read/Grep sur `/home/.../.worktrees/<branche>/...`). Les chemins relatifs résolvent depuis le checkout principal.
3. Si le subagent n'a pas besoin de git, lui dire **de ne lancer aucune commande git** et de lire les fichiers directement (Read/grep) — supprime la classe de bug entière.
4. Ne jamais se fier à un `git status/diff` d'un subagent dont on n'a pas garanti le CWD : recouper soi-même depuis le worktree (`cd <worktree> && git ...`).

`rtk` n'est PAS en cause ici (`rtk git status` est frais, vérifié) — la cause est toujours le CWD.

## Chaînes principales

### Rédaction d'un plan
1. Tu écris le plan
2. `plan-reviewer` (auto)
3. `game-designer` (auto si mécaniques/équilibre touchés)
4. Tu présentes à l'humain

### Étape intermédiaire d'un plan
- `core-guardian` si `packages/core/` touché

### Fin d'un plan (dernière étape)
1. `core-guardian` si `packages/core/` touché
2. `code-reviewer`
3. `doc-keeper`
4. Proposer `visual-tester` si `packages/renderer/` touché
5. **Gate CI** bloquante
6. `commit-message`

Ce qui n'est pas fait (ex: humain refuse visual-tester) → inscrit dans `docs/next.md` section "Reporté".

### Hors plan (bugfix, refacto)
- `code-reviewer` si changements significatifs
- `doc-keeper` si doc impactée
- Gate CI bloquante avant commit

### Fin de session
1. `session-closer` (MAJ STATUS.md)
2. Gate CI bloquante
3. `commit-message` (seulement si CI OK)

## Chaînes entre agents

- `code-reviewer` → `core-guardian` (si core) → `game-designer` (si mécaniques)
- `code-reviewer` → `visual-tester` (si renderer + dev server) — à proposer
- `debugger` → `visual-tester` (si composante visuelle) — à proposer
- `session-closer` → `doc-keeper` → `commit-message`
- `visual-tester` → `sandbox-json` (pour config de test)
- `doc-keeper` → `wiki-keeper` (si game design / roster) — à proposer
- `publisher` → compile changelog from `git log <last_tag>..HEAD` + plans → publish → watch `itch-deploy` workflow → `/itch-devlog` markdown → `wiki-keeper` → update `STATUS.md`/`docs/roadmap.md`/`docs/backlog.md`

## Structure du wiki GitHub

Le wiki `kekel87/pokemon-tactics/wiki` est **bilingue (Option A)** — décision #277.

- Pages EN sans préfixe : `Home`, `How-to-Play`, `Mechanics`, `Maps`, `Changelog`, `Roadmap`
- Pages FR avec noms français : `Accueil`, `Comment-jouer`, `Mécaniques`, `Cartes`, `Changelog-FR`, `Feuille-de-route`
- Chaque page commence par un lien de bascule : `🇬🇧 English | 🇫🇷 Français`
- `_Sidebar.md` liste les deux langues en deux blocs distincts
- Langue par défaut publique : **anglais** (audience internationale)
- Langue doc interne projet (docs/, plans/) : **français**

## MCP navigateur — Playwright vs chrome-devtools

Deux MCP complémentaires, jamais en doublon :

| MCP | Agent | Usage |
|---|---|---|
| **Playwright** | `visual-tester` | Interactions de haut niveau : naviguer, cliquer, screenshot, valider un workflow joueur |
| **chrome-devtools** | `debugger`, `performance-profiler` | Introspection bas niveau : console source-mapped, traces CPU, memory snapshots, Lighthouse, réseau détaillé, état runtime via `evaluate_script` |

**Règle de choix** :
- Bug visuel reproductible par clic → `visual-tester` (Playwright)
- Bug avec exception JS / état interne suspect → `debugger` (chrome-devtools, console source-mapped)
- Mesure de perf (FPS, mémoire, bundle runtime) → `performance-profiler` (chrome-devtools traces + Lighthouse)

Ne jamais lancer les deux en parallèle sur la même URL (conflit sur le port Chrome).

## Agenda persistant — `docs/next.md`

**Toi (Claude) tu le maintiens** après chaque étape :
- Ce qui a été fait → section "Fait récemment" (rolling 10)
- Ce qui a été reporté/skippé → section "Reporté / à refaire" (avec la raison)
- Ce qui devrait être fait ensuite → section "À faire maintenant"

L'humain le consulte via `/next` pour avoir une vue claire sans rien oublier.
