# État du projet — Pokemon Tactics

> Dernière mise à jour : 2026-03-30 (Plan 018 terminé — status icons ZA, HP bar FFTIC, badges stat changes, sleep animation)
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

- **Plan 013 terminé** — Modèle de carte + phase de placement :
  - Core : 7 nouveaux types/enums (`MapDefinition`, `MapFormat`, `SpawnZone`, `PlacementTeam`, `PlacementEntry`, `PlacementMode`, `PlayerController`)
  - Core : `validateMapDefinition` (11 tests)
  - Core : carte `poc-arena` 12x12 avec 2 zones de spawn de 9 tiles dans `packages/data`
  - Core : `PlacementPhase` — alternance serpent, sélection libre du Pokemon, undo, `autoPlaceAll` avec seed PRNG déterministe (17 tests)
  - Core : test d'intégration `PlacementPhase` → `BattleEngine` (2 tests)
  - Renderer : `BattleSetup` refactoré — `createBattleFromPlacements(map, format, placements, teams)`
  - Renderer : `GameController` avec 2 nouveaux états (`placement`, `placement_direction`)
  - Renderer : `PlacementRosterPanel` — portraits cliquables, joueur actif, Pokemon placés grisés
  - Renderer : `IsometricGrid.highlightTilesWithColor` pour les zones de spawn
  - Renderer : `BattleScene` flow complet placement → combat (`PlacementMode.Alternating` et `Random`)
  - Renderer : `SpriteLoader.preloadPokemonAssets` signature assouplie

- **Post-plan 013 — Roster élargi + UI (2026-03-26)** — **244 tests** (avant plan 015), build OK :
  - Fix Restart : `BattleUI` redémarre `BattleScene` (au lieu de `BattleUIScene`)
  - **Roster 4 → 12 Pokemon** : Pikachu, Machop, Abra, Fantominus, Racaillou, Caninos, Rondoudou, Otaria
  - **16 → 48 moves** : 32 nouveaux moves, tous les patterns couverts
  - Nouveaux patterns utilisés : Line (Tonnerre, Psykoud'boul, Lance-Flammes, Laser Glace), Dash (Voltacle, Tunnel, Roue de Feu), Gel via Blizzard
  - Format **6v6**, zones de spawn centrées sur les bords opposés (haut/bas de la carte)
  - Sprites PMDCollab extraits pour les 8 nouveaux Pokemon (Otaria sans animation Faint disponible — fallback)
  - URL param `?random` pour placement instantané en mode random
  - Info panel revient sur le Pokemon actif quand le hover quitte la grille
  - **Status icons** (pastilles colorées) dans la turn timeline
  - **Stat change indicators** (flèches ↑↓ colorées) dans l'info panel
  - Sandbox `localhost` autorisé dans la CSP

- **Session 2026-03-26 — Conception patterns d'attaque** (aucun code modifié) :
  - Nouvel agent `move-pattern-designer` créé dans `.claude/agents/`
  - Document de réflexion `docs/reflexion-patterns-attaques.md` — philosophie, règles sémantiques, tableau des 48 attaques
  - 2 nouveaux patterns décidés : `slash` (arc 3 cases devant) et `blast` (projectile + explosion circulaire) — décisions #108-109
  - 8 changements de pattern validés sur les movesets existants — décision #110
  - 4 nouvelles mécaniques identifiées pour Phase 1+ : knockback, warp, ground (zones persistantes), self-damage — décision #112
  - Heuristique 2v2 Showdown ajoutée comme outil d'aide à la décision
  - game-design.md mis à jour (slash/blast + effets spéciaux), roadmap.md mis à jour (tâches d'implémentation ajoutées)
  - Correction numérotation decisions.md : doublons #108-114 corrigés en #115-121

- **Plan 015 terminé** — Stats niveau 50 :
  - `stat-calculator.ts` : `computeStatAtLevel(base, level, isHp)` et `computeCombatStats(baseStats, level)` — formule Gen 5, niveau 50, IV=0, EV=0
  - `PokemonInstance` : nouveaux champs `level: number` et `combatStats: BaseStats` (valeurs calculées, séparées des `baseStats` officiels)
  - `damage-calculator.ts` : utilise `combatStats` au lieu de `baseStats`
  - Mocks et `build-test-engine.ts` mis à jour avec les stats niveau 50
  - Renderer : `InfoPanel.ts` affiche `Lv.50` à côté du nom, `BattleSetup.ts` utilise `computeCombatStats`
  - Exemples HP : Bulbasaur 45→105, Charmander 39→99, Pidgey 40→100, Abra 25→85, Rondoudou 115→175
  - **305 tests**, 100% coverage maintenu, 10 nouveaux tests `computeStatAtLevel`
  - Fix tests préexistants : intégration (pokemon count 4→12, spawn zone positions)

- **Plan 018 terminé** — Status icons ZA + HP bar FFTIC + badges stat changes + sleep animation :
  - Script `scripts/download-status-icons.ts` : 14 assets PNG téléchargés (7 icônes 52x36 + 7 miniatures 172x36) dans `public/assets/ui/statuses/`
  - `TurnTimeline` : icônes ZA remplacent les pastilles colorées (fallback cercle+lettre conservé si assets absents)
  - `PokemonSprite` : HP bar rework style FFTIC — gradient 3 couleurs (vert >60%, jaune >30%, rouge <=30%) avec bordure fine, coins arrondis
  - `PokemonSprite` : icône statut ZA affichée à droite de la HP bar (apparaît/disparaît avec le statut)
  - `InfoPanel` : miniature ZA (172x36) remplace le texte uppercase BURNED/PARALYZED etc.
  - `InfoPanel` : badges colorés style Showdown pour les stat changes (fond bleu = buff, rouge = debuff)
  - `SpriteLoader` : vérification des frames, 0 warnings à l'exécution
  - `scripts/extract-sprites.ts` : bounds checking amélioré (résilient aux animations manquantes)
  - Animation Sleep PMD extraite et intégrée : Pokemon endormi joue Sleep en boucle, retour Idle à la guérison
  - `GameController` écoute `StatusApplied`/`StatusRemoved` pour synchroniser icône + animation
  - **254 tests**, 100% coverage maintenu

- **Plan 017 terminé** — Prévisualisation AoE sur la grille :
  - Preview AoE dynamique : suit la souris pour les directionnels (Cone, Line, Slash, Dash), hover pour point-target (Single, Blast), statique à l'entrée pour self-centered (Self, Cross, Zone)
  - Flow 2 étapes style FFTA : preview → verrouillage (sprites clignotent) → confirmation. Paramètre `confirmAttack` configurable (`true` = flow complet, `false` = clic direct)
  - Portée affichée en outline périmétrique (contour extérieur de la zone, pas chaque tile)
  - Couleurs : rouge = dégâts, bleu = buff (basé sur les effets du move), outline rouge = portée
  - Texte d'instruction dans le menu ("Sélectionne la cible" / "Confirmer ?")
  - Escape contextuel ajouté : `attack_submenu` et `select_move_destination`
  - Utilitaire `getDirectionFromScreenPosition` extrait dans `utils/screen-direction.ts`
  - `BattleEngine.getGrid()` rendu public
  - Décisions #128 (pas de warning friendly fire) et #129 (couleurs preview AoE)

- **Plan 016 terminé** — Infos attaques UI + type icons + fix cone :
  - **Fix core** : `resolveCone` — largeur dynamique `distance * 2 - 1`, paramètre `width` supprimé du type `TargetingPattern.Cone`
  - **Fix core** : `Cross` — désormais TOUJOURS centré sur le caster (plus de paramètre `range`). Night Shade et Éclate-Roc mis à jour dans tactical.ts.
  - **Script** `scripts/download-type-icons.ts` — télécharge les 18 type icons Pokepedia ZA (36x36px sans texte) dans `public/assets/ui/types/`
  - **Category icons** Bulbagarden SV (`physical.png`, `special.png`, `status.png`) dans `public/assets/ui/categories/`
  - **`BattleScene.preload`** : charge les 18 type icons (`type-{name}`) et les 3 category icons (`category-{type}`)
  - **`ActionMenu`** : icône catégorie SV à gauche + nom du move + PP courants/max à droite
  - **`MoveTooltip`** (nouveau) : tooltip au hover — catégorie icon, puissance/précision, nom pattern FR + portée conditionnelle, grille dynamique adaptée
  - **`pattern-preview.ts`** (nouveau) : helper `buildPatternPreview(targeting)` → grille de `PatternCell[][]` (target, dash, caster, empty)
  - **`TYPE_NAMES`** et constantes tooltip (`TOOLTIP_WIDTH`, `TOOLTIP_CELL_SIZE`, `TOOLTIP_CELL_GAP`, `DEPTH_TOOLTIP`) dans `constants.ts`
  - Noms patterns en français : Cible, Soi, Ligne, Cône, Slash, Croix, Zone, Dash, Bombe
  - Portée affichée uniquement pour Single distance (range>1) et Blast
  - Grille dynamique : taille adaptée au pattern réel, minimum 3x3, centrée

- **Session 2026-03-26 — Design Phase 1** (aucun code modifié) :
  - 7 idées validées et intégrées dans la doc :
    1. **Stats niveau 50** : `computeStatAtLevel(base, 50)` sans IV/EV — décision #122, roadmap Phase 1
    2. **Preview AoE + confirmation** avant attaque — déjà dans roadmap, priorité confirmée
    3. **i18n français/anglais** — Phase 2, source : pokemon-showdown-fr (docs/references.md + README mis à jour)
    4. **Infos détaillées des attaques** dans le sous-menu (puissance, type, PP, pattern) — roadmap Phase 1
    5. **Scaling sprites selon taille Pokemon** — Phase 2, basé sur height/weight PokeAPI
    6. **Icons/sprites pour les statuts** sur les sprites — déjà dans roadmap Phase 1, priorité confirmée
    7. **Refonte panel info stats** : stages lisibles (+1/+2/-1 avec code couleur) — roadmap Phase 1
  - game-design.md, docs/roadmap.md, docs/references.md, README.md mis à jour par doc-keeper
  - decisions.md : décision #122 ajoutée (niveau 50 sans IV/EV)

### Prochaine étape
- **Preview dégâts estimés** dans la phase `confirm_attack` (slot prévu dans le plan 017, non implémenté)
- **i18n français/anglais** — Phase 2, source : pokemon-showdown-fr (noms moves, Pokemon, statuts, UI)
- **Zoom / caméra dynamique avec pan** — Phase 4 (non bloquant, résolution fixe 1280x720 acceptable pour le POC)
- Review des movesets des 8 nouveaux Pokemon par l'humain (équilibrage) — décision #121
- **Plus de moves** stat changes (Épée Danse, Groz'Yeux, Abri) et AoE variés — Phase 1 Core

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
