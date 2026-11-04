# CLAUDE.md

## Projet

Pokemon Tactics : combat tactique (Pokemon × FFTA), TypeScript + Babylon.js 9, monorepo pnpm. Core découplé du
rendu. AI-playable.

## Humain

Ne code pas. Directeur créatif, architecte, reviewer ; dev web Angular/TS expérimenté, temps limité. Peut revenir
après un mois : le graphe de mémoire et `docs/plans/` restent à jour. Claude est le dev principal, autonome en
implémentation, et valide le design avec l'humain.

## Écrire pour les agents

Tout texte qu'un agent lit (ce fichier, rules, skills, agents, docs) :
- Le texte toujours chargé (ce fichier, `rules/style.md`, les descriptions de skills et d'agents) coûte à chaque
  tour : n'y garder que ce qui change le comportement.
- Une description de skill est un déclencheur : ce qu'il est, puis une phrase par cas qui doit le lancer.
- Un skill se découpe par branche : ce que tout appel utilise reste dans `SKILL.md`, le reste va dans un fichier
  voisin derrière un pointeur qui dit quand le lire.
- Corps = étapes ordonnées, chacune finissant sur un critère vérifiable, puis la référence.
- Écrire le comportement voulu ; une interdiction n'est qu'un garde-fou à côté.
- Source unique : ne jamais répéter un script, une config ou un autre doc ; écrire ce que la lecture du code ne
  montre pas (convention, raison d'un choix, piège).
- Pas de récit d'incident : la raison tient en une proposition, l'histoire va au graphe.
- En français, sans tiret cadratin (hook). Règles de domaine : `.claude/rules/*.md` avec `paths:` en liste YAML.
- Sources : méthode agents de l'humain (`~/Documents/claude-assistant/docs/methode-agents-2026-11-02.md`).

## Où lire quoi

La mémoire du projet est un graphe SQLite, plus des fichiers : `STATUS.md`, `docs/decisions.md`, `docs/next.md`,
`docs/backlog*.md`, `docs/implementations.md`, `docs/test-plan.md` n'existent plus et ne se recréent jamais.

| Où | Quand |
|---|---|
| `node scripts/memory/query.mjs "2-4 mots-clés"` (`--open <nom>`, `--type <type>`, `--stats`) | Reprise, décisions passées, dette, agenda, retours, recettes, plans clos |
| Graphe, `--type retour` | Retours des joueurs non traités : lister à chaque `/next` ; consigner dès que l'humain en relaie un (jamais en `feedback`, qui = règles de travail) |
| Graphe, entités `réflexion` | Avant un pattern d'attaque |
| Graphe, entités `recette` | Avant de valider un changement de rendu, avant release |
| Graphe, entité `plan-196` | Avant télémétrie, Worker Cloudflare, `pnpm stats` |
| `packages/data` | Roster, movesets, moves, talents (source de vérité, jamais recopiée) |
| `docs/game-design.md` | Avant une mécanique de jeu |
| `docs/architecture.md` | Avant de créer un fichier ou package, de changer la structure |
| `docs/roadmap.md` · `docs/plans/` | Quoi faire ensuite · plan en cours avant de coder |
| `docs/methodology.md` | Workflow, parallélisme des agents |
| `docs/ai-system.md` · `docs/abilities-system.md` | Avant de toucher l'IA · un talent |
| `docs/design-system.md` | Avant couleurs, depths, constantes visuelles |
| `docs/isometric-height-rendering.md` · `docs/babylon/` | Avant rendu iso, picking, multi-niveaux · avant le renderer Babylon |
| `docs/tileset-mapping.md` · `docs/references.md` | Tileset ICON · comment c'est résolu ailleurs |
| `docs/multiplayer.md` | Avant tout code réseau : P2P, protocole, `NETWORK_VERSION`, déterminisme |

Lire le fichier pertinent au moment pertinent, jamais tout.

## Principes

- Core découplé : zéro dépendance UI (`.claude/rules/core.md`).
- Tests pendant le dev pour la mécanique pure du core seulement ; tout le reste (UI, rendu, IA, e2e) après la
  recette humaine, au menu.
- Petit, incrémental, sans sur-ingénierie ; TypeScript strict, pas de `any` ni de `as` abusif.

## Conventions

- **Noms FR officiels, règle dure** : face à l'humain (texte, tableaux, menus, listes), moves, talents et
  Pokemon portent leur nom FR officiel (`Lame de Roche`, `Provoc`, `Florizarre`), l'ID anglais seulement entre
  parenthèses si besoin. Source : `packages/data/reference/moves.json` (`names.fr`), `packages/data/src/i18n/*.fr.json`.
- Code en anglais, doc en français. Noms sans abréviation (`traversalContext`). Edit plutôt que Write.
- Linter Biome : jamais désactiver une règle sans accord, présenter les options. Zéro code mort.
- Commits : conventional commits, titre seul, court, un scope max sinon aucun. Commit et push directs, sans
  proposer le message, mais seulement au menu de finalisation.
- Plans : `docs/plans/xxx-name.md`, numérotés, statut en en-tête.

## Interdits (gardés par hook)

- Git destructeur (checkout, reset, restore, clean, rm, branch -d, tag -d, merge). Autorisés : `git rebase`
  (intégration worktree → main), `git merge --ff-only`.
- Install global, config nvm/npm.
- Commiter les sources d'assets non libres : seul le paquet empaqueté est commité (`sprites.bin`,
  `item-icons.png`, `move-effects.png`).
- Backlog ou agenda au graphe sans accord explicite de l'humain.

Avant de toucher tsconfig, module resolution, structure ou dépendances : consulter l'humain. Recherches,
décisions et contexte vont dans le dépôt (graphe, docs), jamais dans la mémoire de Claude.

## Workflow : deux arrêts

`/next` (choix) → plan → dev d'un trait → **arrêt 1** « Tu testes ? » → `/recette` → **arrêt 2** `/menu`.
Aucun autre arrêt, sauf le coupe-circuit de dérive de plan. Détail : skill `/next` jusqu'à l'arrêt 1, skill
`/menu` pour l'arrêt 2 (l'humain peut l'appeler à tout moment par `/menu` ou le mot `menu`).

## Agents

Claude lance les agents sans attendre qu'on le demande : asset → `asset-manager`, données → `data-miner`, tests
→ `test-writer`. Proposer avant : `visual-tester`, `debugger`, `best-practices`, `performance-profiler`,
`publisher`. Chaque délégation nomme son modèle (haiku mécanique, sonnet bien spécifié, opus
raisonnement dur). Un agent long à la fois au premier plan, les autres en arrière-plan. Parallélisme :
`docs/methodology.md`.

## Gate et e2e

`/ci-gate fast` pour itérer ; `/ci-gate full` bloquant avant commit. La suite e2e complète tourne sur GitHub
après le push et ne bloque jamais : ne jamais l'attendre ; verdict par `/e2e-status`. Pas de `/publish` sur un
rouge.
