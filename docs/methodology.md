# Méthodologie de travail — Pokemon Tactics

> Comment on travaille ensemble (humain + Claude Code).

---

## 1. Rôles

| Rôle | Qui | Responsabilités |
|------|-----|-----------------|
| **L'humain** | Toi | Vision du jeu, décisions de design, review du code, validation |
| **Développeur principal** | Claude Code | Écriture du code, tests, refactoring, implémentation |

---

## 2. Organisation de la documentation

La mémoire du projet est **coupée en deux** depuis le plan 200 : ce qui décrit le projet **tel qu'il
est** reste un fichier ; ce qui raconte **comment on y est arrivé** vit dans un graphe.

### Les documents (fichiers markdown, versionnés)

Ils décrivent l'état courant. On les lit en entier, on les corrige quand la réalité change.

| Document | Contenu |
|---|---|
| `docs/game-design.md` | Vision, règles, mécaniques de jeu |
| `docs/architecture.md` | Stack technique, structure, patterns |
| `docs/roadmap.md` | Phases de développement — **la vitrine**, lisible par un visiteur du dépôt |
| `docs/design-system.md` | Couleurs, échelles, constantes visuelles |
| `docs/multiplayer.md` | Architecture réseau P2P |
| `docs/ai-system.md`, `docs/abilities-system.md` | Systèmes IA et talents |
| `docs/isometric-height-rendering.md`, `docs/tileset-mapping.md`, `docs/babylon/*`, `docs/references/*` | Rendu, tilesets, notes techniques de référence |
| `docs/references.md` | Projets d'inspiration et ressources |
| `docs/glossary.md` | Vocabulaire du projet |
| `docs/methodology.md` | Ce document — comment on travaille |
| `docs/plans/` | **Uniquement les plans en cours.** Un plan terminé part au graphe et son fichier est supprimé (cf. `docs/plans/README.md`) |
| `CLAUDE.md` (racine) | Instructions permanentes pour Claude Code |
| `README.md`, `CREDITS.md` (racine) | Présentation du projet et sources, pour un nouveau venu |
| `.claude/rules/`, `.claude/agents/`, `.claude/skills/` | Règles par package, contrats d'agents, commandes |

### Le graphe de mémoire (SQLite, interrogeable)

Il porte l'**historique** : décisions et leur pourquoi, agenda, dette, retours de playtest, plans
clos, cahier de recette. On l'**interroge**, on ne le lit pas en entier.

```bash
node scripts/memory/query.mjs "2 à 4 mots-clés distinctifs"   # jamais une phrase
node scripts/memory/query.mjs --open <nom-entité>             # détail complet
node scripts/memory/query.mjs --stats                         # inventaire
```

Types d'entités : `decision`, `agenda`, `historique`, `backlog`, `backlog-résolu`, `feedback`,
`question-ouverte`, `révision`, `implémentation`, `idée`. Un plan clos est une entité nommée
`plan-<numéro>` ; le cahier de recette vit dans les entités `recette`.

Conventions d'écriture : une décision = une entité `decision-<n>` avec ses observations `Date :`,
`Question :`, `Décision :`, `Contexte :` — **le contexte porte le POURQUOI**, c'est ce qui a de la
valeur. Une décision qui en révise une autre s'y **relie**, elle ne la réécrit pas. Un bug résolu
change de type (`backlog` → `backlog-résolu`) ; on ne supprime rien.

🔴 Aucune dette n'est enregistrée comme « acceptée » sans accord explicite de l'humain.

🔴 `STATUS.md`, `docs/decisions.md`, `docs/next.md`, `docs/backlog.md`, `docs/backlog-archive.md`,
`docs/implementations.md`, `docs/test-plan.md` et 198 plans **n'existent plus** — leur contenu est
dans le graphe. **Les recréer annulerait la migration en silence.**

**Pourquoi** : ces fichiers grossissaient sans borne (`decisions.md` : 528 Ko, `STATUS.md` : 298 Ko),
étaient devenus illisibles d'un bloc, et l'instruction « lis-les si tu hésites » n'était plus
exécutable. Un graphe se lit par tranche pertinente, à coût constant.

Dans les deux cas : la doc est en **français**, le code en **anglais**.

---

## 3. Workflow de développement

### Pour une nouvelle feature :
1. **Discussion** — on en parle, on clarifie le besoin
2. **Plan** — Claude Code propose un plan d'implémentation
3. **Core d'abord** — logique pure + tests
4. **Renderer ensuite** — affichage visuel
5. **Review** — tu valides (code + visuellement via Playwright screenshots)
6. **Commit** — conventional commit, feature branch si besoin

### Orchestration automatique des agents :
Après chaque étape significative, les agents pertinents sont lancés sans attendre qu'on le demande :
- Modif dans `packages/core/` → `core-guardian` (+ `test-writer` si nouvelle mécanique)
- Avant un commit → `code-reviewer` (qui propose le titre de commit si pas de bloquant)
- Après un ensemble de changements → `doc-keeper`

Voir `CLAUDE.md` pour la table complète des déclencheurs.

### Pour un bug :
1. **Reproduire** — test qui échoue
2. **Fixer** — dans le core ou le renderer
3. **Vérifier** — le test passe, pas de régression

---

## 4. Conventions de code

- **Pas d'abréviations** : nommer les variables comme leur type (`traversalContext: TraversalContext`)
- **Const object enum** : `{ Key: "value" } as const` + type dérivé (pas d'enum TS natif)
- **1 fichier = 1 interface/type**
- **Pas de commentaires** sauf algo complexe
- **Pas de tests sur les types/barrels** — la compilation est la validation
- **Fail-fast, KISS**

### Niveaux de test

| Niveau | Fichier | Commande | Coverage |
|--------|---------|----------|----------|
| **Unit** | `packages/*/src/**/*.test.ts` | `pnpm test` | 100% threshold (bloquant) |
| **Intégration** | `packages/*/src/**/*.integration.test.ts` | `pnpm test:integration` | Mesuré, pas de threshold |
| **Scénario** | `scenarios/**/*.scenario.test.ts` | `pnpm test:scenario` | Non |
| **E2E visuel** | Playwright (séparé) | — | Non |
| **Tous** | — | `pnpm test:all` | — |

- **Unit** : 1 fonction/classe isolée, dépendances externes mockées
- **Intégration** : teste les interactions entre composants (ex: targeting + Grid)
- **Scénario** : combat complet headless (seed déterministe pour replay)
- **E2E visuel** : Playwright screenshots du renderer (quand il sera en place)

Un test d'intégration est utile quand il vérifie un **contrat entre composants** qu'aucun test unitaire ne couvre. S'il peut être testé en unit, c'est un unit test.

### Règle dure — un test positionnel par move

**Tout move implémenté DOIT avoir son fichier `packages/core/src/battle/moves/<id>.test.ts`** (scénario positionnel bout en bout : touche/touche pas selon la position, effet appliqué). Conventions détaillées : entité `plan-108` du graphe de mémoire.

Garde-fou : `move-test-coverage.test.ts` énumère `loadData().moves` et **échoue la CI** si un move n'a pas de test. **Sans allowlist de couverture.** Donc tout plan qui ajoute des moves (batch contenu compris) inclut les tests par move dans le même plan — sinon la CI est rouge.

### Conventions de test
- **Mocks centralisés** dans `testing/` : `abstract class MockX { static readonly ... }`
- **Données pures, pas de logique** : pas de helper `createInstance()` avec `Partial<T>`
- **Variations par spread** dans le test : `{ ...MockPokemon.base, position: { x: 2, y: 2 } }`
- **Coverage 100%** sur `packages/core` (threshold bloquant, unit seulement)
- Les types/enums/barrels/mocks sont exclus du coverage

## 5. Conventions Git

- **Conventional commits** : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- **Branches** : `main` (stable) + feature branches (`feat/aoe-patterns`, `fix/damage-calc`)
- **Pas de force push** sur main
- **Un commit = un changement cohérent**
- **Titre de commit proposé automatiquement** par le code-reviewer après chaque review sans bloquant — une seule ligne, format conventional commits

### Workflow worktrees — sessions parallèles

Pour développer plusieurs features simultanément (N sessions Claude en parallèle) :

```bash
/worktree add feat/ma-feature   # crée .worktrees/feat-ma-feature/, deps CoW, port auto
/worktree list                  # état des worktrees actifs
/worktree clean                 # supprime les worktrees déjà mergés dans main
```

Chaque worktree est isolé : sa propre branche, ses propres `node_modules` (reflink-copy si lockfile identique, sinon `pnpm install`), son propre port Vite (5174+).

**Merge vers main** : Claude peut faire `git merge --ff-only <branche>` si la branche est en avance linéaire. Sinon, l'humain merge via GUI.

Détails techniques : `docs/architecture.md` section 10b.

---

## 6. Comment valider le visuel

Claude Code peut utiliser **Playwright MCP** pour :
- Lancer le jeu dans le navigateur
- Prendre des screenshots
- Interagir avec l'interface (cliquer, vérifier des éléments)

L'humain peut aussi simplement ouvrir `localhost` après `pnpm dev`.

### Un contrôle d'interface se valide sur 4 axes, mesurés

Depuis la Phase 6.5, le jeu se joue à la **souris**, au **clavier**, à la **manette** et au **doigt**,
du téléphone à la 4K. Un screenshot ne dit ni si un contrôle est atteignable au clavier, ni si une
zone tapable fait 30 px : ces vérifications se **mesurent**.

Dès que le diff touche `packages/app/src/ui/**`, `packages/app/src/styles/**` ou `packages/ui-dom/**`,
cette passe est l'**étape 0 de `human-testing`** : Claude mesure seul, au chrome-devtools, *avant* de
dérouler les scénarios — pour ne pas faire tester un écran cassé à la manette. Les quatre axes, la
recette de mesure et les viewports de référence sont dans **`.claude/rules/multi-input.md`**.

🔴 **Mesurer, jamais supposer.** Origine : plan 198, une media query responsive ajoutée « au cas où »
que la mesure a montrée inutile — 240 px de marge restaient au viewport le plus étroit. Pour prouver
qu'une règle responsive sert, la neutraliser et re-mesurer.

---

## 7. Boucles de feedback temps réel

Claude Code dispose d'un tool **Monitor** qui lance un process long en arrière-plan et émet une notification dans la conversation à chaque ligne stdout du script. Pratique pour surveiller les tests (ou n'importe quel autre process long) pendant qu'on continue à coder, sans avoir à relancer la commande manuellement entre deux edits.

### Quand l'utiliser
- Refacto sur `packages/core/` qui risque de casser des tests en cascade
- Modif transversale où on veut savoir immédiatement si un edit casse quelque chose
- En général, toute session où "relancer les tests après chaque changement" serait utile mais fastidieux

### Recette validée : vitest unit en watch

```bash
pnpm exec vitest --watch --project unit 2>&1 \
  | grep --line-buffered -E "(FAIL |failed|❯|Error: )"
```

**Important** :
- Lancer depuis la **racine du monorepo**, pas depuis un package (`pnpm --filter` ne marche pas ici : vitest résout le glob `packages/*/src/**` relativement au CWD, et depuis un sous-package ça donne "No test files found")
- Le `--line-buffered` sur `grep` est critique — sans lui, les events sont bufferisés par paquets et arrivent avec plusieurs minutes de retard
- Le filtre n'émet que les échecs, pas les passes silencieux : pas de bruit quand tout va bien

À la fin de la session, stopper le Monitor (TaskStop).

### Règle

**Ne pas documenter de recettes non testées.** Si une nouvelle situation appelle un Monitor (vite dev, `tsc --watch`, surveillance d'un process externe, etc.), la valider à chaud dans une vraie session avant de l'ajouter ici. Une recette qui ne marche pas pollue ce fichier plus qu'elle ne sert.

---

## 8. Comment gérer les décisions

- Toute décision importante va dans le graphe de mémoire (entités `decision`)
- Les questions ouvertes y sont listées avec leur priorité
- On tranche au fil des conversations, pas besoin de tout décider d'avance
