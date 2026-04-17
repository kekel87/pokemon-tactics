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
| `release-drafter` | Commit notable avec changement visible joueur |

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
- `commit-message` → `release-drafter` (si changement visible joueur)
- `publisher` → `wiki-keeper` (changelog post-publication)

## Agenda persistant — `docs/next.md`

**Toi (Claude) tu le maintiens** après chaque étape :
- Ce qui a été fait → section "Fait récemment" (rolling 10)
- Ce qui a été reporté/skippé → section "Reporté / à refaire" (avec la raison)
- Ce qui devrait être fait ensuite → section "À faire maintenant"

L'humain le consulte via `/next` pour avoir une vue claire sans rien oublier.
