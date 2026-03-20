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

## 4. Système d'attaques : composition Targeting + Effects

Chaque attaque est **déclarative** (données, pas du code custom). Définie par deux axes :
- **Targeting** : comment on cible (pattern spatial)
- **Effects** : ce qui arrive aux cibles (dégâts, statut, buff, lien...)

```typescript
interface MoveDefinition {
  id: string;
  type: PokemonType;
  category: 'physical' | 'special' | 'status';
  power: number;
  accuracy: number;
  pp: number;
  targeting: TargetingPattern;
  effects: Effect[];
}

// Patterns de ciblage — discriminated union, extensible
type TargetingPattern =
  | { kind: 'single'; range: { min: number; max: number } }
  | { kind: 'self' }
  | { kind: 'cone'; range: { min: number; max: number }; width: number }
  | { kind: 'cross'; range: { min: number; max: number }; size: number }
  | { kind: 'line'; length: number }
  | { kind: 'dash'; maxDistance: number }
  | { kind: 'zone'; radius: number }

// Effets — composables, une attaque peut en avoir plusieurs
type Effect =
  | { kind: 'damage' }
  | { kind: 'status'; status: StatusType; chance: number }
  | { kind: 'stat_change'; stat: Stat; stages: number; target: 'self' | 'targets' }
  | { kind: 'link'; linkType: string; duration: number;
      maxRange: number; drainFraction: number }
```

**Exécution en 3 étapes :**
1. `resolveTargeting(move, caster, targetTile, grid)` → tiles affectées
2. `resolveEffects(move, caster, affectedTiles, state)` → précision, dégâts, statuts
3. `emit(events)` → liste d'événements

Chaque `kind` de targeting a un **resolver** (pure function). Chaque `kind` d'effect a un **processor**.
Ajouter une nouvelle mécanique = ajouter un `kind` dans l'union + son resolver/processor. Pas de refactor.

---

## 5. Système d'événements : core → renderer

Le core est **synchrone** et émet des événements. Les consommateurs (renderer, replay, IA, CLI) les traitent comme ils veulent.

```typescript
type BattleEvent =
  | { type: 'turn_started'; pokemonId: string }
  | { type: 'move_started'; attackerId: string; moveId: string }
  | { type: 'pokemon_moved'; pokemonId: string; path: Position[] }
  | { type: 'pokemon_dashed'; pokemonId: string; path: Position[]; hitId?: string }
  | { type: 'damage_dealt'; targetId: string; amount: number; effectiveness: number }
  | { type: 'status_applied'; targetId: string; status: StatusType }
  | { type: 'stat_changed'; targetId: string; stat: Stat; stages: number }
  | { type: 'link_created'; sourceId: string; targetId: string; linkType: string }
  | { type: 'link_drained'; sourceId: string; targetId: string; amount: number }
  | { type: 'link_broken'; sourceId: string; targetId: string }
  | { type: 'pokemon_ko'; pokemonId: string; countdownStart: number }
  | { type: 'pokemon_eliminated'; pokemonId: string }
  | ...
```

**Le core n'attend jamais le renderer.** Un `submitAction()` est synchrone :
il mute l'état, émet les events, et retourne. L'IA peut donc jouer des milliers
de parties par seconde sans aucun overhead visuel.

**Le renderer gère sa propre queue d'animations.** Il reçoit les events,
les empile, et les joue séquentiellement avec des tweens/animations Phaser.
Le joueur humain attend la fin des animations avant d'agir.

```
Core (sync)          Renderer (async)         IA (sync)
    │                     │                      │
    ├── emit(events) ────►│ queue + animate       │
    │                     │   await tween...      │
    │                     │   await tween...      │
    │                     │   done → unlock UI    │
    │                     │                      │
    ├── emit(events) ◄───────────────────────────┤ submitAction() → instant
    │                     │                      │
```

Les mêmes events alimentent les **replays** (sérialisation JSON).

---

## 6. Système de surcharge (override) pour l'équilibrage

### Structure des données

```
packages/data/
  base/                    # Données Pokemon officielles (importables de Showdown)
    moves.ts               # power, accuracy, pp, type, category...
    pokemon.ts             # stats, types, poids, movepool...
    type-chart.ts          # 18x18 efficacités

  overrides/
    tactical.ts            # Ajoute targeting + effects (n'existe pas dans Pokemon)
    balance-v1.ts          # Ajustements numériques (PP, chances, portées...)
```

### Merge par couches

```
Données finales = deepMerge(base, tactical, balance)
```

- **base** : données Pokemon pures (power, accuracy, pp, type...)
- **tactical** : ajoute targeting + effects (la couche "grille tactique")
- **balance** : tweaks numériques par-dessus

Les overrides sont **optionnels et additifs**. Changer de balance = changer un fichier.
Permet de proposer des rulesets/métas différents plus tard.

### Validation au startup

Un validateur vérifie au démarrage que chaque entité finale est complète et cohérente :
- Chaque move a un targeting et au moins un effect
- Chaque pokemon référence des moves qui existent
- Les ids sont uniques, pas de référence cassée
- Erreur explicite si une override casse la structure

Léger en coût (ne tourne qu'une fois au boot), gros gain en confiance sur les données.

---

## 7. API du core

Le core expose une interface simple que tout joueur (humain ou IA) utilise :

```typescript
interface BattleEngine {
  // État visible pour le joueur actif
  getGameState(playerId: string): GameState;

  // Actions légales (l'IA itère là-dessus)
  getLegalActions(playerId: string): Action[];

  // Soumettre une action — synchrone, retourne le résultat + events
  submitAction(playerId: string, action: Action): ActionResult;

  // Souscrire aux événements (renderer, replay, debug)
  on(event: string, handler: (e: BattleEvent) => void): void;
}
```

---

## 8. Système de replay

```typescript
interface BattleReplay {
  initialState: BattleState   // état au début (grille, placements, équipes)
  actions: Action[]            // chaque action jouée dans l'ordre
  randomSeed: number           // pour reproduire l'aléatoire (crits, miss...)
}
```

Le replay est **déterministe** : même seed + mêmes actions = même résultat.

---

## 9. Outillage Claude Code

| Besoin | Solution |
|--------|----------|
| Écrire du code | Claude Code + TypeScript (natif) |
| Lancer le jeu | `pnpm dev` → Vite dev server |
| Voir le rendu | MCP Playwright — screenshots, interaction |
| Tests | `pnpm test` (Vitest) |
| Faire jouer une IA | Script Node.js important le core |
| Voir un replay | Charger le JSON dans le renderer web |

---

## 10. Évolutions prévues du renderer

| Phase | Renderer | Style |
|-------|----------|-------|
| POC | Phaser 4 (2D isométrique) | Sprites + tiles isométriques |
| HD-2D | **Babylon.js** ou Three.js (spike comparatif prévu) | Terrain 3D + sprites 2D billboardés + DoF/bloom |
| Optionnel | Godot (desktop) | HD-2D natif, rendu Vulkan |

Babylon.js = built-in post-processing (DoF, bloom, tilt-shift), écrit en TypeScript, `NullEngine` pour tests headless.
Three.js = plus léger, plus grande communauté. Spike comparatif quand on atteindra la phase HD-2D.

Le core ne change jamais — seul le renderer est remplacé.

---

## 11. Agents & Skills Claude Code

Agents custom dans `.claude/agents/` et skills dans `.claude/commands/` pour automatiser le workflow.

### Agents actifs

| Agent | Modèle | Rôle |
|-------|--------|------|
| `core-guardian` | haiku | Vérifie que core n'a aucune dépendance UI |
| `doc-keeper` | sonnet | Maintient la documentation à jour |
| `code-reviewer` | sonnet | Review qualité, TS strict, conventions |
| `game-designer` | sonnet | Cohérence et équilibre des mécaniques |
| `visual-analyst` | sonnet | Analyse visuels + web search pour inspiration |
| `session-closer` | sonnet | Met à jour STATUS.md en fin de session |
| `test-writer` | sonnet | Tests Vitest, approche test-first |
| `data-miner` | sonnet | Import données Pokemon (Showdown/PokeAPI) |
| `dependency-manager` | sonnet | Gestion des dépendances npm du monorepo |
| `best-practices` | sonnet | Recherche de bonnes pratiques du marché |
| `asset-manager` | sonnet | Gestion des assets (sprites, tilesets, sons) |
| `plan-reviewer` | sonnet | Crée, review et maintient les plans |
| `performance-profiler` | sonnet | Analyse performances (FPS, mémoire, bundle) |
| `debugger` | opus | Diagnostic de bugs complexes |
| `ci-setup` | sonnet | Configuration GitHub Actions |
| `agent-manager` | sonnet | Audite et maintient les agents/skills (format, cohérence, qualité) |

### Agents placeholder (à activer plus tard)

| Agent | Rôle | Phase |
|-------|------|-------|
| `ai-player` | Playtester automatisé via API core | Phase 1 |
| `balancer` | Analyse winrates, propose des overrides | Phase 2-3 |
| `level-designer` | Crée et valide des maps JSON | Phase 1-2 |

### Skills

| Commande | Action |
|----------|--------|
| `/next` | Lit STATUS.md + roadmap, propose la suite |
| `/review` | Lance code-reviewer sur les changements |
| `/status` | Met à jour STATUS.md (fin de session) |
| `/inspire <jeu>` | Analyse visuelle pour inspiration |
| `/plan <titre>` | Crée ou review un plan d'exécution |
| `/debug <bug>` | Diagnostic avancé (agent debugger, opus) |
| `/practices <sujet>` | Recherche bonnes pratiques du marché |
