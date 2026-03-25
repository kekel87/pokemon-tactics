# État du projet — Pokemon Tactics

> Dernière mise à jour : 2026-03-25 (Plan 012 — Direction de fin de tour, terminé)
> Ce fichier est le point d'entrée pour reprendre le projet après une pause.
> Dire "on en était où ?" et Claude Code lira ce fichier.

---

## Phase actuelle : Phase 0 — POC (en cours de développement)

### Ce qui est fait
- Documentation complète : game-design, architecture, decisions (91 décisions), roadmap, references, methodology, roster POC, glossaire
- 19 agents + 7 skills Claude Code en place (`.claude/`)
- **Plan 001 terminé** : monorepo setup (pnpm workspaces, TypeScript bundler, Vite, Vitest, Biome)
- **Plan 002 terminé** :
  - 11 const object enums (TargetingKind, Direction, EffectTarget...)
  - 16 interfaces/types (1 fichier = 1 type)
  - Classe Grid avec helpers spatiaux
  - 7 targeting resolvers (single, self, cone, cross, line, dash, zone)
  - Traversée alliés/Vol/Spectre implémentée
  - Mocks centralisés (MockPokemon avec les 4 Pokemon du roster)
- **Plan 003 terminé** :
  - `TurnManager` : initiative, ordre des tours, cycle des rounds, gestion des KO
  - `BattleEngine` : `getLegalActions` (BFS pathfinding), `submitAction` (move + skip_turn), event system (on/off/emit), `getGameState`
  - `packages/data` : nouveau package avec 4 Pokemon, 16 moves complets (targeting + effects), type chart 18x18, overrides tactical/balance, deepMerge, loadData()
  - `validate.ts` : validation des données au startup (targeting, effects, ids uniques, ranges, PP...)
  - `ActionError` enum : codes d'erreur typés
  - `Accuracy`/`Evasion` ajoutés à `StatName`
  - `MockBattle` : mocks centralisés pour les tests battle
  - `vitest.config.ts` : ajout `resolve.tsconfigPaths` natif
  - 117 tests, 100% coverage maintenu
- **Plan 004 terminé** :
  - `stat-modifier.ts` : multiplicateurs de stages (-6 à +6), `getStatMultiplier`, `getEffectiveStat`, `clampStages`, `isMajorStatus`
  - `damage-calculator.ts` : formule Pokemon Gen 5+, STAB (1.5x), type effectiveness, burn penalty (-50% dégâts physiques)
  - `accuracy-check.ts` : accuracy/evasion stages, random check (100% accuracy = toujours touche)
  - `effect-processor.ts` : 4 processors — `processDamage`, `processStatus`, `processStatChange`, `processLink`
  - `BattleEngine.executeUseMove` : pipeline complet `resolveTargeting` → accuracy check → `processEffects` → émission d'events
  - `BattleEngine.getLegalActions` : retourne les `use_move` avec positions valides pour les 7 targeting patterns
  - Test d'intégration combat complet : Charmander Ember vs Bulbasaur Razor Leaf
  - 172 tests, 100% coverage maintenu
- **Plan 005 terminé** :
  - `EffectHandlerRegistry` : handler registry pour les effets (remplace switch case)
  - Pipeline de phases de tour : `StartTurn` → `Action` → `EndTurn`
  - Initiative dynamique : ordre des tours recalculé à chaque round
- **Plan 006 terminé** :
  - `statusTickHandler` : burn (1/16 HP/tour), poison (1/8 HP/tour), sleep (1-3 tours), freeze (20% dégel/tour), paralysie (25% proc bloque move+dash)
  - `linkDrainHandler` : drain Vampigraine permanent en EndTurn, rupture par KO source ou distance > maxRange
  - `handleKo` : retrait du turn order, libération de la tile, rupture des liens, idempotent
  - `checkVictory` : dernière équipe debout gagne, `BattleEnded` émis, combat verrouillé
  - `ActionError.BattleOver` ajouté
  - Handlers enregistrés dans le constructeur `BattleEngine`
  - **225 tests** à la fin du plan (234 après plan 008)
  - 6 tests d'intégration battle-loop : poison tue, sleep+drain, paralysie, initiative dynamique, battleOver
- **Tests headless IA** (scripts temporaires, supprimés après validation) :
  - Combat IA Random : Player 1 gagne (Bulbasaur+Squirtle vs Charmander+Pidgey) en 58 rounds — boucle tourne, KO gérés, victoire détectée, pas de crash
  - Combat IA Smart : Player 2 gagne (Charmander+Squirtle vs Bulbasaur+Pidgey) en 67 rounds — bug heuristique détecté (PP grillés sans cible), corrigeable via `getLegalActions`
  - **Core validé de bout en bout** : la boucle de combat complète fonctionne en headless

- **Maintenance 2026-03-22** :
  - Fix infra : remplacement `vite-tsconfig-paths` par `resolve.tsconfigPaths` natif (Vite 8), dépendance supprimée
  - Terminologie : "créature" → "Pokemon" (18 occurrences, 9 fichiers), "créateur" → "l'humain" dans doc et agents
  - README réécrit pour repo public : description du jeu, disclaimers Nintendo + IA, sources et crédits, diagramme mermaid orchestration agents
  - Agents améliorés : `code-reviewer` (propose titre de commit), `doc-keeper` (checklist systématique, maintenance sources README), `dependency-manager` (détection deprecation warnings build + test)
  - Orchestration agents dans `CLAUDE.md` revue : chaînes d'agents documentées, déclencheurs plus explicites
  - Style de commit : titre seul, pas de corps

- **Plan 007 terminé** — Renderer POC (étapes 1-6 terminées, étapes 7-8 absorbées par plan 009) :
  - Bootstrap Phaser 4 RC6 + BattleScene
  - Grille isométrique 12x12 avec conversion coords grid ↔ screen
  - Sprites placeholder : cercles colorés par type, barres PV
  - Sélection + highlight tiles (bleu=déplacement, rouge=attaque)
  - Déplacement animé + ciblage d'attaque + hot-seat 2 joueurs fonctionnel
  - Queue d'animations séquentielles

- **Plan 008 terminé** — Move+Act FFTA-like :
  - `SkipTurn` remplacé par `EndTurn` dans tout le codebase
  - `turnState { hasMoved, hasActed }` dans `BattleEngine`
  - `executeMove` et `executeUseMove` ne terminent plus le tour automatiquement
  - `executeEndTurn` termine le tour (avec direction optionnelle)
  - `getLegalActions` conditionnel selon `turnState`
  - `ActionError.AlreadyMoved` et `ActionError.AlreadyActed` ajoutés
  - Renderer adapté : `handleEndTurn`, bouton EndTurn
  - **234 tests**, 100% coverage maintenu, 9 nouveaux tests Move+Act

- **Plan 010 terminé** — Sprites PMDCollab :
  - Script `scripts/extract-sprites.ts` : télécharge sprites PMDCollab, parse AnimData.xml, génère atlas Phaser (JSON+PNG) + portraits pour les 4 Pokemon du roster
  - `scripts/sprite-config.json` : configuration extensible (Pokemon, animations, portraits, directions)
  - `CREDITS.md` : attribution CC BY-NC 4.0 pour PMDCollab
  - `SpriteLoader.ts` : preload atlas + portraits, création animations Phaser (`{pokemonId}-{anim}-{direction}`)
  - `PokemonSprite.ts` refactoré : cercles colorés → sprites animés (Idle, Walk, Attack, Hurt, Faint) avec fallback cercle si atlas absent
  - `BattleScene.ts` : preload() ajouté, `createBattle()` déplacé ici, injecté dans `GameController`
  - `GameController.ts` : setup injecté, `MoveStarted` joue l'animation Attack
  - `InfoPanel.ts` : portrait 40x40 à gauche du panel
  - `TurnTimeline.ts` : portraits dans la timeline au lieu de cercles colorés
  - `constants.ts` : ajout `POKEMON_SPRITE_SCALE`
  - Assets générés dans `packages/renderer/public/assets/sprites/pokemon/{name}/` (atlas.json, atlas.png, portrait-normal.png, credits.txt)
  - Dépendances root ajoutées : `sharp`, `fast-xml-parser`, `tsx` (devDependencies)
  - Script npm `extract-sprites` ajouté

- **Plan 009 terminé** — UI FFT-like :
  - `BattleUIScene` overlay séparée de `BattleScene` (communication via event `uiReady`)
  - Menu d'action FFT-like : Deplacement, Attaque, Objet (grisé), Attendre, Status (grisé)
  - Sous-menu Attaque : 4 moves + Annuler, navigation fluide entre menus
  - Panel info bas-gauche avec fond coloré par équipe (bleu/rouge), suit le hover
  - Timeline d'ordre des tours côté gauche (cercles colorés type + bordure équipe)
  - Curseur de tile animé (losange jaune pulsant)
  - State machine 6 états : action_menu, select_move_destination, attack_submenu, select_attack_target, animating, battle_over
  - Noms capitalisés, retirés des sprites, barres PV conservées
  - Écran de victoire avec numéro de round
  - Fix screenToGrid : Math.round au lieu de Math.floor (hit detection isométrique)
  - Système de depth centralisé dans constants.ts
  - **Bugs connus restants** (non bloquants pour le POC) :
    - Resize/scaling canvas non géré (fixe 1280x720)
    - Camera pan animé reporté (centerOn instantané)

- **Post-plan 009 — Bugfixes + features dash (2026-03-24)** :
  - `PlayerId` const enum (`Player1`/`Player2`) remplace les string literals `"player-1"`/`"player-2"` dans tout le codebase
  - Fix `HighlightKind` : `import type` → `import` corrige un crash runtime Linux
  - Fix depth highlights : `DEPTH_GRID_HIGHLIGHT = 100` ajouté dans `constants.ts`, highlights visibles cross-platform
  - Fix dash targeting : `resolveDash` ne retourne que la tile d'impact (corrige le bug "Vive-Attaque touche à 2 cases")
  - `getValidTargetPositions` pour Dash retourne toutes les cases dans les 4 directions jusqu'à `maxDistance` (pas seulement les tiles occupées)
  - Dash déplace le caster vers la tile ciblée (ou juste devant l'ennemi bloquant) — repositionnement tactique inclus
  - Dash ne consomme pas `hasMoved` — Move + Dash et Dash + Move tous deux permis
  - Dash dans le vide autorisé : cibler une case vide déplace le caster sans frapper (consomme l'Act)
  - Vive-Attaque `maxDistance` corrigé : 3 → 2 tiles

- **Quick fixes post-plan 010 (2026-03-24)** — **244 tests**, 100% coverage :
  - Sprites scale 2 (était 1.5), HP bars remontées à -32px, taille 36x5px
  - Directions iso corrigées : South→SouthWest, East→SouthEast, North→NorthEast, West→NorthWest
  - Timeline : portraits 32/40px, encadrés rectangulaires (plus de cercles)
  - Walk animation : une seule lecture pour tout le path (plus de reset par tile)
  - Faint : animation complète + stop sur dernière frame avant fadeOut
  - Depth fix : highlights (100) → curseur (150) → sprites Pokemon (200+) → UI (1000+)
  - `CAMERA_ZOOM` retiré de constants.ts (zoom caméra reporté à un plan dédié)
  - **Bugs connus reportés** (non bloquants pour le POC) :
    - Zoom/caméra dynamique avec pan (à étudier avec refs FFT/FFTA)
    - Animations d'attaque par catégorie (Strike physique, Shoot spécial)
    - Orientation dynamique pendant déplacement/attaque
    - Animations de mouvement par type (FlapAround vol, Hop saut)
    - Taille tiles/sprites à revoir quand le système caméra sera en place

- **Plan 011 terminé** — KO body blocking + suppression koCountdown :
  - `koCountdown` supprimé de `PokemonInstance`, mocks et `BattleSetup`
  - `handleKo` ne retire plus l'occupant de la grille — le corps reste sur la tile
  - BFS/`validateMove`/`dashMoveCaster` : un corps KO est traversable mais non-stoppable
  - Renderer : `playFaintAndStay()` — sprite reste visible (alpha 0.5) au lieu de fadeOut+destroy
  - `PokemonKo` et `PokemonEliminated` dissociés dans `GameController`
  - Décisions #24 révisée (KO définitif), #92 (Gen 1), #93 (Second Souffle 1PP)
  - **249 tests**, 100% coverage

- **Plan 012 terminé** — Direction de fin de tour :
  - Core : `direction` obligatoire sur `EndTurn` (plus optionnel), `getLegalActions` génère 4 actions `EndTurn` (une par direction)
  - Core : orientation initiale calculée vers le centre de la grille via `directionFromTo` au lieu de `Direction.South` fixe
  - Renderer : état `select_direction` ajouté à la state machine de `GameController`
  - Renderer : `DirectionPicker` réécrit — spritesheet `arrows.png` (sprites) au lieu de dessin programmatique (Graphics)
  - Détection de direction par quadrants cardinaux écran (croix horizontale/verticale), pas les diagonales iso
  - Asset `arrows.png` ajouté dans `public/assets/ui/`, chargé dans `BattleScene.preload`
  - Flèches positionnées au-dessus de la tête du Pokemon (style FFT) — flèche active jaune, inactives grises
  - `PokemonSprite.setHpBarVisible()` : barre PV masquée pendant le choix de direction
  - Orientation appliquée sur `TurnEnded` via `sprite.setDirection(orientation)` dans `processEvents`

### Prochaine étape
- Phase 1 — voir `docs/roadmap.md` : placement initial configurable, plus de moves/Pokemon, statuts volatils (plan à définir)

### Standards de code établis
- Pas d'abréviations, variables nommées comme leur type
- Const object enum pattern (`as const` + type dérivé)
- 1 fichier = 1 interface, séparation enums/types/grid/battle
- Pas de commentaires (sauf algo complexe)
- Mocks : `abstract class` + `static readonly` + données pures (pas de helpers)
- Tests : comportement uniquement, const enums (pas de string literals)
- Coverage 100% sur le core (threshold bloquant)

### Questions ouvertes (non bloquantes pour le POC)
- Formules dérivées (Mouvement/Saut/Initiative depuis Vitesse+Poids) — Phase 1
- Movesets POC : Bombe-Beurk trop forte, Salamèche trop faible (feedback game-designer) — Sludge Bomb inflige 112 dégâts sur Pidgey (40 HP), ratio 2.8x à surveiller
- KO définitif avec corps bloquant (décision #24 révisée) — implémenté plan 011
- Friendly fire fréquent avec IA random (pas de bug, comportement attendu mais à garder en tête pour l'équilibrage)
- PP system : une IA sans filtre de cible gaspille ses PP — `getLegalActions` peut servir de garde-fou
