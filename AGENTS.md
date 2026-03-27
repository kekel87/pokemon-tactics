# Agents — Pokemon Tactics

## Contexte projet

Pokemon Tactics : jeu de combat tactique (Pokemon x FFTA) en TypeScript + Phaser 4.
Monorepo pnpm workspaces. Core decouple du rendu. AI-playable.

## Role de l'humain

L'humain **ne code pas**. Il est directeur creatif, architecte et reviewer.
L'agent est le **developpeur principal** — autonome sur l'implementation, mais valide les choix de design avec l'humain.
Profil : dev web Angular/TS experimente, clean code advocate, experience Godot + Phaser, temps limite.
**Continuite** : l'humain peut revenir apres 1 mois. Maintenir STATUS.md, plans/ et la documentation a jour pour reprendre sans friction.

## Documentation — quoi lire et quand

| Fichier | Quand le lire |
|---------|---------------|
| `STATUS.md` | **En premier** — quand on reprend le projet apres une pause ("on en etait ou ?") |
| `docs/game-design.md` | Avant d'implementer une mecanique de jeu |
| `docs/architecture.md` | Avant de creer un nouveau fichier/package ou changer la structure |
| `docs/decisions.md` | Quand on hesite sur un choix (la reponse est peut-etre deja la) |
| `docs/roster-poc.md` | Pour les Pokemon et movesets du prototype |
| `docs/reflexion-patterns-attaques.md` | Avant d'attribuer ou implementer un pattern d'attaque |
| `docs/roadmap.md` | Pour savoir quoi faire ensuite |
| `docs/references.md` | Quand on cherche comment un probleme a ete resolu ailleurs |
| `docs/methodology.md` | Pour le workflow de travail |
| `plans/` | Lire le plan en cours avant de coder |

Ne pas tout charger d'un coup. Lire le fichier pertinent au moment pertinent.

## Principes de developpement

- **Core decouple** : `packages/core` n'a AUCUNE dependance UI/rendu. Logique pure uniquement.
- **Tests first** : chaque mecanique du core a des tests avant d'etre rendue visuellement.
- **Petit et incremental** : un changement = une chose.
- **Pas de sur-ingenierie** : commencer simple, refactorer quand necessaire.
- **TypeScript strict** : `strict: true`, pas de `any` implicite, pas de `as` abusif.

## Conventions

- **Commits** : conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- **Langue du code** : anglais (variables, fonctions, types, commentaires)
- **Langue de la doc** : francais
- **Imports** : path aliases `@pokemon-tactic/core`, `@pokemon-tactic/renderer`, etc.
- **Tests** : `.test.ts` a cote du fichier teste
- **Linter/Formatter** : Biome (remplace ESLint + Prettier)
- **Plans** : `plans/xxx-name.md` numerotes, avec statut en en-tete
- **Nommage** : pas d'abreviations (`traversalContext` pas `ctx`, `pokemonInstance` pas `pkmn`)
- **Enums** : const object pattern (`as const` + type derive), jamais de string literals pour les erreurs/types
- **Types** : 1 fichier = 1 interface/type
- **Mocks** : factories et donnees dans `packages/core/src/testing/`, jamais inline dans les tests
- **Tests unitaires** : pas de commentaires. Tests integration/scenario : commentaires OK (parcimonie)
- **Code mort** : zero tolerance. Pas de fonctions/branches/imports inutilises.

## Stack

- TypeScript strict, ESM modules
- Phaser 4 pour le rendu
- Vitest pour les tests unitaires
- Playwright pour les tests visuels
- Vite pour le bundling
- Biome pour le linting/formatting
- pnpm workspaces pour le monorepo

## Ce qu'il ne faut PAS faire

- Ajouter des dependances UI/Phaser dans `packages/core`
- Utiliser `any` sans justification
- Commiter des assets non libres de droits
- Pousser sur `main` sans que les tests passent
- Charger toute la doc en contexte quand un seul fichier suffit
- **Git** : ne jamais commit/push/add — l'humain gere le versioning. Lecture seule uniquement.
  - AUTORISE : `git status`, `git diff`, `git log`, `git show`, `git branch`, `git fetch`, `git stash list`
  - INTERDIT : `git commit`, `git push`, `git add`, `git checkout`, `git reset`, `git rebase`, `git merge`, `git clean`, `git restore`, `git rm`, `git mv`, `git branch -d/-D`, `git stash drop`, `git tag -d`
- **Infra** : ne jamais installer globalement ni modifier nvm/npm config
- **Changements structurels** : consulter l'humain AVANT de modifier tsconfig, module resolution, structure de dossiers, dependances

## Orchestration des agents

Les agents se declenchent **automatiquement** apres chaque changement significatif. Ne pas attendre qu'on le demande. Ne pas lancer tous les agents — seulement ceux pertinents.

### Quand lancer quoi

**Apres chaque etape d'un plan (code ecrit + tests passent) :**
1. `core-guardian` — si le diff touche `packages/core/`
2. `code-reviewer` — review qualite + propose un message de commit
3. `doc-keeper` — met a jour TOUS les docs impactes (checklist systematique)

**Apres la derniere etape d'un plan :**
- Les 3 ci-dessus + `doc-keeper` met aussi a jour roadmap.md et STATUS.md

**En fin de session :**
- `session-closer` (ou `/status`)

**Selon le contexte du changement :**

| Declencheur | Agent |
|-------------|-------|
| Nouvelle mecanique de jeu | `game-designer` (coherence + equilibre) |
| Nouvelle mecanique dans le core | `test-writer` (tests first) |
| Ajout/modif de donnees Pokemon | `game-designer` + `data-miner` |
| Revue/attribution des patterns d'attaque | `move-pattern-designer` (semantique nom → pattern) |
| Ajout de dependance | `dependency-manager` (audit avant d'ajouter) |
| Ajout/modif d'assets | `asset-manager` (conventions) |
| Nouveau plan ou plan a reviewer | `plan-reviewer` |
| Hesitation sur une approche | `best-practices` (recherche marche) |
| Bug complexe | `debugger` (diagnostic opus) |
| Modif renderer ou UI Phaser | `visual-tester` (verification visuelle via Playwright) |
| Bug visuel / rendu casse | `visual-tester` (screenshot + console + interactions) |
| Modif pipeline CI ou ajout package | `ci-setup` |
| Probleme de perf ou avant release | `performance-profiler` |
| Ajout/modif d'un agent ou skill | `agent-manager` (audit coherence) |

### Chaines d'agents

Certains agents en declenchent d'autres :
- `code-reviewer` → `core-guardian` (si core touche) → `game-designer` (si mecaniques modifiees)
- `code-reviewer` → `visual-tester` (si renderer touche, dev server lance)
- `debugger` → `visual-tester` (si le bug a une composante visuelle)
- `session-closer` → verifie que `doc-keeper` a bien mis a jour la doc

## Skills disponibles

| Commande | Action |
|----------|--------|
| `/next` | Propose la prochaine etape de travail |
| `/review` | Review de code sur les changements en cours |
| `/status` | Met a jour STATUS.md en fin de session |
| `/inspire <jeu ou URL>` | Analyse visuelle pour inspiration |
| `/plan <titre ou numero>` | Cree ou review un plan d'execution |
| `/debug <description>` | Diagnostic avance d'un bug (opus) |
| `/practices <sujet>` | Recherche bonnes pratiques du marche |

## Clarification des rôles des agents

Pour éviter les chevauchements, voici une clarification des responsabilités de chaque agent :

| Agent | Rôle principal | Ne pas confondre avec |
|-------|---------------|----------------------|
| `agent-manager` | Audit des agents et skills | `code-reviewer` (qui audite le code) |
| `code-reviewer` | Review de code et conventions | `game-designer` (qui audite les mécaniques de jeu) |
| `game-designer` | Équilibre et cohérence des mécaniques de jeu | `move-pattern-designer` (qui se concentre sur les patterns d'attaque) |
| `move-pattern-designer` | Attribution des patterns d'attaque | `game-designer` (qui audite l'équilibre global) |
| `test-writer` | Écriture des tests unitaires et d'intégration | `ai-player` (qui teste le jeu en jouant) |
| `visual-tester` | Tests visuels via Playwright | `test-writer` (qui écrit des tests unitaires) |
| `debugger` | Diagnostic avancé des bugs | `visual-tester` (qui se concentre sur les bugs visuels) |
| `doc-keeper` | Mise à jour de la documentation | `session-closer` (qui met à jour STATUS.md) |
| `session-closer` | Mise à jour de STATUS.md en fin de session | `doc-keeper` (qui met à jour tous les docs) |
