# État du projet — Pokemon Tactics

> Dernière mise à jour : 2026-04-14 (plan 051 terminé : terrain effects core + tests + maps sandbox + renderer tint + bugfixes)
> Ce fichier est le point d'entrée pour reprendre le projet après une pause.
> Dire "on en était où ?" et Claude Code lira ce fichier.

---

## Phase actuelle : Phase 3 — Terrain & Tactics

### Ce qui est fait
- Documentation complète : game-design, architecture, decisions (240 décisions), roadmap, references, methodology, roster POC, glossaire
- 21 agents + 7 skills Claude Code en place (`.claude/`)
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

- **Plan 019 terminé** — Preview dégâts estimés dans confirm_attack :
  - `damage-calculator.ts` : random roll `x0.85–1.00` ajouté à la formule de dégâts
  - `estimateDamage()` : nouvelle fonction retournant `{ min, max, effectiveness }` (min = dégâts au roll 0.85, max = dégâts au roll 1.00)
  - `BattleEngine.estimateDamage(attackerId, moveId, defenderId)` : méthode publique utilisable par l'UI et l'IA
  - Preview visuelle dans le flow `confirm_attack` : zone dégradée sur la HP bar (rouge foncé = garanti, rouge clair = possible) + texte flottant "min–max" au-dessus des cibles
  - "Immune" affiché en gris pour les immunités de type (effectiveness 0)
  - Multi-cibles AoE : preview simultanée sur toutes les cibles dans la zone
  - Caster exclu de la preview (cohérent avec les dégâts réels)
  - **316 tests** (263 → 316 avec intégration), 100% coverage maintenu

- **Plan 020 terminé** — Canvas responsive + zoom/pan caméra :
  - Canvas responsive FIT (`Phaser.Scale.FIT`, CSS `100vw/100vh`)
  - Zoom 3 niveaux discrets : close-up 2.0x, medium 1.3x (défaut), overview 0.85x — molette + touches +/-/=
  - Pan caméra via flèches clavier + `camera.pan()` fluide au début du tour
  - Espace pour recentrer sur le Pokemon actif
  - Edge pan (souris aux bords) supprimé — feedback utilisateur
  - Camera bounds limités à la grille + marge (`CAMERA_BOUNDS_MARGIN`)
  - Timeline portraits ajustés (42px inactif / 48px actif), Y=20, alignée à gauche avec InfoPanel (X=16)
  - `roundPixels` et `antialias` retirés de la config globale Phaser, filtre `NEAREST` appliqué par sprite via `texture.setFilter(Phaser.Textures.NEAREST)` (pixel art propre, texte non pixelisé)
  - Annulé : agrandissement tiles (96x48) et sprite scale (2.5x) — on garde 64x32 et scale 2x, tout passe par la caméra
  - Test visuel complet : combat hot-seat OK, zoom/pan/recenter OK, 0 erreurs console

- **Plan 021 terminé** — Sprite offsets corrects via Shadow.png/Offsets.png PMDCollab + ombres sous sprites :
  - `scripts/extract-sprites.ts` : télécharge `Idle-Offsets.png`, parse les pixels marqueurs (pixel noir = tête, pixel vert = corps), lit `ShadowSize` depuis `AnimData.xml`, génère `offsets.json` par Pokemon
  - `SpriteLoader.ts` : preload `offsets.json` par Pokemon, export `getSpriteOffsets()` avec interface `SpriteOffsets` et fallback si fichier absent
  - `PokemonSprite.ts` : HP bar, icône statut et texte dégâts positionnés via `headOffsetY` (position réelle de la tête), ombre ellipse dessinée sous les pieds (`footOffsetY`), ombre masquée sur KO
  - `constants.ts` : ajout `POKEMON_SPRITE_GROUND_OFFSET_Y = -4`, suppression de `POKEMON_SPRITE_OFFSET_Y` (remplacé par les offsets par Pokemon) et `DAMAGE_ESTIMATE_TEXT_OFFSET_Y` (absorbé)
  - 12 `offsets.json` générés pour les Pokemon du roster
  - **264 tests**, build OK

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

- **Plan 022 terminé** — Refonte timeline turn order :
  - Core : `predictedNextRoundOrder: string[]` ajouté à `BattleState`, calculé dans `syncTurnState()` (tri par initiative décroissante, tie-break par ID)
  - Renderer : `TurnTimeline.update()` réécrit — section haute (actif + restants ce round), séparateur `══ N ══` (numéro du prochain round, uniquement si au moins 1 Pokemon a déjà joué), section basse (déjà passés en alpha 0.55 dans l'ordre prédit)
  - Tailles réduites : 36px inactif, 42px actif, espacement 3px — 12 Pokemon + séparateur sans chevauchement InfoPanel
  - Pokemon KO retirés de la timeline
  - **266 tests unitaires + 53 intégration**, build OK, 0 régressions

- **Plan 023 terminé + améliorations sandbox post-plan** — Mode Sandbox + 8 moves défensifs :
  - Mode sandbox accessible via `?sandbox` (URL param) — micro-carte 6x6, 1 Pokemon joueur vs 1 Dummy
  - `DummyAiController` : dummy passif ou move assigné (8 moves défensifs + "(passif)")
  - **2 panels séparés** : Joueur (gauche) et Dummy (droite), toolbar au-dessus (Réinitialiser + Copier URL)
  - Temps réel : chaque changement relance le combat automatiquement
  - Moves joueur filtrés par movepool du Pokemon sélectionné + dédoublonnage (vide l'autre slot)
  - Dummy : dropdown "Stats de" avec "(custom)" + presets Pokemon, stats de base éditables, niveau, stats calculées
  - Défauts : Bulbasaur (joueur, en bas face Nord) vs Dummy custom (en haut face Sud)
  - Copier URL : génère l'URL complète avec tous les query params
  - Sprite clone PMDCollab (#0000 form 1) pour le dummy
  - Pokemon "Dummy" ajouté aux data (Normal, 100/50/50/50/50/50, movepool défensif)
  - Écran de victoire + Restart en HTML overlay (fix bug hitbox Phaser 4 avec camera zoom)
  - **Blast + Protect** : `defense-check.ts` utilise `targetPosition` (centre d'explosion) pour Blast — cibler derrière un défenseur contourne Protect
  - **8 moves défensifs** dans le core avec handlers testés :
    - Protect/Detect : bloque de face (direction checking)
    - Wide Guard : bloque AoE (zone, cross, cone, slash, blast)
    - Quick Guard : bloque 1 coup, toute direction, consommé
    - Counter : renvoie x2 physique adjacent
    - Mirror Coat : renvoie x2 spécial (toute portée)
    - Metal Burst : renvoie x1.5 physique+spécial
    - Endure : survit à 1 HP, spam check (pas 2 tours de suite)
  - Infrastructure core : `DefensiveKind` enum, `ActiveDefense` type, `defense-check.ts`, `handle-defensive.ts`, `defensive-clear-handler.ts`
  - Events : `DefenseActivated`, `DefenseCleared`, `DefenseTriggered`
  - **56 moves** dans le roster (48 + 8 défensifs)
  - Build OK, TypeScript OK, Vite build OK

- **Refonte orchestration agents (2026-04-01)** :
  - 2 nouveaux agents : `commit-message` (propose message de commit depuis contexte + `git diff`, appelé par `session-closer`) et `sandbox-url` (génère URLs sandbox depuis description en langage naturel)
  - `code-reviewer` allégé : ne propose plus de message de commit (délégué à `commit-message`)
  - `session-closer` chaîne désormais vers `commit-message` si changements non commités
  - Flow plan revu : `core-guardian` aux étapes intermédiaires, review + doc-keeper reportés en fin de plan, `visual-tester` automatique en fin de plan renderer
  - 21 agents actifs au total

- **Plan 026 terminé** — Roster expansion Phase 1 (mécaniques + moves) :
  - **6 nouvelles mécaniques core** :
    - `StatusType.BadlyPoisoned` : poison grave, `toxicCounter` sur `PokemonInstance`, dégâts croissants 1/16 → 15/16/tour, cap 15
    - Confusion tactique : statut volatil via `volatileStatuses: VolatileStatus[]` sur `PokemonInstance`, redirection vers allié aléatoire (single/dash), direction aléatoire (AoE), tour perdu si aucun allié
    - Bind (`LinkType.Bind`) : extension `ActiveLink` avec `immobilize?: boolean` + `drainToSource?: boolean`, empêche le Move, dégâts 1/16/tour, rupture distance > 1 ou KO lanceur
    - Knockback (`EffectKind.Knockback`) : pousse 1 case direction opposée, bloqué par bord/occupant/corps KO
    - Multi-hit : champ `hits?: number | { min: number; max: number }` sur effet Damage, fixe (x2) ou variable (2-5, probas 35/35/15/15%), stop si KO
    - Recharge : flag `recharging: boolean` sur `PokemonInstance`, bloque `use_move` au tour suivant, autorise Move
  - **17 nouveaux moves** : toxic, supersonic, swords-dance, iron-defense, double-kick, fury-swipes, hyper-beam, dragon-tail, wrap, growl, roar, flash, acid, earthquake, mega-punch, slash, poison-sting
  - **42 nouveaux tests** — **595 tests au total**, 100% coverage maintenu
  - Décisions techniques D1-D7 (decisions.md #150-156)

- **Plan 025 terminé** — Tests d'intégration par move + mécaniques transversales :
  - 56 fichiers de test créés dans `packages/core/src/battle/moves/` (un par move)
  - Helper `buildMoveTestEngine` dans `packages/core/src/testing/build-move-test-engine.ts`, exporté depuis `testing/index.ts`
  - Chaque move couvert : hit à portée, miss hors portée, effets secondaires (statuts, stat changes, défenses)
  - **9 fichiers de mécaniques transversales** dans `packages/core/src/battle/mechanics/` :
    - `stab.test.ts` : x1.5 STAB
    - `type-effectiveness.test.ts` : x0 / x0.25 / x0.5 / x2 / x4
    - `burn-status.test.ts` : tick 1/16 HP + penalty -50% physique
    - `poison-status.test.ts` : tick 1/8 HP + kill
    - `paralysis-status.test.ts` : blocage move/dash + impact initiative
    - `sleep-status.test.ts` : skip tour + réveil
    - `freeze-status.test.ts` : skip tour + dégel
    - `pp-consumption.test.ts` : décrément PP + épuisement
    - `friendly-fire.test.ts` : dégâts AoE sur alliés
  - **Gaps comblés** dans les tests existants : +2 tests leech-seed (rupture KO source, distance > maxRange), +2 rollout (dash vide, hasMoved non consommé), +2 volt-tackle (idem), +1 counter (distance > 1), +1 endure (coup non fatal), +1 quick-guard (2e attaque post-consommation)
  - **Nettoyage doublons** : `BattleEngine.integration.test.ts` -2 tests (Sludge Bomb blast + Ember vs Razor Leaf), `battle-loop.integration.test.ts` -3 tests (poison kills, paralysis restricts, paralysis initiative) — désormais couverts dans les fichiers mechanics/
  - **`test-writer.md`** mis à jour : section maintenance tests par move et mechanics, audit de cohérence, templates par pattern
  - **`CLAUDE.md`** mis à jour : nouveau déclencheur "Ajout/suppression/modif d'un move → test-writer"
  - **534 tests unitaires** (91 fichiers) + **48 tests intégration** (4 fichiers) = **582 tests**, 0 régressions, build OK

- **Plan 027 terminé** — Roster élargi 12 → 20 Pokemon :
  - **8 nouveaux Pokemon** dans `packages/data/src/base/pokemon.ts` : Évoli, Tentacool, Nidoran♂, Miaouss, Magnéti, Sabelette, Excelangue, Kangourex
  - Sprites PMDCollab extraits pour les 8 Pokemon (atlas + portraits + offsets.json)
  - `docs/roster-poc.md` mis à jour avec les 8 fiches Pokemon et leurs movesets
  - `docs/roadmap.md` : "Roster élargi (~20 Pokemon)" coché

- **Bugfix DummyAiController — événements non animés (2026-04-02)** :
  - `DummyAiController.playTurn()` retourne désormais `BattleEvent[]` au lieu de `void`
  - `GameController.onTurnReady` accepte `BattleEvent[] | false` et anime les événements du Dummy via `processEvents()`
  - Résout le bug où les dégâts de bind/status tick du tour Dummy n'étaient pas visibles (HP bars, flash dégâts, etc.)
  - `wrap.test.ts` ajouté dans `packages/core/src/battle/moves/` : "deals 1/16 max HP per turn to the bound target (no heal to source)"
  - **596 tests**, build OK

- **Plan 029 terminé** — IA jouable avec niveaux de difficulté :
  - `packages/core/src/enums/ai-difficulty.ts` : `AiDifficulty` enum (`easy`/`medium`/`hard`)
  - `packages/core/src/types/ai-profile.ts` : interface `AiProfile` (difficulty, randomWeight, scoringWeights)
  - `packages/core/src/ai/ai-profiles.ts` : `EASY_PROFILE` (randomWeight 0.4), `MEDIUM_PROFILE`, `HARD_PROFILE`
  - `packages/core/src/ai/action-scorer.ts` : `scoreAction()` — kill potential, type advantage, positioning, stat changes
  - `packages/core/src/ai/scored-ai.ts` : `pickScoredAction()` — sélecteur pondéré top-N avec bruit intentionnel, filtrage scores négatifs
  - `packages/renderer/src/game/AiTeamController.ts` : gère un tour complet d'une équipe IA (move + attack + end turn)
  - Player2 = IA Easy par défaut en mode normal (`BattleScene` + `BattleSetup`)
  - `scenarios/human-vs-easy-ai.scenario.test.ts` : smoke test 6v6 Aggressive vs Easy, victoire détectée sans boucle infinie
  - **671 tests** (659 + 12 nouveaux), 126 fichiers, build + lint clean

- **Améliorations IA post-plan (2026-04-03)** :
  - `EndTurn` orienté vers l'ennemi le plus proche (au lieu de direction aléatoire)
  - Scoring basé sur les tiles réellement affectées via `estimateAffectedTiles` (au lieu du centre de zone)
  - Friendly fire penalty dans `scoreAction` : malus si alliés dans la zone d'effet
  - Self-buffs intelligents : score réduit si l'ennemi est trop loin pour que le buff soit utile
  - Lookahead move+attack : `scoreAction` évalue les attaques possibles depuis la destination avant de scorer le déplacement
  - Filtrage scores négatifs : `pickScoredAction` ignore les actions avec score ≤ 0 (l'IA n'attaque plus dans le vide)

- **Bug fixes (2026-04-03)** :
  - Volt Tackle dash sur cadavre : `continue` au lieu de `break` dans la boucle de traversée — le caster traverse les corps KO mais ne s'arrête pas dessus
  - Status icon reste visible après KO : nettoyée dans `playFaintAndStay()` dans `PokemonSprite.ts`
  - Golden replay régénéré : 10 rounds, 129 actions (était 32 rounds / 247 actions avec l'ancienne IA aggressive)

- **Documentation IA (2026-04-03)** :
  - `docs/ai-system.md` créé : architecture IA, pipeline scoring, niveaux de difficulté, décisions de design
  - `decisions.md` : décisions #163–167 ajoutées (scoring découplé, profils clones pour l'instant, bruit top-3, AiTeamController dans renderer, extraction Phase 5)

- **Plan 033 terminé + améliorations UI post-review** — Écran de sélection d'équipe (Team Select) :
  - `TeamSelectScene` : premier écran du jeu, grille 5x4 de portraits, sélection d'équipe jusqu'à 6 Pokemon distincts par équipe
  - `validateTeamSelection()` dans le core avec `TeamValidationError` const enum, `TeamSelection` et `TeamValidationResult` types
  - `MockTeamSelection` dans `packages/core/src/testing/`, erreurs i18n
  - `preloadPortraitsOnly()` dans `SpriteLoader` : charge uniquement les portraits sans les atlas complets
  - 16 clés i18n `teamSelect.*` (FR + EN) — noms Pokemon traduits (20 Pokemon)
  - Toggle Humain/IA par joueur sur la même ligne que "Joueur X" — IA vs IA possible (auto-placement des deux équipes)
  - Bouton "Auto" re-randomize l'équipe à chaque clic (pas de fill progressif)
  - Bouton "Vider" (Clear) pour réinitialiser une équipe
  - Bouton "Valider" par équipe avec feedback d'erreur, verrouillage/déverrouillage
  - Bouton "Lancer le combat" + toggle "Placement auto / Placement manuel" sur la même ligne
  - Bouton "Retour au menu" dans l'écran de victoire (en plus de Rejouer)
  - **Slots colorés** : couleur d'équipe (bleu J1, rouge J2) sur les encadrés de slots
  - **Deux encadrés toujours visibles** : actif lumineux, inactif discret
  - **Zones de spawn** sur la carte poc-arena colorées selon les équipes (bleu/rouge au lieu de bleu/gris générique)
  - **Grille de portraits agrandie** : 82px (au lieu de 64px), noms sans débordement
  - Boutons Valider/Auto/Vider répartis uniformément en bas de chaque panel
  - `BattleScene` reçoit les équipes depuis `TeamSelectScene` (plus de `defaultTeams` hardcodé)
  - Flow : `TeamSelectScene` → `BattleScene` (placement) → Combat
  - Mode sandbox (`?sandbox`) bypass `TeamSelectScene` via `parseSandboxQueryParams()`
  - `main.ts` : ordre des scènes `[TeamSelectScene, BattleScene, BattleUIScene]`
  - **664 tests**, build OK

- **Plan 032 terminé** — Portée de déplacement variable par Pokemon :
  - `computeMovement(baseSpeed, speedStages)` dans `stat-modifier.ts` — formule basée sur effective speed avec paliers 2-7 (≤20→2, 21-45→3, 46-85→4, 86-170→5, 171-340→6, ≥341→7)
  - Recalcul dynamique de `derivedStats.movement` après chaque changement de speed stages (Hâte, etc.)
  - `BattleSetup.ts` et helpers de test ne hardcodent plus `movement: 3`
  - Mocks `MockPokemon` recalculés selon la base speed réelle de chaque espèce
  - Golden replay mis à jour
  - `movement-stages.test.ts` : test intégration Gherkin (Hâte agrandit la portée, Rugissement la réduit, plancher 2 respecté)
  - **705 tests**, build OK

- **Plan 031 terminé + corrections post-review** — Feedbacks visuels de combat + refactor statuts volatils :
  - **BattleText** : système de textes flottants unifiés (dégâts, miss, effectiveness, stat changes, statuts, knockback, piège, etc.) — fire-and-forget, knockback enchaîne pendant le hit
  - **Textes flottants ralentis** : durée 2200ms (au lieu de 1000ms) pour lisibilité
  - **Knockback slide** : animation de glissement de la cible repoussée
  - **Confusion wobble permanent** : rotation oscillante en continu sur le sprite confus (pas one-shot), stoppée à la guérison
  - **5 niveaux d'efficacité style Pokemon Champions** : x4 "Extremely effective" / "Extrêmement efficace", x2 "Super effective", x0.5 "Not very effective", x0.25 "Mostly ineffective" / "Quasi inefficace", x0 "No effect" / "Immune"
  - **Immune post-attaque** : "No effect" / "Immunisé" affiché sous forme de texte flottant après l'attaque (pas uniquement en preview)
  - **Badges volatils dans l'InfoPanel** : Confusion, Vampigraine, Piégé fusionnés avec les badges stat stages existants
  - **Refactor core** : `ActiveLink` → statuts volatils `Seeded` (Vampigraine) et `Trapped` (Piège), suppression complète du système de liens (`LinkType`, `ActiveLink`, `link-drain-handler`, `link-broken-handler`)
  - **Vampigraine** : statut `Seeded` avec `sourceId`, drain 1/8 HP/tour + heal lanceur, pas de maxRange, immunité Plante
  - **Piège (Trapped)** : statut volatil, immobilise + 1/8 HP/tour pendant N tours, sortie par knockback/dash reçu
  - **Icônes statut volatils** : `Seeded` et `Trapped` affichés dans la timeline et sur le sprite
  - **i18n** : nouvelles clés pour les textes de feedback (miss, critique, statuts volatils, etc.)
  - **630 tests**, 122 fichiers, build + lint clean

- **Plan 030 terminé** — i18n FR/EN :
  - Système i18n maison (~70 lignes) dans `packages/renderer/src/i18n/` : `t()`, `setLanguage()`, `detectLanguage()`, `onLanguageChange()`, persistance localStorage, const enum `Language`
  - 16 tests dans `packages/renderer/src/i18n/index.test.ts`
  - Fichiers de données localisées dans `packages/data/src/i18n/` : `pokemon-names.fr.json`, `pokemon-names.en.json`, `moves.en.json` (+ `moves.fr.json` existant réutilisé)
  - `getMoveName(id, lang)` et `getPokemonName(id, lang)` exportés depuis `@pokemon-tactic/data`
  - 7 fichiers UI migrés (plus aucun texte hardcodé) : ActionMenu, BattleUI, InfoPanel, MoveTooltip, PlacementRosterPanel, SandboxPanel, GameController
  - Bouton bascule FR/EN (coin haut gauche) via `LanguageToggle.ts` — restart de scène Phaser au changement
  - Détection auto de la langue navigateur au démarrage (navigator.language → 'fr' si commence par 'fr', sinon 'en')
  - **687 tests**, build OK

- **Plan 028 terminé** — Replay déterministe avec PRNG seedé :
  - `packages/core/src/utils/prng.ts` : PRNG mulberry32 seedé (`createPrng(seed)`), `RandomFn` type exporté
  - PRNG injecté dans tout le core : `BattleEngine`, `accuracy-check.ts`, `damage-calculator.ts`, handlers (`handle-status.ts`, `handle-damage.ts`, `status-tick-handler.ts`)
  - `EffectContext` étendu avec champ `random: RandomFn` — zéro `Math.random()` direct dans `packages/core/src/battle/`
  - `packages/core/src/types/battle-replay.ts` : type `BattleReplay { seed, actions[] }`
  - `BattleEngine.submitAction` : enregistre chaque action dans `recordedActions` (si seed fourni)
  - `BattleEngine.exportReplay()` : retourne `{ seed, actions }` sérialisable JSON
  - `packages/core/src/battle/replay-runner.ts` : `runReplay(replay, buildEngine)` — rejoue un combat action par action
  - `packages/core/src/ai/random-ai.ts` : pioche une action légale au hasard via `RandomFn`
  - `packages/core/src/ai/aggressive-ai.ts` : fonce vers l'ennemi le plus proche (BFS), tape avec le move le plus puissant si portée
  - `scripts/generate-golden-replay.ts` : script 3v3 aggressive vs aggressive sur poc-arena, seed 12345
  - `fixtures/replays/golden-replay.json` : replay golden commité (Player 1 gagne en 32 rounds, 247 actions)
  - `packages/core/src/battle/golden-replay.test.ts` : test de non-régression — lit le golden, rejoue, vérifie état final
  - Fix préexistant : `BattleEngine.integration.test.ts` attendait 13 Pokemon au lieu de 21
  - **659 tests** (648 + 11 nouveaux), build OK

- **Plan 024 terminé** — Bugfixes sandbox + relocalisation menu d'action (non commité) :
  - **Fix status au spawn** : `PokemonSprite.ts` constructeur appelle `updateStatus()` + `setStatusAnimation()` — les statuts pré-existants (burn, sleep, etc.) s'affichent dès le spawn (`?sandbox&status=burned` fonctionne)
  - **Fix Vampigraine HP bar** : `GameController.ts` handler `LinkDrained` ajoute `await targetSprite.flashDamage()` avant `updateHp()` — force le cycle de rendu Phaser, la barre descend visuellement
  - **Menu d'action relocalisé en bas à droite** : `ACTION_MENU_X = 1054`, `ACTION_MENU_BOTTOM_Y = 700` — menu aligné avec le bas de l'InfoPanel, grandit vers le haut. `MoveTooltip` à gauche du menu, clampé verticalement.
  - Note : le plan 024 prévoyait initialement le menu en bas à gauche (X=16), la position finale choisie est bas à droite (X=1054) pour ne pas chevaucher la timeline 12 Pokemon.
  - **333 tests**, 0 régressions, build OK, vérification visuelle OK

- **Plan 037 terminé** — Battle Log Panel :
  - **`BattleLogFormatter`** : traduit chaque `BattleEvent` en message texte i18n FR/EN — TurnStarted, MoveStarted, DamageDealt (avec effectiveness), MoveMissed, StatusApplied/Removed, StatChanged, PokemonKo, DefenseActivated/Triggered, ConfusionTriggered, KnockbackApplied, MultiHitComplete, RechargeStarted, BattleEnded
  - **Couleurs par type de message** : dégâts rouge, stat up bleu, stat down rouge, statut orange, défense vert, KO rouge vif, effectiveness jaune
  - **`BattleLogPanel`** : panel Phaser en haut à droite de `BattleUIScene`, scroll interne (molette), auto-scroll bas à chaque nouveau message
  - **Noms Pokemon cliquables** → `camera.pan()` vers le Pokemon ciblé
  - **Pliable/dépliable** via header toggle (icône burger ☰ en état replié)
  - **Barre d'actions replay** grisée réservée pour le futur (⏮ ⏪ ▶ ⏩ ⏭)
  - **41 tests unitaires** pour `BattleLogFormatter`
  - **694 tests total**, build OK

- **Plan 037 — corrections post-review** :
  - Burger ☰ aligné à droite (même position ouvert/fermé)
  - Panel fermé par défaut
  - Titre traduit i18n ("Journal de combat" FR / "Battle Log" EN)
  - Scroll molette fonctionnel (écoute `scene.input.on wheel` avec bounds check)
  - Boutons replay en caractères non-emoji (◁▷) pour éviter le rendu orange natif du système
  - Clic sur ligne → camera pan vers le Pokemon mentionné (via `gridToScreen`)
  - Pastille couleur d'équipe (dot) devant chaque ligne mentionnant un Pokemon
  - Nettoyage code mort : suppression `getTeamId`, non-null assertions, fuite mémoire `scrollZone`
  - **694 tests**, build OK

- **Bugfixes post-plan 039 (2026-04-05)** — 699 tests, build OK :
  - Fix `DirectionPicker` : import `DIRECTION_DIRECTION_INACTIVE_TINT` → `DIRECTION_INACTIVE_TINT` (constante mal nommée provoquait un crash au moment du choix de direction en fin de tour)
  - Fix portée ennemie hover : phases `select_attack_target` et `confirm_attack` retirées des `validPhases` de `handleEnemyRangeHover` — la portée de déplacement ennemi n'est plus affichée pendant la sélection/confirmation d'une cible d'attaque
  - Fix direction IA : champ `direction: Direction` ajouté à l'event `MoveStarted` — le renderer lit la direction capturée au moment de l'attaque, pas le state final après toutes les actions IA
  - Fix self-target direction : un move self-target (Charge, buffs) ne change plus l'orientation du Pokemon — il garde son orientation courante

- **Plan 039 terminé** — Animations de combat : direction, catégorie de move, pipeline sprites :
  - **`packages/data/src/base/animation-category.ts`** : `AnimationCategory` enum (`Contact`/`Shoot`/`Charge`) + `moveAnimationCategory` — 73 moves classifiés
  - **Pipeline sprites** : 3 nouvelles animations PMDCollab extraites pour tout le roster (Shoot, Charge, Hop). Charmander et Sandshrew n'ont pas de Shoot disponible sur PMDCollab (404). Fix script d'extraction : exclusion des animations dont le PNG est absent.
  - **Direction pendant déplacement** : les sprites tournent à chaque step du chemin
  - **Direction avant attaque** : le sprite se tourne vers la cible avant de jouer l'animation (orientation lue depuis le state core)
  - **Animation par catégorie** : Contact → Attack, Shoot → Shoot, Charge → Charge, avec fallback Attack si l'animation est manquante pour ce Pokemon
  - **`PokemonSprite`** : tracking de `gridPosition`, méthode `playAnimationOnce(anim, fallback?)` avec fallback optionnel
  - **699 tests**, build OK

- **Plan 038 terminé** — Portée de déplacement des ennemis au hover :
  - **Core** : `BattleEngine.getReachableTilesForPokemon(pokemonId)` — méthode publique, retourne `Position[]` accessibles (hors position courante, hors ennemis vivants), `[]` si KO/inexistant/battleOver
  - **Renderer IsometricGrid** : layer dédié `enemyRangeGraphics` avec `DEPTH_GRID_ENEMY_RANGE` (entre highlight et preview), méthodes `showEnemyRange(positions)` et `clearEnemyRangeHighlight()`
  - **Renderer GameController** : `handleEnemyRangeHover(hoveredPokemon)` — affiche l'overlay orange uniquement sur les ennemis hors tour, cache `hoveredEnemyRangePokemonId` anti-recalcul
  - **Renderer BattleScene** : `pointermove` appelle `handleEnemyRangeHover` après calcul du `hoveredPokemon`
  - **Constantes** : `TILE_HIGHLIGHT_ENEMY_RANGE_COLOR`, `DEPTH_GRID_ENEMY_RANGE`, `HighlightKind.EnemyRange` + centralisation de ~30 couleurs (BattleLogColors, tooltip cells, buttons, text colors, etc.)
  - **Doc** : `docs/design-system.md` créé — inventaire complet des couleurs, palette, conventions visuelles
  - **5 tests unitaires** pour `getReachableTilesForPokemon` (portée correcte, KO, bataille terminée)
  - **699 tests total**, build OK

- **Plan 036 terminé** — Menu principal, Settings et Disclaimer :
  - **4 nouvelles scènes** : `MainMenuScene` (point d'entrée du jeu), `BattleModeScene` (sous-menu Local/En ligne grisé/Tutoriel grisé), `SettingsScene` (damage preview toggle + langue), `CreditsScene` (disclaimer fan project + attribution sprites)
  - **Module settings** : `packages/renderer/src/settings/index.ts` — `GameSettings { damagePreview: boolean }`, `getSettings()` / `updateSettings()`, persistance `localStorage("pt-settings")`
  - **`GameController`** : `showDamageEstimates()` conditionné sur `settings.damagePreview`
  - **`BattleUI`** : bouton "Retour" mène désormais à `MainMenuScene` (au lieu de `TeamSelectScene`)
  - **`main.ts`** : `MainMenuScene` comme première scène en mode normal — le mode sandbox (`VITE_SANDBOX`) bypass directement vers `TeamSelectScene`
  - **i18n** : ~20 nouvelles clés ajoutées (`menu.*`, `battleMode.*`, `settings.*`, `credits.*`) en FR et EN
  - Boutons Aventure / En ligne / Tutoriel visibles mais grisés (Phase 9 / Phase 7)
  - Version statique affichée en bas à gauche de `MainMenuScene`
  - `LanguageToggle` repositionné dans `MainMenuScene`

- **Plan 035 terminé** — Sandbox CLI : suppression query params + accès JSON :
  - Suppression de tous les query params URL (`?sandbox`, `?random`, `?pokemon`, etc.) — mode sandbox invisible depuis une URL partagée
  - Sandbox activé uniquement via variable d'environnement Vite `VITE_SANDBOX` (injectée par `pnpm dev:sandbox`)
  - Script CLI : `pnpm dev:sandbox [config.json | '{json}']` — config par défaut si aucun argument
  - `SandboxConfig.ts` : type `SandboxConfig` + constante `DEFAULT_SANDBOX_CONFIG`
  - `sandbox-boot.ts` : module de boot conditionnel, `TeamSelectScene` redirige vers `BattleScene` en mode sandbox
  - Bouton "Copier URL" → **"Exporter JSON"** : copie la config courante en JSON dans le presse-papier
  - `sandbox-configs/` : répertoire de fichiers JSON d'exemple prêts à l'emploi
  - `env.d.ts` : types Vite pour `VITE_SANDBOX` / `VITE_SANDBOX_CONFIG`
  - Agent `sandbox-url` → **`sandbox-json`** : génère des configs JSON (plus des URLs) depuis une description en langage naturel
  - `CLAUDE.md` + `docs/architecture.md` + `README.md` mis à jour
  - **653 tests** (705 → 653 : suppression de `sandbox-query-params.test.ts` — 92 tests intentionnellement retirés avec le code source), build OK

- **Plan 040 terminé** — Hot-seat multi-équipes :
  - `PlayerId` étendu à 12 valeurs (`Player1`–`Player12`)
  - `PlacementPhase` : serpentine généralisée à N équipes (`P1-P2-...-PN-PN-...-P1-P1-...`)
  - `TeamSelectResult` : tableau dynamique `Team[]` (était tuple `[Team, Team]`)
  - `poc-arena` redimensionnée 12×12 → 12×20 avec formats 2/3/4/6/12 équipes et zones de spawn dédiées
  - `TEAM_COLORS[12]` dans `constants.ts` — 12 couleurs distinctes, indexées par `playerIndex`
  - InfoPanel, TurnTimeline, BattleLogPanel, zones de spawn : tous utilisent `TEAM_COLORS` (plus de ternaires hardcodés)
  - `BattleScene` : génération d'IDs Pokemon en boucle générique (`p${i+1}-${name}`)
  - `BattleSetup` : suppression des hypothèses 2-équipes
  - `TeamSelectScene` : sélecteur de nombre d'équipes (bouton cyclique), layout 2 colonnes dynamique, blocs standard (3-6 pkm/équipe) et lignes compactes (1-2 pkm/équipe), bouton "Remplir IA" global
  - `IsometricGrid` : support grilles rectangulaires (`gridWidth × gridHeight`)
  - Camera bounds = grille + demi-grille de marge
  - **699 tests**, build OK

- **Publication du projet — Phase 2 terminée (2026-04-06)** :
  - **README.md** réécrit en anglais (minimaliste, pitch + screenshot + feedback + credits)
  - **LICENSE MIT** créé (avec note CC BY-NC 4.0 pour les sprites)
  - **Issue templates GitHub** : `.github/ISSUE_TEMPLATE/` (bug, feature, feedback)
  - **Structure nettoyée** : `plans/` → `docs/plans/`, `fixtures/` → `packages/core/fixtures/`, `sandbox-configs/` → `packages/data/sandbox-configs/`
  - **Wiki joueur** initialisé en submodule git (Home, How to Play, Roadmap)
  - **CI GitHub Actions** : `ci.yml` (lint + typecheck + test), `deploy.yml` (build + GitHub Pages sur release)
  - **GitHub Pages** fonctionnel : https://kekel87.github.io/pokemon-tactics/
  - **Config GitHub** : description, 8 topics, wiki activé, issues activées, homepage
  - **Vite base path** configuré pour GitHub Pages
  - **Draft release v2026.4.1** créée (CalVer YYYY.MM.XX)
  - **5 nouveaux agents** : `feedback-triager`, `wiki-keeper`, `release-drafter`, `publisher` (profil GitHub mis à jour)
  - **Fix lint + typecheck** : ~100 violations Biome corrigées, `biome.json` overrides tests/renderer, `useExplicitType` en warn, `tsconfig` packages `exclude .test.ts`, code mort supprimé
  - `code-reviewer.md` + `CLAUDE.md` + `publisher.md` : lint + typecheck + test obligatoires avant commit

- **Plan 041 terminé** — Analytics Goatcounter :
  - Plugin Vite injecte le script Goatcounter uniquement en production (`mode === 'production'`)
  - Sans cookies, conforme RGPD, zéro impact dev local

- **Plan 042 terminé** — Bugfixes et feedback playtest :
  - **HP bar couleur d'équipe** : `PokemonSprite.ts`, `InfoPanel.ts` — couleur indexée via `TEAM_COLORS[playerIndex]`, remplace gradient vert/jaune/rouge (décision #216)
  - **Preview dégâts noir semi-transparent** : `PokemonSprite.ts`, constante `DAMAGE_PREVIEW_COLOR` dans `constants.ts` — remplace rouge qui se confondait avec l'équipe 2 (décision #217)
  - **Border blanc badges statut** : `InfoPanel.ts` — `setStrokeStyle` blanc sur les rectangles de badges (décision #219)
  - **Raccourcis clavier** : Espace → end turn, C → recentrer caméra — `BattleScene.ts`, `GameController.ts` (décision #218)
  - **Fix IA vs IA sans écran de victoire** : `GameController.ts` — le flow BattleEnded → showVictory fonctionne désormais en mode spectateur

- **Plan 043 terminé** — Tileset arène Pokemon + intégration renderer :
  - **ICON Isometric Pack (Jao)** : tileset pixel art retenu (licence libre), tiles 32×32 scalées ×2 avec filtre NEAREST — PixelLab évalué mais pas encore au niveau pour ce usage
  - **IsometricGrid** : `drawGrid()` remplace les polygones `Graphics.fillStyle` par des `scene.add.image()` texturés, variantes de tiles pseudo-aléatoires (15%)
  - **BattleScene** : preload spritesheet tileset 32×32, filtre NEAREST pour pixels nets
  - **Marquages d'arène** : pokeball centrale + lignes latérales en overlay Graphics au-dessus des tiles
  - **constants.ts** : `TILESET_KEY`, `TILE_ORIGIN_Y=0.25`, `TILE_SPRITE_SCALE=2`, frames arène, couleurs/alpha marquages
  - **CreditsScene + i18n FR/EN** : crédit Jao (ICON Isometric Pack) ajouté
  - **asset-manager.md** : géométrie ICON, paramètres PixelLab (view angle 30°, depth ratio 0.5), bonnes pratiques prompts, workflow pilote → style_images

- **Plan 044 terminé** — Mode pixel art + police Pokemon Emerald Pro :
  - **`roundPixels: true`** dans la config Phaser (aligne les sprites sur les pixels entiers sans affecter le texte) — `pixelArt: true` écarté car il applique NEAREST aux textures de texte (BitmapText), les rendant flous
  - **`setFilter(NEAREST)` restauré manuellement** sur les textures tileset (`BattleScene`) et sprites Pokemon (`PokemonSprite`)
  - **Suppression de `applyPortraitFilters()`** — sans `pixelArt: true`, les portraits restent en LINEAR par défaut
  - **Suppression POKEMON_SPRITE_SCALE=2 et TILE_SPRITE_SCALE=2** (désormais 1), tiles réduites à 32×16 (était 64×32), zoom doublé en compensation (`ZOOM_LEVELS` ×2)
  - **HP bars sprites** : `HP_BAR_HEIGHT=2`, pas de padding interne, fill pleine hauteur + stroke extérieur ; `HP_BAR_PANEL_HEIGHT=6` dans l'InfoPanel (découplé)
  - **Flèches de direction** : `ARROW_SCALE` 0.7→0.35, `SPREAD` 22→11, `VERTICAL_OFFSET` -30→-15 (divisés par 2 avec le reste des constantes world-space)
  - **Tailles de police augmentées ~50–80%** dans tous les fichiers UI pour compenser le rendu plus petit de la police pixel
  - **Constante `FONT_FAMILY`** dans `constants.ts` : valeur `"Pokemon Emerald Pro, monospace"` — remplace toutes les occurrences hardcodées `"monospace"` (14 fichiers)
  - **`@font-face` CSS** déclaré WOFF2 + TTF fallback (WOFF2 a des problèmes CFF sur certains navigateurs) — **fichier non encore téléchargé** : `public/assets/fonts/pokemon-emerald-pro.ttf` manquant, fallback `monospace` actif
  - **Toutes les constantes world-space** divisées par 2 (HP bars, tailles de texte, offsets) pour correspondre aux nouvelles dimensions de grille

- **Plan 045 terminé** — Format de carte Tiled + parser + validation + preview :
  - **`TerrainType` étendu à 11 valeurs** : Normal, TallGrass, Obstacle, Water, DeepWater, Magma, Lava, Ice, Sand, Snow, Swamp — effets gameplay réservés à un plan séparé
  - **`isPassable` supprimé de `TileState`** — passabilité déterminée par `isTerrainPassable(terrain)` partout dans le codebase (Grid, validateMap, BattleSetup, mocks, tests)
  - **`packages/data/src/tiled/`** : pipeline complet Tiled→MapDefinition
    - `tiled-types.ts` : interfaces TiledMap, TiledLayer, TiledObject, TiledTileset, TiledTile, TiledProperty
    - `tileset-resolver.ts` : `resolveTileProperties(gid, tileset)` → `{ terrain, height }` ; GID 0 = obstacle implicite
    - `parse-terrain-layer.ts` : TiledLayer → `TileState[][]`
    - `parse-spawns-layer.ts` : objets Tiled (teamIndex + formatTeamCount) → `MapFormat[]` avec conversion pixel iso → coords grille
    - `parse-tiled-map.ts` : `parseTiledMap(json)` → `ParseResult` (`{ map, warnings }` | `{ errors }`)
    - `validate-tiled-map.ts` : règles bloquantes (spawn sur tiles passables, BFS connectivité) + warnings (hauteurs incohérentes, spawns sur terrains hostiles)
    - `load-tiled-map.ts` : `loadTiledMap(url)` → `Promise<MapDefinition>` (fetch + parse + validate, zéro Phaser)
  - **Tilesets externes `.tsj` supportés** (en plus des tilesets embarqués dans le .tmj)
  - **3 cartes `.tmj`** dans `packages/renderer/public/assets/maps/` :
    - `test-arena.tmj` — version iso de `poc-arena` (12×20, 2 équipes, tileset externe `icon-tileset.tsj`)
    - `river-crossing.tmj` — carte de test avec eau/traversée, valide les terrains non-passables
    - `tile-palette.tmj` — palette complète des 11 terrains pour vérification visuelle
  - **`MapPreviewScene` + `MapPreviewUIScene`** dans `packages/renderer/src/scenes/` — `pnpm dev:map <fichier.tmj>` affiche la carte sans combat ; zoom molette, pan clic+drag, R pour recharger, spawn zones colorées par équipe ; `MapPreviewUIScene` overlay : nom de la carte, cycle de formats (T ou clic) `[n/total]`
  - **`packages/renderer/scripts/map-preview.js`** : Vite plugin Node.js qui résout le chemin .tmj depuis le cwd appelant et injecte `VITE_MAP_FILE` pour le mode preview
  - `packages/data/src/index.ts` exporte le module tiled complet

- **Plan 046 terminé** — Dénivelés, hauteur des tiles et dégâts de chute :
  - **Core** : `canTraverse` (montée max 0.5, descente libre, Vol jamais bloqué), `getHeightModifier` (±10%/niveau, plafonds +50%/-30%), `isMeleeBlockedByHeight` (mêlée bloquée si diff ≥ 2), `calculateFallDamage` (paliers Math.floor(diff) → 33/66/100%)
  - **BFS** : filtrage asymétrique montée/descente dans `getReachableTiles` et `validateMovePath`, Vol ignore la hauteur
  - **Dégâts de chute** : knockback ET dash vers tile plus basse, paliers 2→33%, 3→66%, 4→mort. Vol immunisé. Endure ne protège pas.
  - **`ignoresHeight?: boolean`** sur `MoveDefinition` — Séisme marqué `ignoresHeight: true` dans `packages/data`
  - **Renderer** : `gridToScreen(x, y, height)` + `TILE_ELEVATION_STEP=8`, tiles surélevées, sprites décalés verticalement par hauteur, animation Hop/Walk selon `heightDiff`, feedback visuel "Fall -XX" en orange
  - **Data** : map `highlands.tmj` (12×12) avec hauteurs 0–3, plateau central h2, rampes h1, tour h3, fossé h0
  - **45 nouveaux tests** (unit + intégration scénarios Gherkin)
  - `BattleEventType.FallDamageDealt` ajouté

- **Plan 046 — 6 vagues de feedback playtest sandbox (2026-04-11)** :
  - Core : `canTraverse` limite la descente volontaire à 1.0 (Vol exempté)
  - Data : `tileset-resolver` + `parse-tiled-map` propagent la propriété `slope` via `slopeData` dans `ParseSuccess`/`LoadedTiledMap`
  - Renderer : `IsometricGrid.isSlopeAt(x, y)` expose les rampes à `GameController.animateAlongPath`
  - Renderer : `packages/renderer/src/game/movement-animation.ts` — `MovementStep { heightDiff, isRamp, isFlying }`, `isJumpStep`, `selectMovementAnimation`, `selectMovementDuration`, `FLYING_JUMP_ANIMATION_CANDIDATES`
  - Renderer : `PokemonSprite.animateMoveTo` — single diagonal tween `{ x: Linear, y: Quad.easeOut|easeIn }` pour les jumps, depth fixée à `max(source, target)` pendant le tween puis snap
  - Renderer : `PokemonSprite.playAnimation` ne skip que les anims loopées (`repeat === -1`) — Hop/Attack/Hurt redémarrent à chaque appel
  - Renderer : i18n key `battle.fall` (Chute/Fall), wirée sur `FallDamageDealt`
  - Renderer : `packages/renderer/src/scenes/camera-bounds.ts` — pure function extraite + test
  - Renderer : constantes `JUMP_TWEEN_DURATION_MS=800`, `MOVE_TWEEN_DURATION_FLYING_MS=400`, `BATTLE_TEXT_FONT_SIZE=10`, `BATTLE_TEXT_DURATION_MS=3500`, `BATTLE_TEXT_DRIFT_Y=-20`, `BATTLE_TEXT_STAGGER_Y=-10`
  - Data : 7 maps sandbox (`sandbox-flat`, `sandbox-slopes`, `sandbox-melee-block`, `sandbox-fall-1..4`) dans `packages/renderer/public/assets/maps/`
  - Renderer : SandboxPanel accordéon 3 panels (Map/Player/Dummy), tous fermés par défaut
  - **810/810 tests unitaires**, 97/98 intégration (1 échec `PlacementPhase > manual placement` pré-existant, sans lien avec ce plan)
  - Typecheck clean, lint clean (warnings nursery pré-existants uniquement)
  - Changements non encore commités (`docs/backlog.md` modifié) — voir `git diff --stat`

- **Plan 047 terminé** — Ligne de vue 3D et collisions terrain :
  - **Core : `heightBlocks`** — fonction pure unifiée `obstacleHeight > referenceHeight + 1` (`packages/core/src/battle/height-modifier.ts`), 5 tests unitaires. `isMeleeBlockedByHeight` préservée (sémantique `abs(diff) >= 2`) pour rétrocompatibilité mêlée.
  - **Core : `MoveFlags`** — interface alignée Showdown (`contact`, `sound`, `bullet`, `wind`, `powder`, `pulse`, `punch`, `bite`, `slicing`, `dance`, + flags mécaniques `protect`, `mirror`, `snatch`, etc.). Stockée sur `MoveDefinition.flags`.
  - **Core : `hasLineOfSight`** — raycast Bresenham 2D filtré par `heightBlocks` (`packages/core/src/grid/line-of-sight.ts`), 8 tests unitaires.
  - **Core : LoS dans les 9 resolvers de `targeting.ts`** :
    - `single distance` → `hasLineOfSight(origin, target, min(hOrigin, hTarget))`
    - `cone` / `cross` → raycast par case depuis l'origine
    - `line` → s'arrête sur le premier obstacle qui bloque, cases suivantes épargnées
    - `zone` → filtre chaque case par `heightBlocks(tileHeight, epicenterHeight)` + raycast
    - `blast` → 2 phases : phase 1 raycast tireur→cible, si intercepté l'explosion se recentre sur le pilier ; phase 2 propagation depuis le nouvel épicentre
    - `slash` → mêlée frontale avec `isMeleeBlockedByHeight`
    - `single mêlée` → règle mêlée
    - `dash` → arrêt si `heightDiff > 0.5`, `wallHeightDiff` remonté
    - `self` → inchangé
  - **Règle dérivée `ignoresLineOfSight`** : `flags.sound === true || (pattern === 'zone' && type === 'ground')`. Séisme et Ampleur ignorent donc naturellement la LoS (type Sol + zone), Hurlement/Rugissement/Ultrason/Chant traversent les murs (flag sonore).
  - **Core : dash contre mur** (`BattleEngine.dashMoveCaster`) — si la trajectoire rencontre un mur infranchissable, arrêt sur la case devant + `BattleEventType.WallImpactDealt` (distinct de `FallDamageDealt`) via `calculateFallDamage`. Vol immunisé. KO possible.
  - **Core : `resolveBlastEpicenter`** exportée pour permettre au renderer de calculer l'épicentre intercepté (preview distincte).
  - **Data : peuplement `moveFlags`** sur ~74 moves du roster (`packages/data/src/base/move-flags.ts`, mapping séparé, appliqué dans `load-data.ts`). Flags de nature physique (contact, sound, bullet, punch, bite, slicing, wind, powder, dance, recharge) renseignés ; flags mécaniques Phase 4 laissés vides.
  - **Renderer : preview AoE filtrée par LoS** — `GameController.handleTileHover` passe `moveContext` à `resolveTargeting`, les cases bloquées par un obstacle n'apparaissent plus. Pour les blasts, l'épicentre intercepté est dessiné en `TILE_PREVIEW_BLAST_INTERCEPT_COLOR` (orange) distinct du rayon rouge.
  - **Data : 5 maps sandbox LoS initiales** dans `packages/renderer/public/assets/maps/` — `sandbox-los-shots.tmj`, `sandbox-los-line.tmj`, `sandbox-los-zone.tmj`, `sandbox-los-blast.tmj`, `sandbox-los-dash.tmj`. Chacune testable via `pnpm dev:map <fichier>` pour playtest manuel. 5 tests d'intégration valident le parsing et les hauteurs attendues. (Consolidées en `sandbox-los.tmj` dans les hotfixes post-playtest.)
  - **Tests d'intégration moves (étape 8b)** — 13 nouveaux cas LoS répartis sur 11 fichiers moves : `psybeam`, `thunderbolt` (x2 cas : seuil +1 + line stoppée), `hyper-beam`, `earthquake`, `magnitude`, `sludge-bomb`, `growl`, `roar`, `supersonic`, `sing`, `quick-attack`. Testent que la LoS fonctionne bout-en-bout via `BattleEngine.submitAction` + `MockBattle.setTile`.
  - **840 tests unit** verts (+ 13 nouveaux moves LoS + 5 maps sandbox + 8 line-of-sight + 5 heightBlocks) — avant hotfixes.
  - **97/98 intégration** (1 échec pré-existant `PlacementPhase > manual placement`, sans lien).
  - **Typecheck clean**, lint clean côté modifications (warnings nursery pré-existants uniquement).
  - **Build propre** — `pnpm build` OK.

- **Plan 047 — hotfixes post-playtest (session 2026-04-11)** :
  - **`heightBlocks` : `max` → `min`** — `ref = min(origin, target)` corrige le cas tireur sur plateau → cible en contrebas à travers le bord du plateau (avec `max`, le bord du plateau ne bloquait pas si le tireur était haut).
  - **`withinHeightReach(|c-t| < 2)`** — règle de portée verticale ajoutée pour les moves bypass-LoS (sound, zone+ground) uniquement. Empêche un Chant de toucher une cible h5 depuis h0 sans ligne de vue.
  - **`BattleEventType.WallImpactDealt`** — distinct de `FallDamageDealt` pour le dash contre mur. Traduction i18n "Impact" séparée de "Chute".
  - **Blast : épicentre = case d'avant le pilier** — l'explosion se recentre sur la dernière case libre avant l'interception, pas sur le pilier lui-même. Tile d'impact affichée en orange dans la preview.
  - **`getLegalActions` utilise `resolveTargeting`** pour filtrer — la preview et l'IA ne proposent plus de cibles non-atteignables derrière les piliers. `isMeleeBlockedByHeight` retiré du check dash dans `getLegalActions`.
  - **Map unique `sandbox-los.tmj`** (10×7, 2 piliers h3 en (3,3) et (5,3)) — remplace les 5 maps séparées.
  - **`LosGuard.ignoresLoS`** (anciennement `enabled` inversé) — sémantique plus claire.
  - **`findBlastInterception`** — nouveau helper qui déduplique le raycast Bresenham du blast (partagé entre core et renderer).
  - **839/839 tests unit**, typecheck clean, lint propre hors pré-existants.

- **Plan 049 terminé** — Migration données jeu vers référence JSON :
  - **`packages/data/src/roster/`** : `roster-poc.ts` — 21 Pokemon avec movepool curation (remplace `base/pokemon.ts`)
  - **`packages/data/src/loaders/`** : 3 loaders séparés — `load-pokemon.ts`, `load-moves.ts`, `load-type-chart.ts`
  - **`load-data.ts`** refactoré : utilise les loaders au lieu d'imports hardcodés
  - Suppression de `base/pokemon.ts`, `base/moves.ts`, `base/move-flags.ts`, `base/type-chart.ts`
  - Balance overrides ajoutés : `seismic-toss`/`night-shade`/`magnitude` (power) et `roar` (accuracy)

- **Plan 048 terminé** — Pokedex Reference Knowledge Base :
  - **`packages/data/reference/`** : base de connaissance JSON offline couvrant toutes les générations (Gen 1 → Gen 9)
  - 5 fichiers JSON bruts : `pokemon.json` (1025 espèces), `moves.json` (850 moves), `abilities.json` (311 abilities), `items.json` (948 items), `type-chart.json`
  - 19 index inversés dans `reference/indexes/` : 9 par moves (type, catégorie, flags, target, status secondaire, stat change, power bracket, priorité, génération), 8 par Pokemon (type, ability, move, génération, flags, top-stat, BST bracket, avec-mega), 1 items, 1 abilities
  - `packages/data/scripts/build-reference.ts` : script de génération one-shot (`pnpm --filter @pokemon-tactic/data run build-reference`)
  - `packages/data/reference/README.md` : schéma, sources, instructions de régénération
  - `.claude/rules/data.md` mis à jour : règle de consulter `reference/` avant d'aller chercher sur Showdown/Bulbapedia/PokeAPI
  - `docs/decisions.md` : décision #241 ajoutée (format, exclusions Gmax/Z/Téra, learnsets latest-only)
  - Référence sert de **source de connaissance pour Claude** (phase 1) — migration code jeu prévue en plan 049

- **Session 2026-04-13 (après-midi) — Plan 050 tileset custom PMD** :
  - **Tileset complet livré** : `packages/renderer/public/assets/tilesets/terrain/tileset.png` (32×2368 px, 74 tiles) + `tileset.tsj` (external tileset Tiled partagé). 11 terrains solides (herbe, tall_grass, roche, brique, sable, pavé, path, wood, snow, ice, magma) + 4 liquides (water, deep_water, lava, swamp). Toutes les textures issues des sheets PMD (Red Rescue Team / Explorers of Sky).
  - **Pipeline Python** dans `scripts/` : `extract-pmd-tile.py` (auto-détection X0/Y0), `make-iso-tile.py` (4 shapes : full/half/ramp-s/stairs-s), `build-terrain.py`, `assemble-tileset.py`. Documentés dans `scripts/README.md`.
  - **24 `.tmj` migrés** : inline tileset JAO → référence externe `tileset.tsj`. Parser `resolveExternalTilesets` déjà supporté depuis plan 045.
  - **Slope flip transform** : `resolveTileProperties` dans `tileset-resolver.ts` transforme la direction selon les bits flipD/H/V Tiled (ordre D→H→V). 3 tests dans `tileset-resolver.test.ts`.
  - **Helper test** : `loadTiledMapSync` dans `packages/data/src/testing/load-tiled-map-sync.ts` — version Node sync pour les tests `parseTiledMap`.
  - **Dead code renderer supprimé** (~100 lignes) : méthodes `drawGrid`, `drawTexturedGrid`, `drawArenaMarkings`, `drawIsoEllipse`, constantes `ARENA_TILE_FRAME_*`, `ARENA_MARKING_*`, `ARENA_GRASS_BORDER_SIZE`, `DEPTH_GRID_MARKINGS`, field `markingsGraphics`. `TILESET_KEY` renommé "icon-tileset" → "terrain".
  - **Scripts one-shot supprimés** : `migrate-tmj-to-custom-tileset.py`, `remap-tmj-mvp-to-15.py`, `externalize-tmj-tileset.py`.
  - **3 nouveaux items backlog** : profondeur sélecteur/highlight vs Pokemon, flanc inversé sur flip pente/escalier, silhouette X-ray pour Pokemon derrière obstacle.
  - **849/849 tests verts**, typecheck clean, build clean.
  - Décisions #242–244 ajoutées (magma=solide, .tsj partagé, auto-détection X0).

- **Session 2026-04-12 (suite) — Bugfix depth animations (hors plan)** :
  - Fix clipping des frames PMDCollab d'attaque et de déplacement sur cartes avec dénivelés (`sandbox-los.tmj`)
  - Nouvelle méthode `PokemonSprite.playAttackAnimation` : bump de depth à `max(originalDepth, maxTileDepthInRadius(r=3))` le temps de l'animation
  - `animateMoveTo` étendu avec le même principe (`r=1`)
  - Helper privé `maxTileDepthInRadius(cx, cy, r)` dans `PokemonSprite.ts`
  - Constantes `ATTACK_DEPTH_ENVELOPE_RADIUS=3` et `MOVEMENT_DEPTH_ENVELOPE_RADIUS=1` dans `constants.ts`
  - Fichiers : `PokemonSprite.ts`, `GameController.ts`, `constants.ts`

- **Bugfix renderer (hors plan, 2026-04-14)** — highlights/curseur passaient devant les sprites Pokemon :
  - Nouveau layering dans `constants.ts` — tiles (1–125) → highlights (500–510) → Pokemon (520+) → curseur (900) → UI (1000+). `DEPTH_POKEMON_BASE` remonté de 1 à 520. Formule depth knockback corrigée avec `DEPTH_POKEMON_BASE`.
  - Fichiers modifiés : `constants.ts`, `IsometricGrid.ts`, `PokemonSprite.ts`, `GameController.ts`

- **Plan 051 terminé** — Types de terrain + modificateurs (toutes étapes) :
  - **Nouveaux `BattleEventType`** : `TerrainDamageDealt`, `TerrainStatusApplied`, `TerrainEvasionApplied`, `IceSlideApplied`, `IceSlideCollision`, `LethalTerrainKo`
  - **`terrain-effects.ts`** : fonctions pures — `isTerrainImmune`, `getMovementPenalty`, `getTerrainTypeBonusFactor` (+15%), `getTerrainStatusOnStop`, `getTerrainDotFraction`
  - **BFS Dijkstra** : malus de coût par terrain (water/sand/snow +1, swamp +2), immunités de type respectées
  - **Bonus type/terrain** : +15% dégâts si type du move correspond au terrain de l'attaquant (Feu sur magma, Eau sur water, etc.)
  - **Brûlure au passage** : Pokemon non-Feu/Vol traversant magma reçoit Burned pendant le déplacement
  - **`terrain-tick-handler`** : handler EndTurn priorité 400 — swamp → Poison, magma → 1/16 HP DOT ; tall_grass → évasion virtuelle dans checkAccuracy (aucun statStage)
  - **`applyImpactDamage`** : helper extrait de BattleEngine, partagé avec `handle-knockback.ts`
  - **Ice slide** : après knockback sur ice, le Pokemon glisse jusqu'à obstacle/mur/Pokemon/bord. Collision mur → WallImpactDealt, collision Pokemon → IceSlideCollision (dégâts aux deux). Immunité : Glace, Vol
  - **`terrainModifier`** propagé via `EffectContext` → `ProcessContext` → `damage-calculator`
  - **KO létal terrain** : atterrir sur lava/deep_water sans immunité = KO immédiat (`LethalTerrainKo`). Renderer : "Fondu!" / "Noyé!"
  - **Règle un seul statut majeur** : handlers terrain respectent `isMajorStatus`
  - **Évasion tall_grass** redesignée : bonus virtuel dans `checkAccuracy` (pas de statStage, pas de cumul)
  - **Maps sandbox** mises à jour par l'humain : `sandbox-flat` avec tous les terrains, `sandbox-fall-1` à `-4` avec ice en bordure de falaise
  - **Renderer tint** : overlay `TERRAIN_TINT_*` semi-transparent par terrain dans `IsometricGrid`
  - **3 nouveaux event handlers renderer** : `TerrainDamageDealt`, `IceSlideApplied`, `LethalTerrainKo`
  - Étape 22 (tooltip terrain InfoPanel) déplacée au backlog

### Prochaine étape (Phase 3 — Terrain & Tactics)
- **Plan 051 terminé** — prochain plan : "Interactions type/terrain + modification terrain par attaques" (Champ Herbeux, Champ Électrifié, etc.)
- **Orientation tactique** (bonus dos/face FFTA) — Phase 3
- **Système CT** (remplacement round-robin) — Phase 3
- **Undo déplacement** — Phase 3
- Les marquages d'arène (pokeball, lignes) deviendront des tiles Tiled, pas des overlay Graphics (futur)
- Télécharger et intégrer `public/assets/fonts/pokemon-emerald-pro.ttf` (WOFF2 corrompu — @font-face TTF fallback actif, correction mineure)
- Validation visuelle plan 050 toujours souhaitable (empilement, pentes/escaliers sur toutes les maps)

### Bugs connus non corrigés

*(rien d'ouvert — depth animations et confusion wobble post-KO résolus, voir backlog.md)*

### Points à adresser (renderer)
- Représentation visuelle des moves défensifs : animation/feedback quand Protect bloque, Counter renvoie, etc.
- Menu d'action : position bas à droite retenue (bas à gauche écarté — chevauchement timeline 12 Pokemon). Position définitive à confirmer lors de la prochaine session.

### Standards de code établis
- Pas d'abréviations, variables nommées comme leur type
- Const object enum pattern (`as const` + type dérivé)
- 1 fichier = 1 interface, séparation enums/types/grid/battle
- Pas de commentaires (sauf algo complexe)
- Mocks : `abstract class` + `static readonly` + données pures (pas de helpers)
- Tests : comportement uniquement, const enums (pas de string literals)
- Coverage 100% sur le core (threshold bloquant)

### Questions ouvertes
- Formules dérivées (Mouvement/Saut/Initiative depuis Vitesse+Poids) — Phase 1
- Movesets POC : Bombe-Beurk trop forte, Salamèche trop faible (feedback game-designer) — Sludge Bomb inflige 112 dégâts sur Pidgey (40 HP), ratio 2.8x à surveiller
- Friendly fire fréquent avec IA random (pas de bug, comportement attendu mais à garder en tête pour l'équilibrage)
- PP system : une IA sans filtre de cible gaspille ses PP — `getLegalActions` peut servir de garde-fou
