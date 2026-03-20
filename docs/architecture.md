# Architecture technique — Pokemon Tactics

> Pour le game design, voir [game-design.md](game-design.md).
> Pour les décisions, voir [decisions.md](decisions.md).

---

## 1. Principe fondamental : moteur découplé du rendu

```
┌──────────────────────────────────────────────────┐
│                   @core                           │
│  (logique pure — ZERO dépendance UI/rendu)        │
│                                                   │
│  - État du combat (grille, créatures, tours)      │
│  - Calculs (dégâts, types, portée, AoE, LOS)     │
│  - Pathfinding, initiative                        │
│  - Validation des actions                         │
│  - Génération du log de combat (replay)           │
│                                                   │
│  API : recevoir des actions, retourner un état    │
└───────────┬──────────────┬───────────────┬────────┘
            │              │               │
 ┌──────────▼──┐   ┌──────▼──────┐  ┌─────▼─────────┐
 │  @renderer  │   │ @ai-player  │  │  Text / CLI   │
 │  (Phaser)   │   │ (LLM, MCTS, │  │  (debug,      │
 │             │   │  MCP server) │  │   replay,     │
 │             │   │              │  │   tests)      │
 └─────────────┘   └─────────────┘  └───────────────┘
```

**Avantages :**
- Changer de renderer sans toucher à la logique (Phaser → Three.js → Godot)
- Faire jouer des IA sans interface graphique
- Tests unitaires sur la logique pure
- Mode headless : 1000 combats en quelques secondes (équilibrage)
- Replays rejouables dans n'importe quel renderer

---

## 2. Stack

| | |
|---|---|
| Langage | TypeScript (strict mode) |
| Runtime | Node.js (dev/tests/AI) + Navigateur (jeu) |
| Bundler | Vite |
| Renderer | Phaser 4 (→ Three.js possible plus tard pour HD-2D avancé) |
| Tests | Vitest (core) + Playwright (rendu) |
| Linter/Formatter | Biome (remplace ESLint + Prettier + Stylelint) |
| Package manager | pnpm |
| Monorepo | pnpm workspaces |
| Versionning | Git + conventional commits |

---

## 3. Structure monorepo

```
pokemon-tactic/
├── packages/
│   ├── core/                    # Moteur de jeu pur (ZERO dépendance UI)
│   │   ├── src/
│   │   │   ├── models/          # Types : Pokemon, Move, Ability, Item, Terrain
│   │   │   ├── battle/          # BattleEngine, TurnManager, DamageCalc
│   │   │   ├── grid/            # Grid, Pathfinding, AoE, LineOfSight
│   │   │   ├── types/           # TypeChart (18 types, efficacité)
│   │   │   ├── replay/          # ReplayRecorder, ReplayPlayer
│   │   │   └── index.ts         # API publique du core
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── renderer/                # Interface graphique (Phaser)
│   │   ├── src/
│   │   │   ├── scenes/          # Phaser scenes (BattleScene, MenuScene)
│   │   │   ├── sprites/         # Gestion des sprites Pokemon
│   │   │   ├── ui/              # HUD, menus, barres de PV
│   │   │   ├── grid/            # Rendu isométrique de la grille
│   │   │   └── main.ts
│   │   ├── public/
│   │   │   └── assets/          # Sprites, tilesets, sons
│   │   └── package.json
│   │
│   ├── ai-player/               # Joueurs IA
│   │   ├── src/
│   │   │   ├── random.ts        # IA aléatoire (baseline)
│   │   │   ├── heuristic.ts     # IA à heuristiques
│   │   │   ├── llm.ts           # IA LLM (Claude API)
│   │   │   └── mcp-server.ts    # Exposer le moteur comme MCP server
│   │   └── package.json
│   │
│   └── data/                    # Données Pokemon (partagées)
│       ├── pokemon.json         # Stats officielles
│       ├── moves.json           # Attaques + AoE patterns + portée
│       ├── abilities.json       # Talents
│       ├── items.json           # Objets tenus
│       └── type-chart.json      # Tableau des types
│
├── package.json                 # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.json
├── biome.json                   # Config Biome (lint + format)
├── vitest.config.ts
├── CLAUDE.md
├── docs/
└── plans/                       # Plans d'exécution numérotés
```

---

## 4. API du core

Le core expose une interface simple que tout joueur (humain ou IA) utilise :

```typescript
// Le moteur donne l'état visible pour le joueur actif
getGameState(playerId: string): GameState

// Le moteur donne les actions légales
getLegalActions(playerId: string): Action[]

// Le joueur soumet une action
submitAction(playerId: string, action: Action): ActionResult
```

---

## 5. Système de replay

```typescript
interface BattleReplay {
  initialState: BattleState   // état au début (grille, placements, équipes)
  actions: Action[]            // chaque action jouée dans l'ordre
  randomSeed: number           // pour reproduire l'aléatoire (crits, miss...)
}
```

Le replay est **déterministe** : même seed + mêmes actions = même résultat.

---

## 6. Outillage Claude Code

| Besoin | Solution |
|--------|----------|
| Écrire du code | Claude Code + TypeScript (natif) |
| Lancer le jeu | `pnpm dev` → Vite dev server |
| Voir le rendu | MCP Playwright — screenshots, interaction |
| Tests | `pnpm test` (Vitest) |
| Faire jouer une IA | Script Node.js important le core |
| Voir un replay | Charger le JSON dans le renderer web |

---

## 7. Évolutions prévues du renderer

| Phase | Renderer | Style |
|-------|----------|-------|
| POC | Phaser 4 (2D isométrique) | Sprites + tiles isométriques |
| HD-2D | **Babylon.js** ou Three.js (spike comparatif prévu) | Terrain 3D + sprites 2D billboardés + DoF/bloom |
| Optionnel | Godot (desktop) | HD-2D natif, rendu Vulkan |

Babylon.js = built-in post-processing (DoF, bloom, tilt-shift), écrit en TypeScript, `NullEngine` pour tests headless.
Three.js = plus léger, plus grande communauté. Spike comparatif quand on atteindra la phase HD-2D.

Le core ne change jamais — seul le renderer est remplacé.

---

## 8. Agents & Skills Claude Code

Agents custom dans `.claude/agents/` et skills dans `.claude/commands/` pour automatiser le workflow.

| Agent | Rôle |
|-------|------|
| `game-engine.md` | Expert Phaser 4 + combat tactique |
| `core-guardian.md` | Vérifie que core n'a aucune dépendance UI |
| `test-writer.md` | Écrit les tests Vitest, test-first |
| `code-reviewer.md` | Review : strict TS, CLAUDE.md, conventions |

| Skill | Action |
|-------|--------|
| `/review` | Review code contre CLAUDE.md |
| `/next` | Lit roadmap + plan en cours, propose la suite |
| `/balance` | Lance N combats headless, analyse winrates |
| `/sprite <name>` | Récupère et convertit un sprite PMDCollab |
