# Backlog — Bugs et Feedback

Bugs connus et retours playtest non traités.

## Bugs

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

### Kangaskhan — genderRatio incorrect (2026-04-29)
- `packages/data/reference/pokemon.json` indique `genderRatio: { male: 50, female: 50 }`.
- Canon Bulbapedia : exclusivement femelle (`{ male: 0, female: 100 }`).
- Pas dans roster actuel, non bloquant. Corriger via `pnpm data:update` quand Kangaskhan sera ajoutée.

## Feedback visuel

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


## Résolus

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
