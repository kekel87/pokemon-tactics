# CLAUDE.md

## Projet

Pokemon Tactics : combat tactique (Pokemon × FFTA), TypeScript + Babylon.js 9, monorepo pnpm. Core découplé du rendu. AI-playable.

## Humain

**Pas code**. Directeur créatif, architecte, reviewer. Dev web Angular/TS expérimenté, clean code, Godot+Phaser, temps limité.
Continuité : peut revenir après 1 mois → maintenir le graphe de mémoire et `docs/plans/` à jour.

Claude = dev principal, autonome implémentation, valide design avec humain.

## Docs — quoi lire quand

🔴 **La mémoire du projet est un graphe, plus des fichiers** (plan 200). `STATUS.md`, `docs/decisions.md`,
`docs/next.md`, `docs/backlog.md`, `docs/backlog-archive.md`, `docs/implementations.md`,
`docs/test-plan.md` et 198 plans **n'existent plus** : leur contenu vit dans le graphe. **Ne jamais les
recréer.** Les lignes « Graphe » ci-dessous s'interrogent ; les lignes en `chemin/` sont des documents
maintenus normalement.

| Où lire | Trigger |
|---------|---------|
| **Graphe de mémoire** — `node scripts/memory/query.mjs "mots clés"` | **Reprise** ("on en était où ?"), décisions passées, dette, agenda, historique, retours de l'humain, plans clos, cahier de recette. 2-4 mots-clés distinctifs, jamais une phrase ; `--open <nom-entité>` pour le détail complet ; `--stats` pour l'inventaire |
| `docs/game-design.md` | Avant mécanique jeu |
| `docs/architecture.md` | Avant créer fichier/package, changer structure |
| `packages/data` (source de vérité) | Roster, movesets, moves, talents — jamais un inventaire recopié à la main |
| Graphe, entités `réflexion` | Avant pattern attaque |
| `docs/roadmap.md` | Quoi faire ensuite |
| `docs/references.md` | Comment résolu ailleurs |
| `docs/methodology.md` | Workflow |
| `docs/ai-system.md` | Avant modifier IA |
| `docs/abilities-system.md` | Avant ajouter/modifier talent |
| `docs/design-system.md` | Avant couleurs/depths/constantes visuelles |
| `docs/isometric-height-rendering.md` | Avant rendu iso hauteur/picking/layers multi-niveaux |
| `docs/tileset-mapping.md` | Tileset ICON, propriétés tiles |
| `docs/babylon/` | Avant de toucher au renderer Babylon — densité pixel & ancrage sol, cycle de vie des assets, pipeline pixel-art |
| `docs/plans/` | Plan en cours avant coder |
| Graphe, entité `plan-196` | Avant toucher à la télémétrie, au Worker Cloudflare ou à `pnpm stats` |
| `docs/multiplayer.md` | **Avant tout code réseau/multijoueur** — architecture P2P, protocole, adressage, `NETWORK_VERSION`, déterminisme. Manquait à cette table jusqu'au 2026-09-04 |
| Graphe, entités `recette` | Cahier de recette visuelle — avant valider un changement de rendu, avant release |
| `.claude/rules/e2e.md` | Conventions harness Playwright e2e (fixtures, POMs, seed, hook scène) |
| `.claude/rules/multi-input.md` | **Avant d'ajouter/déplacer un contrôle d'interface** — les 4 axes obligatoires (clavier, manette, tactile, responsive) + recette de mesure |

Pas tout charger. Lire fichier pertinent moment pertinent.

## Principes

- **Core découplé** : zéro dep UI (détails `.claude/rules/core.md`)
- **Tests first — core seulement** : mécanique pure du core (dégâts, règles, traversée) → tests pendant le dev. Tout le reste (UI, rendu, IA, e2e) → tests **après** la recette humaine, dans le menu de finalisation
- **Petit, incrémental** : 1 changement = 1 chose
- **TypeScript strict** : pas de `any` implicite, pas de `as` abusif
- **Pas de sur-ingénierie** : commencer simple

## Conventions

- **Commits** : conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) — **titre seul, jamais corps**, version courte/concise. Détails → graphe de mémoire ou plan en cours
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

TypeScript strict ESM · Babylon.js 9 · Vitest · Playwright (`visual-tester` + harness e2e `pnpm test:e2e`) · chrome-devtools MCP (`debugger`, `performance-profiler`) · Vite · Biome · pnpm workspaces.

## Interdits

- `any` sans justification
- Commiter assets non libres de droits
- Charger toute doc en contexte quand 1 fichier suffit
- **Git** : commit/add/push/amend autorisés **sans validation du message** — Claude suit la convention (titre seul, court, 1 scope max sinon aucun), commit et push, sans rien proposer en chat. Reste soumis au workflow : les commits arrivent au menu de finalisation, jamais pendant le dev. Destructeurs interdits (checkout, reset, merge, restore, clean, rm, branch -d, tag -d) — bloqués par deny-list. **`git rebase` autorisé** (l'humain déteste les merges → intégration worktree → main par rebase, jamais merge). **Exception merge : `git merge --ff-only` autorisé** (non destructif ; autres merges = humain via GUI). Garde dans hook `block-forbidden-commands.sh`
- **Infra** : install global, modif nvm/npm config interdit. Bloqué par hook
- **Structurel** : consulter humain AVANT modifier tsconfig, module resolution, structure, dépendances. Bug fix simple OK
- **Mémoire vs doc** : recherches/décisions/contexte → doc projet (git), pas mémoire Claude. Mémoire = préférences perso humain seulement
- **Noms EN seuls** : présenter un move/talent/Pokemon par son ID anglais seul à l'humain est INTERDIT. Voir règle dure Conventions. Hook `french-names-reminder.sh` réinjecte la règle chaque tour

## Agents

**Tu lances, humain demande pas.** Besoin asset → `asset-manager`. Données → `data-miner`. Tests → `test-writer`.

**Auto sans demander** : majorité. **Proposer avant** : `visual-tester` (Playwright ≥2 min), `debugger` (opus), `best-practices` (Web*), `balancer`, `performance-profiler`, `publisher`, `wiki-keeper`.

Détails : graphe de mémoire, entités `orchestration`.

### Le workflow — DEUX arrêts, pas un de plus

🔴 **Règle mère (2026-09-18, refonte demandée par l'humain).** Entre le moment où un choix est fait
et le moment où l'humain teste, Claude ne s'arrête **jamais**. Il n'y a que **deux arrêts** dans un
cycle : l'**arrêt recette** (une seule question : tu testes ?) et l'**arrêt menu** (la chaîne de
finalisation, après tes retours). Tout arrêt supplémentaire — fin de phase, « je continue ? »,
« je commit le plan ? », « je lance le gate ? » — est une faute. L'humain fait autre chose en
parallèle : chaque arrêt inutile coûte un aller-retour et casse son fil.

#### 1. `/next` — le choix

Résumé court de ce qui vient d'être fait, **2-3 candidats**, **une recommandation**.
Deux issues, **même suite** :
- l'humain confirme un candidat directement, **ou**
- on en discute et un choix sort de la discussion.

🔴 **Le second cas suit exactement le même workflow que le premier.** La méprise historique : après
une discussion, Claude partait coder tête baissée, sans plan ni menu de plan. Une décision issue
d'un échange est une décision comme une autre → on enchaîne sur le plan.

#### 2. Plan

Plan rédigé (`docs/plans/xxx-name.md`), puis **un seul** `AskUserQuestion` :

| Option | Pré-coché si |
|--------|--------------|
| `plan-reviewer` | toujours |
| `game-designer` | le plan touche des mécaniques de jeu |

🔴 **Jamais proposer de commiter le plan.** On ne le fait jamais, ça saoule l'humain. Le plan part
avec le commit de la feature.

#### 3. Dev — d'un trait

Plan validé → Claude implémente **tout**, sans reprendre la parole.

🔴 **Le découpage interne du plan (phases, parties, lots) n'existe pas pour l'humain.** Il ne valide
pas phase par phase, il s'en moque. Pas de « Phase 1 terminée, je passe à la 2 ? ». Pas de commit
intermédiaire proposé. Pas de point d'étape.

Pendant le dev, Claude fait seul : écrire le code, `typecheck`, les **tests unitaires du core**
(mécanique pure : dégâts, règles, traversée — seul moyen de savoir que ça marche), la **passe
multi-entrée mesurée** si le diff touche un contrôle d'interface.

Claude ne fait **pas** : `/ci-gate`, `pnpm build`, e2e (ciblés ou complets), tests unitaires hors
core, lint de finition, commits. Ce sont des **cases du menu final**, elles viennent **après** la
recette humaine.

⚠️ Deux méprises historiques, symétriques, à ne pas rejouer :
- 2026-09-10 (plan 203) : « fais le plan en entier » lu comme « n'affiche plus le menu du tout ».
  Non — le menu final reste obligatoire.
- 2026-09-17 (plan 214) : « va au bout du dev » lu comme « va jusqu'à ce que tout soit vert ».
  Claude a enchaîné lint, typecheck, build, 5254 tests, 125 e2e **avant** de faire tester l'humain.
  Retour : *« encore une fois tu es parti dans les tests et les e2e sans me faire tester »*.

#### 4. ARRÊT 1 — la recette

Code écrit, typecheck vert. Claude :
1. `git status --porcelain`
2. **Résume ce qu'il a fait** (court).
3. Pose **une seule question**, `AskUserQuestion` : **« Tu testes ? »** → `oui` / `non`.

🔴 **Rien d'autre à cet arrêt.** Pas de menu de chaîne, pas de gate, pas d'e2e. Une question.

`oui` → mode interactif (§ dédié plus bas), un scénario à la fois.
L'humain teste, remonte des retours, on itère jusqu'à ce qu'il valide.

#### 5. ARRÊT 2 — le menu de finalisation

Seulement **après** la validation de la recette (ou un `non` à l'arrêt 1).

D'abord, **sans rien demander**, dans cet ordre :
1. **commit WIP** — point de restauration propre avant que la chaîne touche au code.
2. **`core-guardian`** si `git diff --name-only HEAD` matche `packages/core/`.
3. **`code-reviewer`** — **toujours**, plus au menu. Les bloquants se corrigent avant de continuer.

Puis **un seul** `AskUserQuestion`, **une seule question multi-select**, 3 options :

| Option | Pré-coché si |
|--------|--------------|
| `tests (test-writer)` | changement observable automatisable → tests unitaires restants + scénario e2e + cahier de recette (graphe, entités `recette`). Décoché si purement pixel/anim |
| `doc-keeper` | documents `docs/` impactés, fait à consigner au graphe, nouvelle mécanique, nouveau Pokemon/move/talent |
| `gate + commit` | **toujours** — `/ci-gate full` puis commit + push |

Spéciaux : `visual-tester` n'est **jamais** dans le menu auto (≥2 min Playwright, l'humain le
demande). Fin de session (« fin », `/status`) → ajouter `session-closer` (4e option, plafond
`AskUserQuestion`).

**Raccourci** : l'humain peut appeler ce menu à tout moment via `/menu` ou le mot **`menu`** seul.

#### Ordre d'exécution du menu

`commit WIP → core-guardian → code-reviewer → [MENU] → tests (test-writer) → doc-keeper → [re-test humain, conditionnel] → /ci-gate full → commit + push (amende le WIP)`

Stop sur fail bloquant (`core-guardian` UI-dep, `code-reviewer` Critical, `/ci-gate` rouge, contrôle
injoignable au clavier ou au pad).

🔴 **Re-test humain — conditionnel.** On ne redemande à l'humain de tester **que si la chaîne a
retouché du code hors tests unitaires / e2e** (correction de review, standardisation, refacto
doc-keeper). Si la chaîne n'a ajouté que des tests, on va droit au gate et au commit.
Origine du garde-fou : plan 166, une « standardisation » post-validation auto-vérifiée à tort a
écrasé le rendu et fut poussée (mémoire `feedback_wip_commit_retest_before_final`). La condition
ci-dessus le garde là où il sert, sans imposer un aller-retour quand rien de visible n'a bougé.

#### Commits — sans validation de message

🔴 Claude **commit et push directement**, sans proposer le message ni attendre l'accord. La
convention (conventional commits, titre seul, ≤72 char, 1 scope max sinon aucun) suffit, l'humain ne
veut plus arbitrer chaque message. Rien à annoncer en chat.

#### Trouvailles en route

Un truc découvert pendant le dev :
- **Besoin d'une décision de l'humain** (design, arbitrage, priorité) → on en discute, tout de suite.
- **Pas besoin** (bug évident, incohérence, nettoyage dans le périmètre) → Claude avance, point.

🔴 **Zéro « reste à faire » ajouté de ma propre initiative.** Pas de TODO, pas de section « suites
possibles », **rien au backlog ni à l'agenda du graphe sans accord explicite de l'humain.**

#### `human-testing` — mode interactif

Je ne dump pas tout, je déroule **un scénario à la fois**, je lance, tu regardes, tu valides.
0. **Passe multi-entrée, MESURÉE, avant de te déranger** — quand le diff touche un contrôle
   d'interface (`packages/app/src/ui/**`, `packages/app/src/styles/**`, `packages/ui-dom/**`). Le jeu
   se joue souris, clavier, manette et doigt, du téléphone à la 4K : je vérifie **moi-même**, au
   chrome-devtools sur Chromium, avant de te faire tester. Quatre axes : **clavier** (atteint aux
   flèches, par de vraies pressions depuis un contrôle voisin — jamais `.focus()` sur la cible),
   **manette**, **tactile** (hit-area ≥ 30 px sous `pointer: coarse`), **responsive** (568×320,
   667×375, 1024×768, 1920×1080, 2560×1440 — débordement, chevauchement, hit-areas). 🔴 **Mesurer,
   jamais supposer** : origine plan 198, une media query ajoutée « au cas où » que la mesure a montrée
   inutile. Détail et recette : `.claude/rules/multi-input.md`. Ce que je trouve, je le corrige ou je
   te le remonte **avant** les scénarios — pas la peine de te faire tester un écran cassé au pad.
1. Analyse `git diff HEAD` → scénarios observables (noms FR).
2. Par scénario : construis la config JSON **minimale** (seuls les champs nécessaires au scénario, le reste = défauts), moves/Pokemon validés (`packages/data` ; doute → agent `sandbox-json`). **Jamais coller la commande à l'humain.** Si le scénario demande à l'humain d'agir/déplacer/attaquer **avec la cible (Dummy)** → mettre `"dummyControl": "player"` (+ `dummyMoves`), **jamais laisser le défaut `"ai"`** (l'humain ne pourrait pas la contrôler).
3. **Boucle** : (a) **je lance moi-même** le serveur via `Bash run_in_background` (`pnpm dev:sandbox '{...}'` ; HMR ne suffit pas — config bakée à l'env au boot, donc relancer le process à chaque scénario). Port du checkout : `PT_PORT` env → `.worktree-port` à la racine → sinon `5173` (cf `vite.config.ts`) ; **en worktree c'est PAS 5173**. **Avant chaque relance : j'arrête d'abord MON process sandbox précédent** (`TaskStop` du background task — sûr et indépendant du port) pour **réutiliser le même port — jamais laisser vite incrémenter** (5174, 5175…). Je cible **uniquement mon process sandbox** : jamais un navigateur de l'humain, jamais son serveur dev global. (b) résumé en chat — **URL** (`http://localhost:<port résolu>`) + **quoi tester** (1-2 lignes) + **résultat attendu** (noms FR) ; (c) **pause**, tu testes ; (d) ta réponse `suivant`/`ok` → scénario suivant ; bug/retour → on traite avant de continuer.
4. Tous scénarios validés → arrêt 2, le menu.

#### Exceptions

- Changes purement config (`.claude/`, doc seule) sans code TS → pas d'arrêt recette, menu réduit (commit direct).
- Bug fix 1 ligne sans test → arrêt recette normal, `code-reviewer` sauté (il tourne sur du code, pas sur une ligne triviale).

### Règles fond

- Jamais > 1 agent long en foreground/turn — longs en background
- **Gate local** : `/ci-gate fast` (~43 s) = boucle d'itération, **tour des 10 écrans compris** ; `/ci-gate full` (~80 s sur un diff normal) = **BLOQUANT avant commit**, avec l'e2e ciblé par `scripts/e2e-affected.ts`. `slow` = filet exhaustif local (recours hors ligne)
- **Suite e2e complète = sur GitHub, asynchrone** (`.github/workflows/e2e.yml`, 531 tests en 8 tranches, **~5 min**, sur `push` vers `main` + chaque nuit). Elle **ne bloque jamais**. Verdict : `pnpm e2e:status` / skill `/e2e-status`, lu en tête de `/next`. 🔴 **On ne l'attend JAMAIS** (ni `gh run watch`, ni boucle de sondage) — décision #925. 🔴 **Pas de `/publish` sur un rouge** — décision #924
- Reporté → graphe de mémoire, entités `agenda`

## Skills

| Cmd | Action |
|-----|--------|
| `/next` | Résumé court + 2-3 candidats + recommandation |
| `/menu` (ou mot `menu`) | Affiche le menu de finalisation (arrêt 2) à la demande, même mid-session |
| `/review-local` | Review code changements locaux |
| `/ci-gate [fast\|full\|slow]` | Gate CI local (lint, typecheck, build, test, integration). BLOQUANT avant commit |
| `/commit` | Génère message commit conventional court via agent `commit-message`, puis commit + push directement. Pas de validation du message |
| `/worktree` | Crée/liste/supprime un git worktree (`.worktrees/<branche>/`) pour N sessions Claude en // : deps reflink-copiées (CoW, ≈0 disk), port Vite déterministe par worktree. `add <branche> [base] \| list \| status \| clean \| relink \| rm` |
