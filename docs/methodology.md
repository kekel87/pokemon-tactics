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

```
docs/
├── game-design.md      # Vision, règles, mécaniques de jeu
├── architecture.md     # Stack technique, structure, principes
├── decisions.md        # Log des décisions + questions ouvertes
├── roster-poc.md       # Pokemon et movesets du prototype
├── roadmap.md          # Phases de développement, todolist
├── references.md       # Projets d'inspiration et ressources
└── methodology.md      # Ce document — comment on travaille
```

- **CLAUDE.md** (racine) : instructions permanentes pour Claude Code
- **README.md** (racine) : présentation du projet pour un nouveau venu
- La doc est en **français**, le code en **anglais**

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

---

## 6. Comment valider le visuel

Claude Code peut utiliser **Playwright MCP** pour :
- Lancer le jeu dans le navigateur
- Prendre des screenshots
- Interagir avec l'interface (cliquer, vérifier des éléments)

L'humain peut aussi simplement ouvrir `localhost` après `pnpm dev`.

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

- Toute décision importante va dans `docs/decisions.md`
- Les questions ouvertes y sont listées avec leur priorité
- On tranche au fil des conversations, pas besoin de tout décider d'avance
