# Backlog — Bugs et Feedback

Bugs connus et retours playtest non traités.

## Bugs

### Disparité UI HTML vs canvas Phaser (2026-05-19, observation playtest)
- Le projet mélange UI HTML (Team Builder, TeamSelectScene depuis plan 086) et UI Phaser canvas (combat, action menu, info panel, placement roster, timeline).
- Conséquences : double système de fonts/couleurs/spacing (tokens.css vs constants.ts), UX incohérente (curseur, scaling, raccourcis).
- À planifier : décision globale renderer 2D vs HTML overlay (cf plan 062/063 Phase 3.5 Babylon différée). Court terme : aligner styles canvas sur tokens design.

### ~~Test d'intégration `PlacementPhase` cassé + CI ne run pas les integration tests~~
- Fix : coordonnées corrigées (3,18) et (4,19) dans les spawn zones. `pnpm test:integration` ajouté à la CI.

### ~~Régénérer le tileset.png avec les brightness uniformes (plan 055)~~
- Fix : 15 colonnes régénérées avec `LEFT_BRIGHTNESS = RIGHT_BRIGHTNESS = 0.65`, tileset assemblé (32x2368px, 74 tiles). Validation visuelle OK (2026-04-17).

### ~~Transparence tiles/décos dans le visionneur de maps (2026-04-23)~~
- Fix 2026-04-24 (commit `59e8b25`) : suppression système `TERRAIN_TINT`. Bug global renderer iso résolu.

### Le Mur — gameplay cassé (2026-04-23)
- Map `le-mur.tmj` retirée du menu (`maps-registry.ts`).
- Bug transparence **résolu** (commit `59e8b25`). Problèmes restants :
  - Pokemon trop lents sur neige — terrain `slow` excessif pour une map traversée, à revoir.
  - IA perdue sur chemins verticaux (escaliers).
- **Le Mur ne peut pas être réintégré sans rotation caméra** — injouable en vue iso fixe. À reconsidérer avec rotation (Phase 3.5 Babylon ou plus tard).

### ~~Hyper-Fang test flaky en suite complète~~ (2026-05-20)
- Fix : `buildMoveTestEngine` migré en options object `{ gridSize?, random? }` (vs positional `gridSize, random?`). Le test hyper-fang passe `{ random: createPrng(0) }` explicite (accuracy=90 → roll déterministe). Cause racine : helper passait `undefined` comme RNG → `BattleEngine` fallback `Math.random()` non déterministe → 10% miss aléatoire selon ordre des tests. 13 call sites positionnels migrés au passage.

### MapSelectPreviewScene — crash `cameras.main` undefined au retour menu (2026-04-23)
- Fix 2026-04-23 : `setLayout` et `create` gardent layout en propriété, `setLayout` no-op si caméra pas prête.
- Cause : `setLayout` appelé depuis `MapSelectScene.create()` avant que `MapSelectPreviewScene.create()` ait tourné (race au 2e passage après SHUTDOWN + relaunch).

### simple-arena non centrée dans le preview (2026-04-23)
- Fix 2026-04-23 : `applyCameraFit` prend en compte décalage horizontal `(gridWidth - gridHeight) * TILE_WIDTH / 4` pour grilles non carrées (simple-arena 12×20).

## Notes IA (à regrouper en plan d'amélioration IA)

### IA — CT-aware scoring (2026-04-25)
- Scoring CT tenté plan 068, rejeté : `CT_REFERENCE_COST / ctCost` dans scorer greedy monoronde pousse moves moins puissants → combats >5000 tours dans tests de charge.
- **Nécessite lookahead multi-tour** (prédiction ordre CT, évaluation N tours). À planifier plan dédié IA.
- L'IA joue tours correctement en mode CT — problème = scoring stratégique, pas l'exécution.

### Afficher les modificateurs terrain actifs dans l'InfoPanel
- Afficher effets terrain actifs sur tile du Pokemon sélectionné/survolé (ex: "Évasion +1 (herbe haute)", "Brûlure au passage (magma)", "Malus déplacement +2 (marécage)").
- Lié à l'étape 22 du plan 051.

## Données

*(rien)*

## Feedback visuel

### ~~SandboxPanel — sélecteur de talent + élargir panels~~ (2026-05-20)
- Fix 2026-05-20 : ability dropdown ajouté dans hub Player ET hub Dummy (`SandboxPanel.buildAbilityOptions`, rebuild on Pokemon change). Default `(défaut)` = ability primaire de l'espèce ; abilities non implémentées suffixées `(–)`. `SandboxConfig.playerAbility`/`dummyAbility` câblés via `BattleSetupConfig.abilityOverrides`. Largeur container `240px → 320px` (réduit le scroll vertical / le crop des labels). i18n FR/EN `sandbox.ability`/`sandbox.abilityDefault`. Test `SandboxSetup.test.ts` étendu (ability override player+dummy).

### ~~Sandbox refonte — 4 points playtest~~ (plan 090 — 2026-05-21)
- (1) Divergence learnset teambuilder vs sandbox : `SandboxPanel.getMovepoolFor` faisait `legal.has(toShowdownId(move.id))` — `toShowdownId("vine-whip") = "vinewhip"` cherché dans un Set kebab (`vine-whip`) → tous moves multi-mot filtrés. Fix : comparaison directe `legal.has(move.id)`, source unifiée via team builder. Test parity ajouté.
- (2) Mutualisation team builder : 4 cartes Move cliquables → `MovePickerModal` (composant team builder réutilisé). Player + Dummy(Player mode).
- (3) Mode dummy jouable : `SandboxConfig.dummyControl: "ai" | "player"` + `dummyMoves: string[]`. AI mode = `DummyAiController` + 1 move défensif (comportement actuel). Player mode = `PlayerController.Human` + 4 moves picker, `controller.onTurnReady = null`. `GameController` sans notion teamId → tous tours traités comme input humain.
- (4) Layout "Sandbox Studio" : page plein écran avec header + canvas Phaser flex height + 2 colonnes Player/Dummy + bandeau Battle bas. DOM injecté par `sandbox-boot.ts` (`body[data-sandbox="true"]`), Phaser scale `RESIZE` en sandbox. Toolbar dans header, plus de sidebar fixed.
- Drops `dummyLevel` + `dummyBaseStats` (toujours level 50, stats espèce). Migration JSON `default.json` + `charmander-test.json`.

### MoveTooltip — afficher modifiers contextuels (météo, terrain, items) (2026-05-13)
- Ex : Blizzard "Prec 70 (100 en Neige)", Flamethrower "BP 90 (×1.5 en Soleil)", Thunder "Prec 70 (100 en Pluie, 50 en Soleil)".
- Étendre MoveTooltip pour calculer effective BP/accuracy selon `state.weather` et types caster/cible.
- Inclure aussi : effet Heat-Rock (durée étendue), Sun-instant Solar-Beam, etc.
- Priorité moyenne — qualité de vie UX, pas bloquant.

### Icône sandstorm — symbole tourbillon perfectible (2026-05-13)
- Régen PixelLab (plan 084) — 3 itérations, dernière acceptée provisoirement.
- Symbole vent (double spirale) moins reconnaissable que les 3 autres pictogrammes (sun/rain/snow).
- À retenter ultérieurement avec prompt plus explicite ou retouche manuelle.

### ~~TurnTimeline CT — layout et barre de charge~~ (plan 055 — commit 9bc9125)
- Corrigé dans le bug gatling (plan 055).

## Tâches futures (hors backlog actif)

### Ajouter Pokemon Legends Z-A comme source de données
- Showdown mod ZA : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen9legends/`
- Fichiers : `pokedex.ts` (Mega ZA — Mega Starmie, Mega Mawile, Mega Medicham), `learnsets.ts`, `formats-data.ts`, `scripts.ts`
- Format identique à `mods/champions` (`inherit: true` + overrides) → réutiliser pipeline `fetch-champions.ts` / `applyChampionsOverrides`
- **Question de design** : composer ZA et Champions ?
  - Option : layering `Showdown Gen 9 → ZA → Champions` (ZA apporte contenu, Champions ajuste équilibrage)
  - Risque : Champions peut overrider contenu ZA (nouveau Mega) — vérifier conflits
- Planifier plan dédié (057 ou 058 selon ordre), en parallèle ou après plan 057.

### Portée dynamique selon hauteur (dénivelé)
- Attaquant en hauteur voit/tire plus loin. Bonus portée +N cases selon différence hauteur caster-cible (ex: +1 case par niveau au-dessus, cap +2).
- Plans 046/047 : uniquement modificateur **dégâts** (`getHeightModifier`, ±10%/niveau, cap +50%/-30%). Aucun bonus portée.
- À planifier : formule (flat +N, multiplicatif, cap), adapter `getValidTargetPositions` pour portée effective par caster, affecter preview renderer.

### Système de décorations Tiled
- Créer `decorations.tsj` + `decorations.png` — tileset dédié, pipeline séparée du terrain
- Marquages d'arène : lignes (~12 tiles : segments, coins, T, croisement) + pokeball centrale (~6-8 tiles)
- Décos environnement : herbe haute overlay, arbres, rochers (sources PMD)
- Remplir layer `decorations` de `simple-arena.tmj` + maps futures

### Trajectoire de vol (montées/descentes) pour les Flying Pokemon
- **Anim repos résolue (2026-04-26)** : Flying Pokemon restent en FlyingGlide au repos (idle, après dégâts, knockback). `PokemonSprite.setRestingAnimation()` + `playRestingAnimation()` injectés depuis `BattleScene` à la création.
- **Restant** : trajectoire déplacement sur dénivelés. Actuellement tween saut (`Hop`) comme autres. Avec FlyingGlide, arc parabolique plus compensé par frames. À traiter avec assets flying dédiés ou quand trajectoire semblera bizarre.
  - Piste : trajectoire 2-phase (rise-in-place → walk horizontal → drop) ou arc parabolique container Y.
  - Constantes `JUMP_TWEEN_DURATION_MS` déjà séparables par type.


### ~~phantom-force / baton-pass invisibles dans le team builder~~ (hors plan — 2026-05-21)
- `phantom-force` et `baton-pass` n'apparaissaient pas dans le MovePickerModal du team builder malgré des learnsets valides.
- Cause : `learnset-resolver.ts` comparait les IDs sans traduire le format Showdown (sans tirets : `phantomforce`) vers kebab (`phantom-force`). `buildShowdownToKebabIndex` existait dans `load-data` mais non utilisé dans le resolver.
- Fix : `learnset-resolver` utilise `showdownToKebab` pour normaliser les IDs Showdown avant intersection avec les moves implémentés.

### ~~Terrain target lava — mouvement autorisé vers tile lava invalide~~ (hors plan — 2026-05-21)
- `getValidTargetPositions` ne filtrait pas les tiles terrain dangereux (lava/deep_water) comme cibles de mouvement pour les Pokemon non-immuns.
- Fix : filtre ajouté dans `getValidTargetPositions`.

### ~~Freeze post-self-KO (terrain létal)~~ (hors plan — 2026-05-21)
- KO par terrain létal (lava/deep_water) laissait le jeu dans un état figé si le Pokemon attaquant se KO lui-même via terrain au landing.
- Cause : `handleKo` appelé avant `LethalTerrainKo` event, HP bar non mise à jour.
- Fix : ordre d'appel corrigé (`handleKo` après `LethalTerrainKo`), HP bar forcée à 0 avant KO handler.

### ~~Ombre Volant au sol / hauteur sprite vol incorrecte~~ (hors plan — 2026-05-21)
- Sprite Flying identique aux autres au sol. Pas d'ombre distincte.
- Fix : sprite Flying décalé `h+2` (2 tiles hauteur visuelle), ombre restée au sol via shadow Y offset séparé. Burrowing/Diving/Vanished : sprite rendu invisible.

## Résolus

### ~~Reference learnsets vides (10 Pokemon Gen 1) + Kangaskhan genderRatio~~ (hors plan — 2026-05-20)
- 10 Pokemon Gen 1 (Pidgey/Pidgeotto/Rattata/Raticate/Spearow/Fearow/Paras/Parasect/Weedle/Kakuna) avaient `learnset.levelUp/tm/tutor = []`.
- Kangaskhan `genderRatio: { male: 50, female: 50 }` au lieu de `{ male: 0, female: 100 }` (canon : exclusivement femelle).
- Cause racine 1 (learnsets) : `parseLearnset` dans `build-reference.ts` calculait `maxGen` global sur **toutes** les entrées du Pokemon (incluant `8V` Virtual Console). Quand l'unique présence Gen 8+ d'un Pokemon était via VC, `maxGen=8` mais V/E/S/R sont skippés → tous les vrais moves L/M/T des gens antérieures filtrés.
- Cause racine 2 (gender) : `transformPokemon` gérait `gender === "N"` (genderless) mais pas `gender === "F"` / `"M"`. Tombait sur le default 50/50.
- Fix : `maxGen` restreint aux entrées `L`/`M`/`T` uniquement (set `LEARNABLE_TYPES`). Ajout des branches `gender === "F"` → `{0,100}` et `gender === "M"` → `{100,0}`.
- Régénération via `pnpm data:update:skip-fetch`. Pidgey 14L+23M+6T, Rattata 13L+29M+10T, etc. Kangaskhan 0/100 correctement détectée. Gate CI verte (1514 unit + 189 intégration + typecheck + lint + build).
- Note : Kangaskhan learnset Champions = 67 TM uniquement (pas de levelUp/tutor en Gen 9 mod), comportement attendu.

### ~~Curseur jaune passe au-dessus des Pokemon (tile surélevée)~~ (hors plan — 2026-05-20)
- Sur tile surélevée, base du curseur dépassait Pokemon sur même tile (`+0.8` > Pokemon `+0.5`).
- Fix : `DEPTH_CURSOR_OVER_DECORATION_OFFSET` (0.8) renommé `DEPTH_CURSOR_RAISED_TILE_OFFSET` et abaissé à `0.4`. Cursor passe désormais sous Pokemon même tile (`0.5`), reste au-dessus obstacle (`0.3`), passe sous tall grass (`0.6`).
- Refonte FFTA-style (curseur au-dessus des Pokemon avec design dédié) reportée à un plan renderer dédié (cf. memory `project_cursor_ffta`).

### ~~Caméra hors-écran 12v1~~ (hors plan — 2026-05-20)
- Format 12v1 : Pokemon spawné en bord de carte, caméra ne le centrait pas → hors écran au début et entre les tours.
- Cause racine : `Phaser.Cameras.Scene2D.Effects.Pan` ignore silencieusement tout appel si `isRunning=true` (pan manuel ou chaîne de tours rapide encore actif). Les appels `pan()` successifs rataient sans erreur.
- Fix : `BattleScene.recenterOnActivePokemon` étendu avec param `instant` (center direct, bypasse Pan). Appelé en fin de `transitionToBattle` et `initSandboxBattle`. `GameController.pan()` passe `force=true` dans les handlers `refreshUI` et `battleLogPanel` click.

### ~~MapSelect — première map noire au retour~~ (hors plan — 2026-05-20)
- Retour sur MapSelectScene (après victoire ou bouton Retour) laissait la première map avec une preview noire.
- Cause : état de l'instance Phaser persistant entre passages — `currentUrl`/`isometricGrid`/`decorationsLayer` non réinitialisés dans `MapSelectPreviewScene.create()`, et `selectedIndex`/`listItems`/refs non réinitialisés dans `MapSelectScene.init()`.
- Fix : reset complet de ces propriétés dans `MapSelectPreviewScene.create()` et `MapSelectScene.init()`.

### ~~Icône statut non retirée après natural-cure~~ (hors plan — 2026-05-06)
- natural-cure retirait bien le statut (core OK) mais l'icône restait affichée — `StatusRemoved` non émis.
- Fix : `naturalCure.onEndTurn` dans `ability-definitions.ts` émet `BattleEventType.StatusRemoved` (un par statut retiré) avant `AbilityActivated`. Test d'intégration mis à jour pour vérifier l'événement.

### ~~Noms Pokemon slug-only en sandbox et team builder~~ (hors plan — 2026-05-06)
- Tous les Pokemon Batch B (19) ajoutés à `pokemon-names.en.json` + `pokemon-names.fr.json`.
- Tous les Pokemon Batch A + B (35 total) ajoutés aux locales renderer `en.ts` + `fr.ts` sous clés `pokemon.*`. Type `Translations` mis à jour.

### ~~Moves sandbox : selects non pré-remplis (init et changement Pokemon)~~ (hors plan — 2026-05-06)
- Deux bugs distincts avec la même racine (selects initialisés à `""`).
- Bug 1 (init) : `config.moves[i] ?? movepool[i] ?? ""` à la création des selects dans `SandboxPanel.buildPlayerPanel`. Fallback `readConfig()` limité à `.slice(0, 4)`.
- Bug 2 (changement Pokemon) : `select.value` lu avant vidage des options → valeur perdue. Fix : lecture avant reconstruction + fallback `movepool[i]` dans `rebuildMoveOptions` après reconstruction.
- Symptômes couverts : +4 moves affichés, moves Eevee evos non visibles, selects vides au changement de Pokemon.

### ~~Ordre Pokédex non respecté en team builder et sandbox~~ (hors plan — 2026-05-06)
- Fix : `dexNumber?: number` ajouté à `PokemonDefinition` (core), chargé depuis `ref.dexNumber` dans `loadPokemonFromReference`. `SandboxPanel` et `TeamSelectScene` trient par `dexNumber ?? 0`.

### ~~Team builder 5 colonnes — overflow bouton Launch sur 34 Pokemon~~ (hors plan — 2026-05-06)
- `GRID_COLS = 5` dans `TeamSelectScene` causait 7 lignes sur 34 Pokemon, le bouton Launch passait hors écran.
- Fix : `GRID_COLS = 7` → 5 lignes, bouton Launch visible sans scroll.

### ~~Traversée DeepWater/Lava bloquée pour les types immuns~~ (hors plan — 2026-04-25)
- Pokemon Water/Flying ne pouvaient pas traverser DeepWater. Fire/Flying ne pouvaient pas traverser Lava.
- Fix : `TraversalOptions` accepte `immuneTerrains?: ReadonlySet<TerrainType>`. `canEnterTerrain` et `canStopOn` ignorent impassabilité pour ces types. Nouvelle `getImmuneTerrains(types)` dans `terrain-effects.ts`. 3 call sites BattleEngine (`getReachableTiles`, `validateMovePath`, `computePathDistance`) calculent et passent le set.

### ~~Steel non immun au marécage (statut + traversée)~~ (hors plan — 2026-04-25)
- Magneton (Electric/Steel) prenait Poisoned en traversant Swamp.
- Fix : `PokemonType.Steel` ajouté à `TERRAIN_IMMUNE_TYPES[Swamp]` dans `terrain-effects.ts`.

### ~~IA figée quand équipes séparées par terrain infranchissable~~ (hors plan — 2026-04-25)
- `closestPathDistance` retournait `Infinity` pour tous les ennemis sans chemin. L'IA ne se déplaçait plus.
- Fix : `closestDistanceToEnemies` dans `action-scorer.ts` utilise Manhattan comme fallback quand `computePathDistance` retourne `Infinity`.

### ~~IA — aversion terrains dangereux~~ (plan 068 — 2026-04-25)
- Fix : `action-scorer.ts` applique `DANGEROUS_TERRAIN_PENALTY = 8` sur destinations Magma/Lava/Swamp. Exception : Pokemon immuns via `isTerrainImmune`. Constante `DANGEROUS_TERRAINS` centralisée.

### ~~IA — pathfinding aveugle (distance manhattan vs distance réelle)~~ (plan 068 — 2026-04-25)
- Fix partiel : `scoreMove` utilise `engine.computePathDistance` (BFS sans budget) au lieu de `manhattanDistance`. Ennemi derrière obstacle score à `Infinity`.
- Résidu : navigation long terme (rampes, contournement multi-tours) reste limitée par BFS à budget — hors scope.

### ~~Observation "dégâts à travers le mur" (le-mur.tmj)~~ (plan 068 — 2026-04-25)
- Investigation : dégâts provenaient de moves `ignoresLineOfSight` (soniques/telluriques) — comportement correct.
- Test non-régression ajouté (`BattleEngine.los-legal-actions.test.ts`).

### ~~Transparence / silhouette des Pokemon derrière obstacle~~ (plan 065)
- Fix : `OcclusionFader` — fade alpha 0.4 sur obstacle occultant un Pokemon (AABB screen-space + comparaison depth). Fix depth tiles surélevées (`DEPTH_RAISED_TILE_BASE = DEPTH_POKEMON_BASE`). Alt-click picking. Résolu 2026-04-20.

### ~~Immunité au poison non respectée (type Poison empoisonné)~~ (plan 055)
- Fantominus (Poison/Ghost) se faisait empoisonner par Toxic.
- Fix : helper `isImmuneToStatusByType` (Poison/Steel → Poisoned/BadlyPoisoned, Electric → Paralyzed, Fire → Burned, Ice → Frozen). Check avant règle "un seul statut majeur".

### ~~Pokemon KO continuent d'animer idle~~ (plan 055)
- Fix : flag `isKnockedOut = true` dans `playFaintAndStay`, early-return dans méthodes d'animation. `setConfusionWobble(false)` reste autorisé après KO pour nettoyage.

### ~~Icône de statut manquante suite à empoisonnement par marais~~ (plan 055)
- Core émettait `TerrainStatusApplied` mais renderer sans handler → icône jamais mise à jour.
- Fix : nouveau case dans `GameController.handleEvent` + nouveau cas i18n FR/EN dans `BattleLogFormatter.ts`.

### ~~Overlay preview dégâts sur HP bar~~ (plan 055)
- Root cause : `HP_BAR_HEIGHT = 2` → `HP_BAR_HEIGHT - 2 = 0` → fillRect 0px invisible.
- Fix : edge-to-edge alignement + `damageEstimateGraphics` persistant enfant du container + alphas 0.55/0.85.

### ~~Textes flottants superposés (multi-hit, DOT simultanés)~~ (plan 055)
- Fix : queue temporelle par `targetId`. `showBattleText` accepte `targetId` (auto-queue via `acquireSpawnDelay`) OU `delay` explicite. Délai entre beats : `BATTLE_TEXT_QUEUE_DELAY_MS = 700`. Spawn différé via `scene.time.delayedCall`. Tests unit sur `acquireSpawnDelay`.

### ~~Profondeur du sélecteur/highlight vs sprites Pokemon~~ (bugfix hors plan 2026-04-14)
- Fix : layering depths dans `constants.ts` — tiles (1–125) → highlights (500–510) → Pokemon (520+) → curseur (900) → UI (1000+). `DEPTH_POKEMON_BASE` 200 → 520.

### ~~Rendu de profondeur pendant animations d'attaque~~ (bugfix hors plan 2026-04-12)
- Fix : `PokemonSprite.playAttackAnimation` bump depth container à `max(originalDepth, maxTileDepthInRadius(r=3))`. `animateMoveTo` même principe (`r=1`). Constantes `ATTACK_DEPTH_ENVELOPE_RADIUS=3` et `MOVEMENT_DEPTH_ENVELOPE_RADIUS=1` dans `constants.ts`.
- Fichiers : `PokemonSprite.ts`, `GameController.ts`, `constants.ts`.

### ~~Mécaniques d'attaque en terrain 3D (champ de vision, collisions)~~ (plan 047)
- LoS raycast Bresenham 2D dans 9 resolvers de targeting (`hasLineOfSight`, `heightBlocks`)
- Dash contre mur : arrêt + dégâts de chute
- Moves sonores/zones telluriques ignorent LoS (`ignoresLineOfSight` dérivé des flags)
- Preview AoE filtrée par LoS dans renderer

### ~~Texte flottant trop rapide et illisible~~ (plan 046 playtest)
- Fix : constantes dans `packages/renderer/src/constants.ts` retunées :
  - `BATTLE_TEXT_FONT_SIZE` : 7 → 10
  - `BATTLE_TEXT_DURATION_MS` : 2200 → 3500
  - `BATTLE_TEXT_DRIFT_Y` : -15 → -20
  - `BATTLE_TEXT_STAGGER_Y` : -7 → -10
- Ajout clé i18n `battle.fall` (FR: "Chute", EN: "Fall") dans `GameController.ts`.

### ~~Police WOFF2 corrompue~~ (plan 045)
- WOFF2 regénéré proprement, plus d'erreur CFF

### ~~Confusion wobble post-KO~~ (commit a0b0c0a)
- Tween confusion stoppé dans `playFaintAndStay`

### ~~Distinguer alliés et ennemis sur la grille~~ (plan 042)
- HP bars, InfoPanel, Timeline et BattleLog colorisés par couleur d'équipe (12 couleurs, `TEAM_COLORS` dans constants.ts)

### ~~Pas d'écran de victoire en mode IA vs IA~~ (plan 042)
- Fix dans `GameController.ts` — flow BattleEnded → showVictory fonctionne en mode spectateur

### ~~Border blanc sur les badges de statut (InfoPanel)~~ (plan 042)
- `setStrokeStyle` blanc ajouté sur rectangles badges dans `InfoPanel.ts`

### ~~Touche Espace pour passer le tour~~ (plan 042)
- Espace → end turn, touche C → recentrer caméra (décision #219)

### ~~Dégâts Vampigraine pas reflétés sur la HP bar~~ (plan 024)
### ~~Status burn non affiché au spawn en sandbox~~ (plan 024)
### ~~Événements du tour Dummy non animés~~ (fix 2026-04-02)
