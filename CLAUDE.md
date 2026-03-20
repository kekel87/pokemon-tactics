# CLAUDE.md — Instructions pour Claude Code

## Contexte projet

Pokemon Tactics : jeu de combat tactique (Pokemon x FFTA) en TypeScript + Phaser 4.
Monorepo pnpm workspaces. Core découplé du rendu. AI-playable.

## Rôle du créateur

Le créateur **ne code pas**. Il est directeur créatif, architecte et reviewer.
Claude Code est le **développeur principal** — autonome sur l'implémentation, mais valide les choix de design avec le créateur.
Profil : dev web Angular/TS expérimenté, clean code advocate, expérience Godot + Phaser, temps limité.
**Continuité** : le créateur peut revenir après 1 mois. Maintenir STATUS.md, plans/ et la mémoire à jour pour reprendre sans friction.

## Documentation — quoi lire et quand

| Fichier | Quand le lire |
|---------|---------------|
| `STATUS.md` | **En premier** — quand on reprend le projet après une pause ("on en était où ?") |
| `docs/game-design.md` | Avant d'implémenter une mécanique de jeu |
| `docs/architecture.md` | Avant de créer un nouveau fichier/package ou changer la structure |
| `docs/decisions.md` | Quand on hésite sur un choix (la réponse est peut-être déjà là) |
| `docs/roster-poc.md` | Pour les Pokemon et movesets du prototype |
| `docs/roadmap.md` | Pour savoir quoi faire ensuite |
| `docs/references.md` | Quand on cherche comment un problème a été résolu ailleurs |
| `docs/methodology.md` | Pour le workflow de travail |
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
- **Git** : ne jamais commit/push/add — le créateur gère le versioning. Lecture seule (status, diff, log)
- **Infra** : ne jamais installer globalement ni modifier nvm/npm config — le créateur travaille sur d'autres projets en parallèle
- **Changements structurels** : consulter le créateur AVANT de modifier tsconfig, module resolution, structure de dossiers, dépendances. Les bug fixes simples n'ont pas besoin d'approbation

## Orchestration des agents

Après un changement significatif, lancer les agents pertinents **automatiquement** :

| Déclencheur | Agents à lancer |
|-------------|-----------------|
| Modif dans `packages/core/` | `core-guardian` + `test-writer` si nouvelle mécanique |
| Modif de mécaniques de jeu | `game-designer` pour cohérence |
| Avant un commit | `code-reviewer` (+ `core-guardian` si core touché) |
| Fin de session | `session-closer` (ou `/status`) |
| Ajout/modif de données | `game-designer` pour équilibre |
| Après un ensemble de changements | `doc-keeper` pour la doc |
| Ajout de dépendance | `dependency-manager` pour valider |
| Ajout/modif d'assets | `asset-manager` pour conventions |
| Nouveau plan ou plan à jour | `plan-reviewer` |
| Hésitation sur une approche | `best-practices` pour recherche |
| Bug complexe | `debugger` |
| Ajout/modif d'un agent ou skill | `agent-manager` pour audit cohérence |
| Audit périodique | `agent-manager` pour review globale |

Ne pas lancer tous les agents à chaque fois — seulement ceux pertinents au changement.

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
