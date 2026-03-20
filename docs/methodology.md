# Méthodologie de travail — Pokemon Tactics

> Comment on travaille ensemble (humain + Claude Code).

---

## 1. Rôles

| Rôle | Qui | Responsabilités |
|------|-----|-----------------|
| **Directeur créatif / Architecte** | Toi | Vision du jeu, décisions de design, review du code, validation |
| **Développeur principal** | Claude Code | Écriture du code, tests, refactoring, implémentation |

---

## 2. Organisation de la documentation

```
docs/
├── game-design.md      # Vision, règles, mécaniques de jeu
├── architecture.md     # Stack technique, structure, principes
├── decisions.md        # Log des décisions + questions ouvertes
├── roadmap.md          # Phases de développement, todolist
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

### Pour un bug :
1. **Reproduire** — test qui échoue
2. **Fixer** — dans le core ou le renderer
3. **Vérifier** — le test passe, pas de régression

---

## 4. Conventions Git

- **Conventional commits** : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **Branches** : `main` (stable) + feature branches (`feat/aoe-patterns`, `fix/damage-calc`)
- **Pas de force push** sur main
- **Un commit = un changement cohérent**

---

## 5. Comment valider le visuel

Claude Code peut utiliser **Playwright MCP** pour :
- Lancer le jeu dans le navigateur
- Prendre des screenshots
- Interagir avec l'interface (cliquer, vérifier des éléments)

Le créateur peut aussi simplement ouvrir `localhost` après `pnpm dev`.

---

## 6. Comment gérer les décisions

- Toute décision importante va dans `docs/decisions.md`
- Les questions ouvertes y sont listées avec leur priorité
- On tranche au fil des conversations, pas besoin de tout décider d'avance
