# Structure du codebase

## Monorepo pnpm workspaces

```
pokemon-tactics/
├── packages/
│   ├── core/                    # Logique pure (combat, types, moves, abilities)
│   │   ├── src/
│   │   │   ├── battle/          # BattleEngine, BattleSetup, events
│   │   │   ├── move/            # Handlers, effects, tactical patterns
│   │   │   ├── pokemon/         # PokemonInstance, stats, nature, gender
│   │   │   ├── ability/         # AbilityHandler hooks
│   │   │   ├── status/          # Status types (paralysie, gel, sommeil…)
│   │   │   └── testing/         # Mocks factory (buildMoveTestEngine…)
│   │   └── package.json         # dependencies = {} (strict)
│   │
│   ├── data/                    # Données Pokemon
│   │   ├── src/                 # Loaders, roster-poc
│   │   ├── reference/*.json     # Auto-généré via `pnpm data:update`
│   │   └── reference/indexes/   # Knowledge base locale
│   │
│   ├── renderer/                # Phaser 4 (actuel)
│   │   ├── src/
│   │   │   ├── constants.ts     # Couleurs + DEPTH_* (jamais inline)
│   │   │   ├── scenes/          # TeamSelect, Battle, Sandbox…
│   │   │   └── i18n/            # fr.ts, en.ts
│   │
│   ├── renderer-babylon-spike/  # Phase 3.5 (différée après Phase 7)
│   │
│   └── ai-player/               # AI scoring, profils, AiTeamController
│
├── docs/
│   ├── plans/                   # xxx-name.md numérotés, statut en-tête
│   ├── game-design.md           # Mécaniques jeu
│   ├── architecture.md          # Structure technique
│   ├── decisions.md             # ADR
│   ├── roadmap.md               # Phases
│   ├── backlog.md               # Bugs + feedback non traités
│   ├── implementations.md       # Liste Pokemon/Moves/Abilities (✓/✗)
│   ├── methodology.md           # Workflow
│   ├── ai-system.md             # IA scoring/profils
│   ├── abilities-system.md      # Hooks talents
│   ├── design-system.md         # Constantes visuelles renderer
│   ├── isometric-height-rendering.md
│   ├── tileset-mapping.md
│   ├── agent-orchestration.md   # Détails agents + triggers
│   ├── next.md                  # Agenda persistant (lu par /next)
│   ├── reflexion-patterns-attaques.md
│   ├── references.md            # Comment résolu ailleurs
│   ├── roster-poc.md            # Pokemon + movesets prototype
│   └── references/
│       ├── babylon-gotchas.md   # Pièges Babylon
│       └── babylon-mcp-ecosystem.md
│
├── .claude/
│   ├── agents/                  # 27 agents projet
│   ├── rules/                   # Rules avec frontmatter paths: (conditionnel)
│   │   ├── core.md              # paths: packages/core/**
│   │   ├── data.md              # paths: packages/data/**
│   │   ├── renderer.md          # paths: packages/renderer/**
│   │   ├── renderer-babylon.md  # paths: packages/renderer-babylon*/**
│   │   ├── tests.md             # paths: **/*.test.ts
│   │   └── quality.md           # transversal (toujours chargé)
│   ├── hooks/                   # block-forbidden-commands.sh
│   └── skills/                  # next, review-local
│
├── .understand-anything/        # Knowledge graph (1008 nodes, 2405 edges, autoUpdate: true)
├── .serena/                     # Onboarding Serena (memories)
├── CLAUDE.md                    # Instructions Claude (95 lignes, compressé plan 080)
├── STATUS.md                    # État courant projet
└── pnpm-workspace.yaml
```

## Patterns clés

### Effets de moves (core)
Handlers enregistrés via `registerEffectHandler`. **Jamais switch/case**.

### Abilities (core)
Hooks via `AbilityHandler` interface : `onDamageModify`, `onAfterDamageDealt`, `onEndTurn`, `blocksRecoil`, `preventsCrit`, `onSecondaryEffectBlocked`, etc.

### Tests scénario
Pattern Gherkin (Given/When/Then) avec `buildMoveTestEngine`. 1188+ tests unitaires, 166+ tests intégration.

### Spawn zones Tiled
1 layer par format (`spawns-1v1`, `spawns-2v2`…), pas property `teamCount` unique.

### Sprites flying fallback
Pokemon volants sans anim dédiée : fallback **Hop**, pas Walk.
