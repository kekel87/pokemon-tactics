# CLAUDE.md — Instructions pour Claude Code

## Contexte projet

Pokemon Tactics : jeu de combat tactique (Pokemon x FFTA) en TypeScript + Phaser 4.
Monorepo pnpm workspaces. Core découplé du rendu. AI-playable.

## Rôle de l'humain

L'humain **ne code pas**. Il est directeur créatif, architecte et reviewer.
Claude Code est le **développeur principal** — autonome sur l'implémentation, mais valide les choix de design avec l'humain.
Profil : dev web Angular/TS expérimenté, clean code advocate, expérience Godot + Phaser, temps limité.
**Continuité** : l'humain peut revenir après 1 mois. Maintenir STATUS.md, plans/ et la mémoire à jour pour reprendre sans friction.

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
- **Nommage** : pas d'abréviations (`traversalContext` pas `ctx`, `pokemonInstance` pas `pkmn`)
- **Enums** : const object pattern (`as const` + type dérivé), jamais de string literals pour les erreurs/types
- **Types** : 1 fichier = 1 interface/type
- **Mocks** : factories et données dans `packages/core/src/testing/`, jamais inline dans les tests
- **Tests unitaires** : pas de commentaires. Tests intégration/scénario : commentaires OK (parcimonie), bloc Gherkin pour scénarios
- **Écriture de code** : préférer Edit à Write. Construire les gros fichiers par petits Edit successifs, pas un Write massif
- **Code mort** : zéro tolérance. Pas de fonctions/branches/imports inutilisés. Utiliser le coverage pour détecter les branches jamais atteintes.

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
- **Git** : ne jamais commit/push/add — l'humain gère le versioning. Lecture seule (status, diff, log)
- **Infra** : ne jamais installer globalement ni modifier nvm/npm config — l'humain travaille sur d'autres projets en parallèle
- **Changements structurels** : consulter l'humain AVANT de modifier tsconfig, module resolution, structure de dossiers, dépendances. Les bug fixes simples n'ont pas besoin d'approbation
- **Mémoire Claude vs doc projet** : les recherches, comparatifs, décisions et contexte technique vont dans la doc du projet (plans/, docs/, decisions.md) — versionnée dans git, accessible partout. La mémoire Claude ne sert que pour les préférences personnelles de l'humain.

## Orchestration des agents

Les agents se déclenchent **automatiquement** après chaque changement significatif. Ne pas attendre qu'on le demande. Ne pas lancer tous les agents — seulement ceux pertinents.

### Quand lancer quoi

**Après chaque étape intermédiaire d'un plan (code écrit + tests passent) :**
- `core-guardian` — si le diff touche `packages/core/`

**Après la dernière étape d'un plan :**
1. `core-guardian` — si le diff touche `packages/core/`
2. `code-reviewer` — review qualité (pas de commit message, c'est le rôle de `commit-message`)
3. `doc-keeper` — met à jour TOUS les docs impactés + roadmap.md + STATUS.md
4. `visual-tester` — si le plan touche `packages/renderer/` (vérification visuelle via `sandbox-url`)

**Travail hors plan (bugfix, expérimentation, refacto opportuniste) :**
- `code-reviewer` — review qualité (si changements significatifs)
- `doc-keeper` — si la doc est impactée

**En fin de session :**
- `pnpm build` + `pnpm test` — vérifier que tout compile et passe avant de proposer un commit
- `session-closer` (ou `/status`) → `commit-message` (si changements non commités)

**Selon le contexte du changement :**

| Déclencheur | Agent |
|-------------|-------|
| Nouvelle mécanique de jeu | `game-designer` (cohérence + équilibre) |
| Nouvelle mécanique dans le core | `test-writer` (tests first) |
| Ajout/suppression/modif d'un move | `test-writer` (audit moves/ + mécanique, crée/supprime/MAJ le fichier de test) |
| Ajout/modif de données Pokemon | `game-designer` + `data-miner` |
| Revue/attribution des patterns d'attaque | `move-pattern-designer` (semantique nom → pattern) |
| Ajout de dépendance | `dependency-manager` (audit avant d'ajouter) |
| Ajout/modif d'assets | `asset-manager` (conventions) |
| Nouveau plan ou plan à reviewer | `plan-reviewer` |
| Hésitation sur une approche | `best-practices` (recherche marché) |
| Bug complexe | `debugger` (diagnostic opus) |
| Modif renderer ou UI Phaser | `visual-tester` (vérification visuelle via Playwright) |
| Bug visuel / rendu cassé | `visual-tester` (screenshot + console + interactions) |
| Modif pipeline CI ou ajout package | `ci-setup` |
| Problème de perf ou avant release | `performance-profiler` |
| Ajout/modif d'un agent ou skill | `agent-manager` (audit cohérence) |
| Besoin d'une URL sandbox | `sandbox-url` (génère l'URL à partir d'une description) |
| Fin de session avec changements non commités | `commit-message` (propose un message de commit) |

### Chaînes d'agents

Certains agents en déclenchent d'autres :
- `code-reviewer` (hors flow principal, ex: via `/review`) → `core-guardian` (si core touché) → `game-designer` (si mécaniques modifiées)
- `code-reviewer` (hors flow principal) → `visual-tester` (si renderer touché, dev server lancé)
- `debugger` → `visual-tester` (si le bug a une composante visuelle)
- `session-closer` → vérifie que `doc-keeper` a bien mis à jour la doc → `commit-message` (si changements non commités)
- `visual-tester` peut appeler `sandbox-url` pour obtenir l'URL de navigation
- `agent-manager` — à déclencher manuellement après ajout/modif d'agents pour auditer la cohérence

## Skills disponibles

| Commande | Action |
|----------|--------|
| `/next` | Propose la prochaine étape de travail |
| `/review` | Review de code sur les changements en cours |
| `/status` | Met à jour STATUS.md en fin de session |
| `/inspire <jeu ou URL>` | Analyse visuelle pour inspiration |
| `/plan <titre ou numéro>` | Crée ou review un plan d'exécution |
| `/debug <description>` | Diagnostic avancé d'un bug (opus) |
| `/practices <sujet>` | Recherche bonnes pratiques du marché |
