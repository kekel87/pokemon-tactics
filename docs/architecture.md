# Architecture technique — Pokemon Tactics

> Game design : [game-design.md](game-design.md). Décisions : [decisions.md](decisions.md).

---

## 1. Principe fondamental : moteur découplé du rendu

```
┌──────────────────────────────────────────────────┐
│                   @core                           │
│  (logique pure — ZERO dépendance UI/rendu)        │
│                                                   │
│  - État du combat (grille, Pokemon, tours)          │
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
- Changer renderer sans toucher logique (Phaser → Three.js → Godot)
- Faire jouer des IA sans UI
- Tests unitaires sur logique pure
- Mode headless : 1000 combats en secondes (équilibrage)
- Replays rejouables dans n'importe quel renderer

### Diagramme des packages

```mermaid
graph TD
    data["@pokemon-tactic/data<br/>(Pokemon, moves, type-chart)"]
    core["@pokemon-tactic/core<br/>(moteur pur, zéro UI)"]
    renderer["@pokemon-tactic/renderer<br/>(Phaser 4)"]
    ai["@pokemon-tactic/ai-player<br/>(LLM, MCTS, MCP)"]

    data --> core
    core --> renderer
    core --> ai
```

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
pokemon-tactics/
├── packages/
│   ├── core/                    # Moteur de jeu pur (ZERO dépendance UI)
│   │   ├── src/
│   │   │   ├── enums/           # Const object enums (PokemonType, Direction, TargetingKind...)
│   │   │   ├── types/           # Interfaces (1 fichier = 1 type)
│   │   │   ├── utils/           # Fonctions pures (math, direction, géométrie)
│   │   │   ├── grid/            # Grid, Pathfinding, Targeting resolvers
│   │   │   ├── battle/          # BattleEngine, TurnManager, effect handlers, turn pipeline
│   │   │   ├── testing/         # Mocks centralisés (MockPokemon...)
│   │   │   └── index.ts         # Barrel export (API publique)
│   │   ├── tsconfig.json        # extends ../../tsconfig.base.json
│   │   └── package.json
│   │
│   ├── renderer/                # Interface graphique (Phaser 4)
│   │   ├── src/
│   │   │   ├── scenes/          # Scènes Phaser : MainMenuScene → BattleModeScene → TeamSelectScene → BattleScene + BattleUIScene overlay ; SettingsScene, CreditsScene ; MapPreviewScene (pnpm dev:map)
│   │   │   ├── maps/            # Chargement cartes Tiled au runtime (loadTiledMap)
│   │   │   ├── game/            # Orchestration (GameController, BattleSetup, AnimationQueue, DummyAiController)
│   │   │   ├── grid/            # Rendu isométrique (IsometricGrid : highlightGraphics, enemyRangeGraphics layer dédié, curseur animé)
│   │   │   ├── sprites/         # Sprites Pokemon (PokemonSprite, SpriteLoader, barres PV)
│   │   │   ├── i18n/            # Système i18n maison : types.ts, locales/fr.ts, locales/en.ts, index.ts (t, setLanguage, detectLanguage, onLanguageChange, Language enum)
│   │   │   ├── settings/        # Paramètres persistants : GameSettings { damagePreview }, getSettings(), updateSettings(), localStorage("pt-settings")
│   │   │   ├── ui/              # Interface FFT-like (ActionMenu, InfoPanel, TurnTimeline, BattleUI, DirectionPicker, PlacementRosterPanel, MoveTooltip, pattern-preview, SandboxPanel, LanguageToggle, TeamSelectPanel, BattleLogPanel, BattleLogFormatter)
│   │   │   ├── utils/           # Utilitaires renderer (screen-direction : getDirectionFromScreenPosition)
│   │   │   ├── enums/           # Enums renderer (HighlightKind — dont EnemyRange)
│   │   │   ├── types/           # Types renderer (BattleConfig : confirmAttack)
│   │   │   ├── constants.ts     # Depth centralisé, couleurs équipe, tailles UI, POKEMON_SPRITE_SCALE, TILE_SPRITE_SCALE, TERRAIN_TEXTURE_MAP, POKEMON_SPRITE_GROUND_OFFSET_Y, DEPTH_GRID_PREVIEW, DEPTH_GRID_ENEMY_RANGE, TILE_PREVIEW_COLOR, TILE_HIGHLIGHT_ENEMY_RANGE_COLOR, STATUS_ICON_KEY, HP_COLOR_MEDIUM, STAT_BADGE_BUFF_COLOR, STAT_BADGE_DEBUFF_COLOR, BattleLogColors, couleurs tooltip/buttons/text centralisées
│   │   │   └── main.ts
│   │   ├── public/
│   │   │   └── assets/
│   │   │       ├── sprites/pokemon/{name}/  # atlas.json, atlas.png, portrait-normal.png, credits.txt, offsets.json (générés)
│   │   │       ├── tilesets/terrain/        # tileset.png (custom PMD-based, 32×32px, 74 tiles, 11 terrains solides + 4 liquides) + tileset.tsj (tileset Tiled externe partagé par tous les .tmj)
│   │   │       ├── maps/                    # Cartes Tiled (.tmj) servies au runtime (roster racine : simple-arena, highlands ; dev/ : sandbox-*, debug-*, tile-palette, decorations-demo)
│   │   │       └── ui/
│   │   │           ├── arrows.png           # Spritesheet flèches DirectionPicker
│   │   │           ├── types/               # Type icons Pokepedia ZA : {type}.png, 36x36px sans texte (18 types)
│   │   │           ├── categories/          # Category icons Bulbagarden SV : physical.png, special.png, status.png — 50x40px
│   │   │           └── statuses/            # Status icons Pokepedia ZA : icon-{status}.png (52x36), label-{status}.png (172x36) — 7 statuts majeurs
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json        # extends base + DOM libs
│   │   └── package.json
│   │
│   └── data/                    # Données Pokemon (partagées)
│       ├── src/
│       │   ├── abilities/       # Définitions talents : ability-definitions.ts (20 AbilityDefinition), index.ts
│       │   ├── items/           # Définitions objets tenus : item-definitions.ts (12 HeldItemDefinition), load-items.ts
│       │   ├── roster/          # Roster POC : roster-poc.ts — 21 Pokemon avec movepool curation (plan 049)
│       │   ├── loaders/         # Loaders séparés : load-pokemon.ts, load-moves.ts, load-type-chart.ts (plan 049)
│       │   ├── overrides/       # Surcharges tactiques + balance
│       │   ├── maps/            # Cartes statiques TS (poc-arena 12×20, sandbox-arena 6×6)
│       │   ├── tiled/           # Parser Tiled JSON → MapDefinition (plan 045)
│       │   │   ├── tiled-types.ts          # Interfaces TiledMap, TiledLayer, TiledObject, TiledTileset, TiledTile, TiledProperty
│       │   │   ├── tileset-resolver.ts     # resolveTileProperties(gid, tileset) → { terrain, height }
│       │   │   ├── parse-terrain-layer.ts  # TiledLayer → TileState[][]
│       │   │   ├── parse-spawns-layer.ts   # TiledLayer → MapFormat[] (pixel Tiled → coords grille)
│       │   │   ├── parse-tiled-map.ts      # parseTiledMap(json) → ParseResult ({ map, warnings } | { errors })
│       │   │   ├── validate-tiled-map.ts   # validateTiledMap : règles bloquantes (spawn passable, BFS connectivité) + warnings
│       │   │   ├── load-tiled-map.ts       # loadTiledMap(url) → Promise<MapDefinition> (fetch + parse + validate)
│       │   │   └── index.ts                # Barrel export
│       │   ├── i18n/            # Noms localisés : moves.fr.json, moves.en.json, pokemon-names.fr.json, pokemon-names.en.json
│       │   └── index.ts         # Exporte getMoveName(id, lang), getPokemonName(id, lang), parseTiledMap, loadTiledMap...
│       ├── reference/           # Base de connaissance JSON offline (plans 048, 056) — contient valeurs Champions
│       │   ├── README.md
│       │   ├── pokemon.json     # 1025 espèces (formes imbriquées, learnsets latest-only, exclusions Gmax) — Champions override appliqué
│       │   ├── moves.json       # 850 moves (sans Z-moves ni Max moves) — 45 moves overridés Champions
│       │   ├── abilities.json   # 311 abilities — 3 abilities modifiées Champions
│       │   ├── items.json       # 948 items (sans Z-crystals, Tera shards, Dynamax)
│       │   ├── type-chart.json  # Table 18×18 + variantes par génération
│       │   ├── champions-status.json  # Règles statut Pokemon Champions (paralysie 12.5%, gel 25%/max3t, sommeil sample[2,3,3])
│       │   ├── indexes/         # 19 index inversés regénérés depuis JSON bruts (jamais édités à la main)
│       │   └── schema/          # 4 JSON Schemas (pokemon, move, ability, item)
│       ├── scripts/             # Scripts de génération one-shot (non compilés dans src/)
│       │   ├── build-reference.ts   # Génère reference/ depuis Showdown + PokeAPI (pnpm data:update) — applique applyChampionsOverrides
│       │   └── fetch-champions.ts   # Fetch mod Showdown Champions (data/mods/champions/) et extrait overrides par regex
│       ├── tsconfig.json
│       └── package.json
│
├── scripts/                     # Outils de build one-shot (non packagés)
│   ├── extract-sprites.ts       # Pipeline PMDCollab : télécharge sprites → atlas Phaser (inclut Sleep depuis plan 018)
│   ├── download-status-icons.ts # Télécharge 14 assets statut ZA depuis Pokepedia (7 icônes 52x36 + 7 miniatures 172x36)
│   ├── generate-golden-replay.ts # Génère packages/core/fixtures/replays/golden-replay.json (3v3 aggressive vs aggressive, seed 12345)
│   ├── sprite-config.json
│   └── map-preview.js           # Vite helper pour pnpm dev:map
├── docs/
│   ├── images/
│   ├── plans/                   # Plans d'exécution numérotés (70 plans)
│   ├── architecture.md
│   ├── game-design.md
│   ├── decisions.md
│   ├── roadmap.md
│   ├── references.md
│   ├── abilities-system.md      # Référence système talents : hooks, patterns, anti-spam, call sites
│   └── ...
├── .github/
│   └── ISSUE_TEMPLATE/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json           # Config TS partagée (strict, bundler, path aliases)
├── tsconfig.json
├── biome.json                   # Lint + format (recommended + nursery)
├── vitest.config.ts
├── CLAUDE.md
├── CREDITS.md                   # Attribution CC BY-NC 4.0 PMDCollab
├── LICENSE                      # MIT (code) + note CC BY-NC 4.0 (sprites)
├── README.md
└── STATUS.md
```

### Organisation du core

| Dossier | Contenu | Tests |
|---------|---------|-------|
| `enums/` | Const object enums (pattern `as const` + type dérivé) — dont `PlacementMode`, `PlayerController`, `DefensiveKind`, `TeamValidationError`, `HeldItemId` (12 valeurs) | Non testé (compilation = validation) |
| `types/` | Interfaces, 1 fichier = 1 type — dont `MapDefinition`, `MapFormat`, `SpawnZone`, `PlacementTeam`, `PlacementEntry`, `ActiveDefense`, `TeamSelection`, `TeamValidationResult`, `AbilityDefinition` (9 hooks optionnels : `onDamageModify`, `onAfterDamageReceived`, `onAfterStatusReceived`, `onStatusBlocked`, `onStatusDurationModify`, `onStatChangeBlocked`, `onTypeImmunity`, `onBattleStart`, `onAuraCheck`), `BlockResult { blocked, events }`, `DurationModifyResult { duration, events }`, `HeldItemDefinition` + `HeldItemHandler` (8 hooks : `onDamageModify`, `onCritStageBoost`, `onAfterMoveDamageDealt`, `onAfterDamageReceived`, `onEndTurn`, `onTerrainTick`, `onCtGainModify`, `onMoveLock`), `ItemReactionResult { events, consumeItem }`, `ItemBlockResult { blocked, events }` | Non testé (compilation = validation) |
| `utils/` | Fonctions pures réutilisables (math, direction, géométrie) | Oui |
| `grid/` | Classe Grid, targeting resolvers | Oui |
| `battle/` | BattleEngine (dual-mode RR/CT, injecte `StatusRules` + `abilityRegistry` + `itemRegistry`, `consumeStartupEvents()`, `rerunBattleStartChecks()`), TurnManager (RR), **ChargeTimeTurnSystem** (CT rotation, getCtSnapshot), **ct-costs** (computeCtGain, ppCost, powerFloor, effectFloor, computeMoveCost, computeCtActionCost), PlacementPhase, validate, validate-map, team-validator, defense-check, handle-defensive, defensive-clear-handler, replay-runner, **height-traversal** (canTraverse, calculateFallDamage), **height-modifier** (getHeightModifier, isMeleeBlockedByHeight), **handle-status** (`StatusRules`, `DEFAULT_STATUS_RULES` = Champions, taux statuts Champions via `EffectContext.statusRules`), **ability-handler-registry** (`AbilityHandlerRegistry`, dispatch par hook), **held-item-handler-registry** (`HeldItemHandlerRegistry`, miroir `AbilityHandlerRegistry`, 8 hooks), **effective-flying** (`isEffectivelyFlying(pokemon, types)` — Levitate ou type Flying, exporté depuis `@pokemon-tactic/core`), **position-linked-statuses** (`checkPositionLinkedStatuses` — retire `Intimidated`/`Infatuated`/`Trapped` quand source s'éloigne/KO) | Oui |
| `ai/` | IA scriptées headless : `random-ai.ts`, `aggressive-ai.ts` | Oui |
| `testing/` | Mocks centralisés (`abstract class MockX`) — dont `MockTeamSelection`, `build-height-test-engine`, `build-fall-test-engine` | Exclu du coverage et du build |

### Diagramme interne du core

```mermaid
graph TD
    enums["enums/<br/>TargetingKind, Direction,<br/>PokemonType, ActionError,<br/>PlacementMode, PlayerController,<br/>DefensiveKind, TurnSystemKind,<br/>EffectTier, StatusType (+Intimidated, +Infatuated),<br/>HeldItemId (12 valeurs),<br/>BattleEventType (+AbilityActivated, +HeldItemActivated, +HeldItemConsumed, +HpRestored, +CriticalHit)..."]
    types["types/<br/>BattleState, Action, BattleEvent,<br/>MoveDefinition, PokemonInstance,<br/>AbilityDefinition,<br/>MapDefinition, MapFormat, SpawnZone,<br/>PlacementTeam, PlacementEntry,<br/>ActiveDefense, BattleReplay,<br/>TeamSelection, TeamValidationResult..."]
    utils["utils/<br/>manhattanDistance, directionFromTo,<br/>stepInDirection, getPerpendicularOffsets,<br/>prng (RandomFn, createPrng)"]
    grid["grid/<br/>Grid, targeting resolvers<br/>(single, cone, cross, line, dash, zone)"]
    battle["battle/<br/>BattleEngine (dual-mode RR/CT, consumeStartupEvents),<br/>ChargeTimeTurnSystem, ct-costs,<br/>TurnManager, PlacementPhase,<br/>validate, validate-map, team-validator,<br/>defense-check, handle-defensive,<br/>defensive-clear-handler, replay-runner,<br/>ability-handler-registry, held-item-handler-registry,<br/>effective-flying, position-linked-statuses"]
    ai["ai/<br/>random-ai, aggressive-ai"]
    testing["testing/<br/>MockBattle, MockPokemon"]

    enums --> types
    enums --> grid
    enums --> battle
    types --> grid
    types --> battle
    utils --> grid
    utils --> battle
    grid --> battle
    battle --> ai
    testing -.->|test only| battle
    testing -.->|test only| grid
```

### Configuration TypeScript

Un seul `tsconfig.base.json` racine avec `moduleResolution: "bundler"` et path aliases. Chaque package hérite via `extends`. Pas de project references, pas de `composite`, pas de `dist/` intermédiaires. Pattern identique à monorepo Nx/Angular.

---

## 4. Système d'attaques : composition Targeting + Effects

Chaque attaque est **déclarative** (données, pas du code custom). Deux axes :
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
  | { kind: 'cone'; range: { min: number; max: number } }      // largeur = distance * 2 - 1 (pas de paramètre width)
  | { kind: 'cross'; size: number }                             // toujours centré sur le caster, pas de range
  | { kind: 'line'; length: number }
  | { kind: 'dash'; maxDistance: number }
  | { kind: 'zone'; radius: number }
  | { kind: 'slash' }                                           // arc frontal 3 cases, pas de paramètre
  | { kind: 'blast'; range: { min: number; max: number }; radius: number }

// Effets — composables, une attaque peut en avoir plusieurs
type Effect =
  | { kind: 'damage'; hits?: number | { min: number; max: number } }  // hits = multi-hit (fixe ou variable)
  | { kind: 'status'; status: StatusType; chance: number }
  | { kind: 'stat_change'; stat: Stat; stages: number; target: 'self' | 'targets' }
  | { kind: 'volatile_status'; status: 'seeded' | 'trapped'; duration?: number }
                                                          // Seeded = Vampigraine (drain + heal source), Trapped = Piège (immobilise + DoT)
  | { kind: 'knockback' }                                 // pousse 1 case dans la direction opposée au lanceur
```

// Sur PokemonInstance :
// - `status: StatusType | null`          — 1 statut majeur max (Burned, Poisoned, BadlyPoisoned, ...)
// - `volatileStatuses: VolatileStatus[]` — statuts volatils coexistants (Confused, Seeded, Trapped...)
// - `toxicCounter: number`               — compteur de tours pour BadlyPoisoned (0 = inactif)
// - `recharging: boolean`                — true si le Pokemon doit recharger (Hyper Beam)
// Note : le système `ActiveLink` (LeechSeed + Bind via LinkType) a été supprimé en plan 031.
//        Vampigraine → statut volatil `Seeded` (sourceId, drain 1/8 HP/tour, immunité Plante)
//        Piège (Wrap/Bind) → statut volatil `Trapped` (immobilise, 1/8 HP/tour, N tours)

**Exécution en 3 étapes :**
1. `resolveTargeting(move, caster, targetTile, grid)` → tiles affectées
2. `resolveEffects(move, caster, affectedTiles, state)` → précision, dégâts, statuts
3. `emit(events)` → liste d'événements

Chaque `kind` de targeting a un **resolver** (pure function). Chaque `kind` d'effect a un **processor**.
Ajouter nouvelle mécanique = ajouter `kind` dans l'union + resolver/processor. Pas de refactor.

### Flux d'un tour de combat

```mermaid
sequenceDiagram
    participant Joueur
    participant BattleEngine
    participant TurnManager
    participant Grid

    Joueur->>BattleEngine: getLegalActions(playerId)
    BattleEngine->>TurnManager: getCurrentPokemonId()
    BattleEngine->>Grid: BFS depuis position actuelle
    BattleEngine-->>Joueur: [skip_turn, move(A), move(B)...]

    Joueur->>BattleEngine: submitAction(playerId, move)
    BattleEngine->>Grid: setOccupant (ancien → null, nouveau → pokemonId)
    BattleEngine->>BattleEngine: emit(PokemonMoved)
    BattleEngine->>BattleEngine: emit(TurnEnded)
    BattleEngine->>TurnManager: advance()
    BattleEngine->>BattleEngine: emit(TurnStarted)
    BattleEngine-->>Joueur: ActionResult { success: true, events: [...] }
```

---

## 5. Système d'événements : core → renderer

Core **synchrone** — émet des événements. Consommateurs (renderer, replay, IA, CLI) les traitent librement.

```typescript
type BattleEvent =
  | { type: 'turn_started'; pokemonId: string }
  | { type: 'move_started'; attackerId: string; moveId: string }
  | { type: 'pokemon_moved'; pokemonId: string; path: Position[] }
  | { type: 'pokemon_dashed'; pokemonId: string; path: Position[]; hitId?: string }
  | { type: 'damage_dealt'; targetId: string; amount: number; effectiveness: number }
  | { type: 'status_applied'; targetId: string; status: StatusType }
  | { type: 'stat_changed'; targetId: string; stat: Stat; stages: number }
  | { type: 'volatile_status_applied'; targetId: string; status: 'seeded' | 'trapped'; sourceId?: string }
  | { type: 'volatile_status_removed'; targetId: string; status: 'seeded' | 'trapped' }
  | { type: 'seeded_drained'; targetId: string; sourceId: string; amount: number }
  | { type: 'defense_activated'; pokemonId: string; kind: DefensiveKind }
  | { type: 'defense_triggered'; pokemonId: string; kind: DefensiveKind }
  | { type: 'defense_cleared'; pokemonId: string }
  | { type: 'pokemon_ko'; pokemonId: string; countdownStart: number }
  | { type: 'pokemon_eliminated'; pokemonId: string }
  | { type: 'held_item_activated'; pokemonId: string; itemId: string; targetIds: string[] }
  | { type: 'held_item_consumed'; pokemonId: string; itemId: string }
  | { type: 'hp_restored'; pokemonId: string; amount: number }
  | { type: 'critical_hit'; targetId: string }
  | ...
```

**Core n'attend jamais le renderer.** `submitAction()` synchrone : mute l'état, émet les events, retourne. L'IA joue des milliers de parties par seconde sans overhead visuel.

**Renderer gère sa propre queue d'animations.** Reçoit events, les empile, joue séquentiellement avec tweens/animations Phaser.

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

Mêmes events alimentent les **replays** (sérialisation JSON).

---

## 5b. Mode Sandbox

Accessible uniquement via `pnpm dev:sandbox` (variable Vite `VITE_SANDBOX`). Combat 1v1 sur micro-carte 6x6.

### Lancement

```bash
pnpm dev:sandbox                        # Config par défaut (DEFAULT_SANDBOX_CONFIG)
pnpm dev:sandbox packages/data/sandbox-configs/config.json   # Depuis un fichier JSON
pnpm dev:sandbox '{"pokemon":"pikachu"}'       # JSON inline
```

### Architecture sandbox

- **`SandboxConfig.ts`** : type `SandboxConfig` + constante `DEFAULT_SANDBOX_CONFIG`
- **`BattleSetup.createSandboxBattle(config)`** : carte 6x6, joueur en bas, Dummy en haut, sans placement interactif
- **`DummyAiController`** : soumet move assigné si légal, sinon `EndTurn`
- **`SandboxPanel`** (HTML overlay) : 2 panneaux (Joueur gauche, Dummy droite) + toolbar
  - Panel Joueur : dropdown Pokemon, 2 dropdowns moves, slider HP %, dropdown statut, stages de stats
  - Panel Dummy : dropdown "Stats de" (custom ou preset Pokemon), stats éditables, niveau, slider HP %, dropdown move défensif, direction
  - Toolbar : bouton Réinitialiser, bouton **Exporter JSON** (copie config en JSON dans presse-papier)
- **Écran victoire HTML** : overlay HTML au lieu de Phaser Graphics — contourne bug hitbox Phaser 4 avec camera zoom
- **`packages/data/sandbox-configs/`** : configs JSON d'exemple

> Sprite Dummy = sprite PMDCollab `#0000 form 1` (sprite générique).

---

## 5c. Système i18n

Renderer supporte FR et EN. Core i18n-free : émet events avec IDs, renderer traduit.

**Pas de lib externe** : ~70 lignes maison pour <300 clés et 2 langues.

### Fichiers

```
packages/renderer/src/i18n/
  types.ts          # Language const enum ('fr' | 'en'), interface Translations (toutes clés UI typées)
  index.ts          # t(key), setLanguage(lang), detectLanguage(), getLanguage(), onLanguageChange(callback)
                    # Persistance localStorage sous la clé 'pt-lang'
  locales/
    fr.ts           # Textes français
    en.ts           # Textes anglais

packages/data/src/i18n/
  moves.fr.json          # move-id → nom FR
  moves.en.json          # move-id → nom EN
  pokemon-names.fr.json  # pokemon-id → nom FR
  pokemon-names.en.json  # pokemon-id → nom EN
```

### Comportements

- **Détection auto** : `detectLanguage()` lit `navigator.language` → 'fr' si commence par 'fr', sinon 'en'
- **Persistance** : `setLanguage()` écrit en localStorage
- **Changement de langue** : restart de scène Phaser (rebuild complet UI) — pas de hot-swap Text Phaser individuels
- **`Language` type dans renderer uniquement** : `@pokemon-tactic/data` accepte `string` pour éviter dépendance cyclique

### BattleLogPanel (plan 037)

`packages/renderer/src/ui/BattleLogPanel.ts` — panel de log, haut droite de `BattleUIScene`.

- Alimenté par `BattleEvent` existants (TurnStarted, MoveStarted, DamageDealt, MoveMissed, StatusApplied/Removed, StatChanged, PokemonKo, DefenseActivated/Triggered, ConfusionTriggered, KnockbackApplied, MultiHitComplete, RechargeStarted, BattleEnded) + nouveaux plan 073 : HeldItemActivated, HeldItemConsumed, HpRestored, CriticalHit
- Couleurs par type message (dégâts rouge, stat up bleu, stat down rouge, statut orange, défense vert, KO rouge vif, effectiveness jaune)
- Noms Pokemon cliquables → `camera.pan()`
- Pliable/dépliable via header toggle
- Scroll interne (molette) avec auto-scroll bas

`packages/renderer/src/ui/BattleLogFormatter.ts` — traduit `BattleEvent` en messages i18n. Logique pure, sans dépendance Phaser. 41 tests unitaires.

---

## 6. Système de surcharge (override) pour l'équilibrage

### Structure des données

```
packages/data/
  base/
    moves.ts               # power, accuracy, pp, type, category...
    pokemon.ts             # stats, types, poids, movepool...
    type-chart.ts          # 18x18 efficacités

  overrides/
    tactical.ts            # Ajoute targeting + effects + effectTier
    balance-v1.ts          # Ajustements numériques (PP, chances, portées...)

  maps/
    poc-arena.ts           # Carte POC 12x12, format 2 joueurs (plan 013)
```

### Merge par couches

```
Données finales = deepMerge(base, tactical, balance)
```

- **base** : données Pokemon pures
- **tactical** : ajoute targeting + effects (couche "grille tactique")
- **balance** : tweaks numériques par-dessus

Overrides **optionnels et additifs**. Changer balance = changer un fichier.

### Pipeline de données

```mermaid
flowchart LR
    base["base/<br/>moves.ts<br/>pokemon.ts<br/>type-chart.ts"]
    tactical["overrides/<br/>tactical.ts<br/>(+ targeting + effects)"]
    balance["overrides/<br/>balance-v1.ts<br/>(tweaks numériques)"]
    merge["deepMerge()"]
    moveDef["MoveDefinition<br/>complète"]
    validate["validateBattleData()"]

    base --> merge
    tactical --> merge
    balance --> merge
    merge --> moveDef
    moveDef --> validate
    validate -->|valid: true| ready["BattleEngine prêt"]
    validate -->|errors| crash["Erreur au startup"]
```

### Validation au startup

Vérifie au démarrage :
- Chaque move a un targeting et au moins un effect
- Chaque pokemon référence des moves qui existent
- IDs uniques, pas de référence cassée
- Erreur explicite si une override casse la structure

---

## 7. Pipeline sprites PMDCollab

Sprites extraits depuis [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab) par script one-shot (`scripts/extract-sprites.ts`).

```
PMDCollab GitHub (raw)
  └── AnimData.xml + {Anim}-Anim.png + Idle-Offsets.png + PortraitSheet.png + credits.txt
        │  (téléchargement + parse fast-xml-parser)
        ▼
scripts/extract-sprites.ts  ←  scripts/sprite-config.json
        │  (découpe frames via sharp, génère atlas, parse pixels offsets)
        ▼
packages/renderer/public/assets/sprites/pokemon/{name}/
  ├── atlas.json          # Phaser atlas descriptor (frames + metadata)
  ├── atlas.png           # Spritesheet combiné (toutes anims + directions)
  ├── portrait-normal.png # Portrait 40x40 (émotion Normal)
  ├── offsets.json        # Offsets par Pokemon : shadowOffsetY, bodyOffset, headOffset (générés)
  └── credits.txt         # Attribution artiste (CC BY-NC 4.0)
```

**Clés d'animation Phaser** : `{pokemonId}-{anim}-{direction}` (ex : `bulbasaur-idle-south`)

**SpriteLoader** (`packages/renderer/src/sprites/SpriteLoader.ts`) :
- `preloadPokemonAssets(scene, pokemonIds[])` — charge atlas + portrait + `offsets.json` au preload
- `createAnimations(scene, pokemonId)` — enregistre animations Phaser depuis metadata d'atlas
- `getSpriteOffsets(scene, definitionId)` — retourne `SpriteOffsets` depuis cache JSON, fallback sur valeurs par défaut

**PokemonSprite** utilise animations (Idle, Walk, Attack, Hurt, Faint) avec fallback cercle coloré si atlas absent.

---

## 8. API du core

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

## 9. Système de replay

```typescript
interface BattleReplay {
  seed: number;      // seed du PRNG mulberry32 (0 si Math.random utilisé)
  actions: Action[]; // chaque action jouée dans l'ordre (enregistrée par submitAction)
}
```

Replay **déterministe** : même seed + mêmes actions = même résultat.

### PRNG mulberry32

`packages/core/src/utils/prng.ts` :
- `type RandomFn = () => number` — même signature que `Math.random`
- `createPrng(seed: number): RandomFn`

`BattleEngine` accepte `random?: RandomFn` en dernier paramètre (défaut : `Math.random`). Propagé via `EffectContext` à tous les handlers. Zéro `Math.random()` direct dans `packages/core/src/battle/`.

### Enregistrement et rejeu

- `BattleEngine.exportReplay()` → `{ seed, actions: [...recordedActions] }`
- `runReplay(replay, buildEngine)` dans `replay-runner.ts` recrée engine avec seed et soumet actions dans l'ordre
- `packages/core/fixtures/replays/golden-replay.json` : replay de référence (3v3 aggressive vs aggressive, seed 12345, Player 1 gagne en 32 rounds / 247 actions)
- `golden-replay.test.ts` : test de non-régression — si mécanique aléatoire change, test pète → relancer `pnpm replay:generate`

---

## 10. Outillage Claude Code

| Besoin | Solution |
|--------|----------|
| Écrire du code | Claude Code + TypeScript (natif) |
| Lancer le jeu | `pnpm dev` → Vite dev server |
| Voir le rendu | MCP Playwright — screenshots, interaction |
| Tests | `pnpm test` (Vitest) |
| Faire jouer une IA | Script Node.js important le core |
| Voir un replay | Charger JSON dans renderer web |
| Mettre à jour données Champions | `pnpm data:update` → fetch Showdown + apply Champions overrides → écrit `reference/*.json` |
| Reviewer un diff données | `pnpm data:diff` → résumé lisible des changements vs dernier commit |

---

## 11. Évolutions prévues du renderer

| Phase | Renderer | Style |
|-------|----------|-------|
| POC | Phaser 4 (2D isométrique) | Sprites + tiles isométriques |
| HD-2D | **Babylon.js** ou Three.js | Terrain 3D + sprites 2D billboardés + DoF/bloom |
| Optionnel | Godot (desktop) | HD-2D natif, rendu Vulkan |

Core ne change jamais — seul le renderer est remplacé.

---

## 12. Agents & Skills Claude Code

Agents custom dans `.claude/agents/` et skills dans `.claude/skills/`.

26 agents + 4 knowledge files. Détails dans `docs/agent-orchestration.md`.

| Agent | Modèle | Rôle |
|-------|--------|------|
| `ai-player` | sonnet | Joue au core via l'API, teste mécaniques et edge cases |
| `asset-manager` | sonnet | Gestion assets (sprites, tilesets, sons) |
| `balancer` | sonnet | Lance N combats headless, analyse winrates, propose overrides |
| `best-practices` | sonnet | Recherche bonnes pratiques (WebSearch + WebFetch) |
| `ci-setup` | haiku | Configuration GitHub Actions |
| `code-reviewer` | sonnet | Review qualité, TS strict, conventions |
| `commit-message` | haiku | Propose message de commit basé sur contexte + `git diff` |
| `core-guardian` | haiku | Vérifie que `packages/core/` n'a aucune dépendance UI |
| `data-miner` | sonnet | Import données Pokemon (Showdown/PokeAPI) |
| `debugger` | opus | Diagnostic bugs complexes |
| `dependency-manager` | haiku | Gestion dépendances npm, deprecation warnings |
| `doc-keeper` | sonnet | Maintient documentation à jour (checklist systématique) |
| `feedback-triager` | haiku | Classe issues GitHub (bug/feature/feedback/duplicate) |
| `game-designer` | sonnet | Cohérence et équilibre des mécaniques |
| `level-designer` | haiku | Crée maps (JSON), valide jouabilité |
| `move-pattern-designer` | sonnet | Attribue et justifie pattern tactique de chaque move |
| `performance-profiler` | sonnet | Analyse performances (FPS, mémoire, bundle) |
| `plan-reviewer` | haiku | Crée, review et maintient les plans |
| `publisher` | sonnet | Vérifie draft release, la publie, orchestre wiki |
| `release-drafter` | haiku | Alimente draft release GitHub avec changelog joueur |
| `sandbox-json` | haiku | Génère configs sandbox JSON depuis description langage naturel |
| `session-closer` | sonnet | Met à jour STATUS.md fin de session, chaîne vers `commit-message` |
| `test-writer` | sonnet | Tests Vitest, approche test-first |
| `visual-analyst` | sonnet | Analyse visuels + web search pour inspiration |
| `visual-tester` | sonnet | Vérification visuelle via Playwright MCP |
| `wiki-keeper` | sonnet | Maintient wiki GitHub (guide joueur, mécaniques, changelog) |

### Chaînes d'agents

| Déclencheur | Chaîne |
|-------------|--------|
| Étape intermédiaire plan (core touché) | `core-guardian` + `test-writer` |
| Fin de plan | `code-reviewer` + `doc-keeper` (+ `core-guardian` si core, + `visual-tester` si renderer) |
| Bugfix / refacto hors plan | `code-reviewer` + `doc-keeper` |
| Modif mécaniques de jeu | `game-designer` |
| `code-reviewer` déclenche | `core-guardian` (si core), `game-designer` (si mécaniques), `visual-tester` (si renderer) |
| Ajout/modif données Pokemon | `data-miner` + `game-designer` |
| Fin de session | `pnpm build` + `pnpm test` → `session-closer` → `doc-keeper` + `commit-message` |
| Ajout dépendance | `dependency-manager` |
| Nouveau plan | `plan-reviewer` |
| Bug visuel | `visual-tester` |

### Skills

| Commande | Action |
|----------|--------|
| `/next` | Lit `docs/next.md` + STATUS + roadmap + plan, propose suite et affiche reporté/fait récemment |
| `/review-local` | Lance `code-reviewer` sur changements locaux (`git diff`) |
