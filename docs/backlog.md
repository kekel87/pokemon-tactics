# Backlog — Bugs et Feedback

Centralise les bugs connus et les retours de playtest non encore traités.

## Bugs

### ~~Test d'intégration `PlacementPhase` cassé + CI ne run pas les integration tests~~
- Fix : coordonnées corrigées (3,18) et (4,19) dans les spawn zones. `pnpm test:integration` ajouté à la CI.

### ~~Régénérer le tileset.png avec les brightness uniformes (plan 055)~~
- Fix : 15 colonnes régénérées avec `LEFT_BRIGHTNESS = RIGHT_BRIGHTNESS = 0.65`, tileset assemblé (32x2368px, 74 tiles). Validation visuelle OK en jeu (2026-04-17).

### ~~Transparence tiles/décos dans le visionneur de maps (2026-04-23)~~
- Fix 2026-04-24 (commit `59e8b25`) : suppression du système `TERRAIN_TINT` qui forçait un tint alpha sur les tiles water/ice. Bug global renderer iso résolu.

### Le Mur — gameplay cassé (2026-04-23)
- Map `le-mur.tmj` retirée du menu de sélection (`maps-registry.ts`).
- Bug transparence **résolu** (commit `59e8b25`). Les problèmes restants :
  - Pokemon trop lents sur la neige — terrain `slow` excessif pour une map axée traversée, à revoir.
  - IA perdue sur les chemins verticaux (escaliers), ne comprend pas bien monter/descendre.
- La toundra a été livrée comme alternative. **Le Mur ne peut pas être réintégré sans rotation de caméra** — injouable en vue iso fixe (les escaliers N/S sont aveugles). À reconsidérer quand la rotation sera implémentée (Phase 3.5 Babylon ou plus tard).

### MapSelectPreviewScene — crash `cameras.main` undefined au retour menu (2026-04-23)
- Fix appliqué 2026-04-23 : `setLayout` et `create` gardent le layout en propriété, `setLayout` no-op si caméra pas encore prête.
- Cause : `setLayout` pouvait être appelé depuis `MapSelectScene.create()` avant que `MapSelectPreviewScene.create()` ait tourné (race au 2e passage après SHUTDOWN + relaunch).

### simple-arena non centrée dans le preview (2026-04-23)
- Fix appliqué 2026-04-23 : `applyCameraFit` prend en compte le décalage horizontal `(gridWidth - gridHeight) * TILE_WIDTH / 4` pour les grilles non carrées (simple-arena est 12×20).

## Notes IA (pour plus tard, à regrouper en un plan d'amélioration IA)

### IA — CT-aware scoring (2026-04-25)
- Le scoring CT a été tenté dans le plan 068 mais rejeté : appliquer `CT_REFERENCE_COST / ctCost` dans un scorer greedy monoronde pousse l'IA à choisir des moves moins puissants → combats >5000 tours dans les tests de charge.
- **Nécessite un lookahead multi-tour** pour être bénéfique. À concevoir dans un plan dédié IA multi-tour (prédiction de l'ordre CT, évaluation sur N tours).
- L'IA joue ses tours correctement en mode CT (au minimum) — le problème est le scoring stratégique, pas l'exécution.

### Afficher les modificateurs terrain actifs dans l'InfoPanel
- Quand on retravaille l'InfoPanel, afficher les effets terrain en cours sur la tile du Pokemon sélectionné/survolé (ex: "Évasion +1 (herbe haute)", "Brûlure au passage (magma)", "Malus déplacement +2 (marécage)").
- Lié à l'étape 22 du plan 051 (terrain dans tooltip).

## Feedback visuel

### ~~TurnTimeline CT — layout et barre de charge~~ (plan 055 — commit 9bc9125)
- Corrigé dans le bug gatling (plan 055).

## Tâches futures identifiées (hors backlog actif)

### Ajouter Pokemon Legends Z-A comme source de données
- Showdown a un mod ZA disponible : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen9legends/`
- Fichiers : `pokedex.ts` (nouveaux Mega ZA — Mega Starmie, Mega Mawile, Mega Medicham), `learnsets.ts`, `formats-data.ts`, `scripts.ts`
- Format identique à `mods/champions` (`inherit: true` + overrides) → réutiliser tout le pipeline `fetch-champions.ts` / `applyChampionsOverrides`
- **Question de design** : comment composer ZA et Champions ?
  - Option : layering `Showdown Gen 9 → ZA → Champions` (ZA apporte le contenu, Champions ajuste l'équilibrage)
  - Risque : Champions peut overrider du contenu ZA (nouveau Mega) — vérifier qu'il n'y a pas de conflit
- À planifier dans un plan dédié (057 ou 058 selon ordre choisi), en parallèle ou après le plan 057 (Champions status runtime).

### Portée dynamique selon la hauteur (dénivelé)
- Idée : un attaquant en hauteur voit plus loin et peut tirer plus loin. Bonus de portée +N cases selon la différence de hauteur caster - cible (par ex : +1 case par niveau au-dessus, cap +2).
- Pour l'instant, le plan 046/047 n'ajoute que le modificateur de **dégâts** (`getHeightModifier`, ±10%/niveau, cap +50%/-30%). Aucun bonus de portée.
- À planifier : décider de la formule (flat +N, multiplicatif, avec cap), adapter `getValidTargetPositions` dans BattleEngine pour calculer une portée effective par caster, affecter la preview renderer.

### Système de décorations Tiled
- Créer `decorations.tsj` + `decorations.png` — tileset dédié, pipeline séparée du terrain
- Marquages d'arène : lignes (~12 tiles : segments, coins, T, croisement) + pokeball centrale (~6-8 tiles)
- Décos environnement : herbe haute overlay, arbres, rochers (sources PMD)
- Remplir layer `decorations` de `simple-arena.tmj` + maps futures

### Trajectoire de vol (montées/descentes) pour les Flying Pokemon
- **Animation de repos résolue (2026-04-26)** : les Pokémon de type Vol restent en FlyingGlide au repos (idle, après dégâts, après knockback). `PokemonSprite.setRestingAnimation()` + `playRestingAnimation()` injectés depuis `BattleScene` à la création.
- **Ce qui reste** : la trajectoire de déplacement sur les dénivelés. Actuellement les Pokémon volants font le même tween de saut (`Hop`) que les autres lors des changements de hauteur. Avec FlyingGlide comme anim de déplacement (sprite vol stationnaire), l'arc parabolique n'est plus compensé par les frames. À traiter quand on aura des assets flying dédiés ou quand la trajectoire semblera trop bizarre visuellement.
  - Piste : trajectoire 2-phase (rise-in-place → walk horizontal → drop) ou arc parabolique container Y.
  - Les constantes `JUMP_TWEEN_DURATION_MS` sont déjà séparables par type.


## Résolus

### ~~Traversée DeepWater/Lava bloquée pour les types immuns~~ (hors plan — 2026-04-25)
- Pokemon de type Water et Flying ne pouvaient pas traverser DeepWater. Fire et Flying ne pouvaient pas traverser Lava.
- Fix : `TraversalOptions` accepte un champ `immuneTerrains?: ReadonlySet<TerrainType>`. `canEnterTerrain` et `canStopOn` ignorent l'impassabilité pour ces types. Nouvelle fonction `getImmuneTerrains(types)` dans `terrain-effects.ts`. Les 3 call sites de BattleEngine (`getReachableTiles`, `validateMovePath`, `computePathDistance`) calculent et passent le set.

### ~~Steel non immun au marécage (statut + traversée)~~ (hors plan — 2026-04-25)
- Magneton (Electric/Steel) prenait le statut Poisoned en traversant Swamp et ne pouvait pas traverser le terrain.
- Fix : `PokemonType.Steel` ajouté à `TERRAIN_IMMUNE_TYPES[Swamp]` dans `terrain-effects.ts`.

### ~~IA figée quand les équipes sont séparées par un terrain infranchissable~~ (hors plan — 2026-04-25)
- `closestPathDistance` retournait `Infinity` pour tous les ennemis quand aucun chemin n'existait (ex: équipes de part et d'autre d'un mur de Lava). L'IA ne se déplaçait plus.
- Fix : `closestDistanceToEnemies` dans `action-scorer.ts` utilise Manhattan comme fallback quand `computePathDistance` retourne `Infinity`. L'IA continue de se repositionner même en situation de blocage complet.

### ~~IA — aversion terrains dangereux~~ (plan 068 — 2026-04-25)
- Fix : `action-scorer.ts` applique `DANGEROUS_TERRAIN_PENALTY = 8` sur les destinations Magma/Lava/Swamp. Exception : Pokemon immuns via `isTerrainImmune`. Constante `DANGEROUS_TERRAINS` centralisée.

### ~~IA — pathfinding aveugle (distance manhattan vs distance réelle)~~ (plan 068 — 2026-04-25)
- Fix partiel : `scoreMove` utilise désormais `engine.computePathDistance` (BFS sans budget) au lieu de `manhattanDistance`. Un ennemi derrière un obstacle infranchissable score à `Infinity` — l'IA ne se déplace plus vers des positions sans issue.
- Résidu : la navigation long terme (emprunter les rampes, contourner sur plusieurs tours) reste limitée par le BFS à budget du mouvement — hors scope de ce plan.

### ~~Observation "dégâts à travers le mur" (le-mur.tmj)~~ (plan 068 — 2026-04-25)
- Investigation : les dégâts observés provenaient de moves avec `ignoresLineOfSight` (soniques/telluriques) — comportement correct par design.
- Test de non-régression ajouté (`BattleEngine.los-legal-actions.test.ts`) : confirme que les attaques Single-targeting sont bien bloquées par un pilier h=3, et que les moves sonores contournent la LoS (attendu).

### ~~Transparence / silhouette des Pokemon derrière un obstacle~~ (plan 065)
- Fix : module `OcclusionFader` — fade alpha 0.4 sur l'obstacle qui occulte un Pokemon (AABB screen-space + comparaison depth). Fix depth tiles surélevées (`DEPTH_RAISED_TILE_BASE = DEPTH_POKEMON_BASE`). Alt-click picking pour cibler la tile sous un pilier. Résolu 2026-04-20.

### ~~Immunité au poison non respectée (type Poison empoisonné)~~ (plan 055)
- Fantominus (Poison/Ghost) se faisait empoisonner par Toxic : aucune vérification d'immunité de statut par type dans `handle-status.ts`.
- Fix : helper `isImmuneToStatusByType` avec la table officielle Pokemon (Poison/Steel → Poisoned/BadlyPoisoned, Electric → Paralyzed, Fire → Burned, Ice → Frozen). Check appliquée avant la règle "un seul statut majeur".

### ~~Pokemon KO continuent d'animer idle~~ (plan 055)
- Kangourex et Otaria continuaient leur boucle idle après KO : `playFaintAndStay` stoppait l'anim mais ne posait aucun flag, et plusieurs event handlers (`setDirection`, `flashDamage`, `setStatusAnimation`, callback `playAnimationOnce`) relançaient Idle après coup.
- Fix : flag `isKnockedOut = true` posé dans `playFaintAndStay`, early-return dans les méthodes d'animation. `setConfusionWobble(false)` reste autorisé après KO pour permettre le nettoyage.

### ~~Icône de statut manquante suite à un empoisement par un marais~~ (plan 055)
- Le core émettait `TerrainStatusApplied` (swamp → Poisoned, magma → Burned) mais le renderer n'avait aucun handler → icône jamais mise à jour en live, BattleLog silencieux.
- Fix : nouveau case dans `GameController.handleEvent` qui appelle `sprite.updateStatus(pokemon.statusEffects)`, et nouveau cas i18n FR/EN dans `BattleLogFormatter.ts` ("X est empoisonné par le marécage !", "X was burned by the magma!").

### ~~Overlay preview dégâts sur HP bar~~ (plan 055)
- Root cause : `HP_BAR_HEIGHT = 2` et le code faisait `HP_BAR_HEIGHT - 2 = 0` → fillRect de 0px invisible. Plus les insets `+1` sur barX/offsetY superflus.
- Fix : edge-to-edge alignement avec `hpBarFill` + `damageEstimateGraphics` persistant enfant du container + alphas bumpés à 0.55/0.85.

### ~~Textes flottants superposés (multi-hit, DOT simultanés)~~ (plan 055)
- Plusieurs `showBattleText` simultanés sur le même Pokemon se chevauchaient à la même position Y.
- Fix : queue temporelle par `targetId`. `showBattleText` accepte maintenant `targetId` (auto-queue via `acquireSpawnDelay`) OU `delay` explicite (pour grouper plusieurs texts sur un même "beat" — damage + effectiveness partagent le même délai, le 2e avec `offsetY: BATTLE_TEXT_STAGGER_Y`). Délai entre beats : `BATTLE_TEXT_QUEUE_DELAY_MS = 700` dans `constants.ts`. Spawn différé via `scene.time.delayedCall`. Tests unit sur `acquireSpawnDelay`.

### ~~Profondeur du sélecteur/highlight vs sprites Pokemon~~ (bugfix hors plan 2026-04-14)
- Les highlights (déplacement, attaque, portée ennemie) et le curseur passaient par-dessus les sprites Pokemon.
- Fix : nouveau layering de depths dans `constants.ts` — tiles (1–125) → highlights (500–510) → Pokemon (520+) → curseur (900) → UI (1000+). `DEPTH_POKEMON_BASE` remonté de 200 à 520. Formule knockback `200 + x + y` corrigée avec `DEPTH_POKEMON_BASE`.

### ~~Rendu de profondeur pendant les animations d'attaque~~ (bugfix hors plan 2026-04-12)
- Les frames PMDCollab d'attaque (lunges jusqu'à 2 cases forward, windup 1 case backward) et de déplacement (Walk/Hop qui débordent) étaient clippées par les tiles élevées voisines sur les cartes avec dénivelés (`sandbox-los.tmj`).
- Fix : nouvelle méthode `PokemonSprite.playAttackAnimation` qui bump la depth du container à `max(originalDepth, maxTileDepthInRadius(r=3))` le temps de l'animation. `animateMoveTo` étendue avec le même principe (`r=1`). Helper privé `maxTileDepthInRadius(cx, cy, r)`. Constantes `ATTACK_DEPTH_ENVELOPE_RADIUS=3` et `MOVEMENT_DEPTH_ENVELOPE_RADIUS=1` dans `constants.ts`.
- Fichiers modifiés : `PokemonSprite.ts`, `GameController.ts`, `constants.ts`.

### ~~Mécaniques d'attaque en terrain 3D (champ de vision, collisions)~~ (plan 047)
- LoS raycast Bresenham 2D intégrée dans les 9 resolvers de targeting (`hasLineOfSight`, `heightBlocks`)
- Dash contre mur : arrêt + dégâts de chute équivalents
- Moves sonores et zones telluriques ignorent naturellement la LoS (`ignoresLineOfSight` dérivé des flags)
- Preview AoE filtrée par LoS dans le renderer ; blast intercepté affiché en couleur distincte

### ~~Texte flottant trop rapide et illisible~~ (plan 046 playtest)
- Après le passage à la police PokemonEmeraldPro (plan 044), les `BattleText` (dégâts, Miss, Chute…) étaient trop petits et disparaissaient trop vite pour être lus en combat.
- Constantes dans `packages/renderer/src/constants.ts` retunées :
  - `BATTLE_TEXT_FONT_SIZE` : 7 → 10
  - `BATTLE_TEXT_DURATION_MS` : 2200 → 3500
  - `BATTLE_TEXT_DRIFT_Y` : -15 → -20
  - `BATTLE_TEXT_STAGGER_Y` : -7 → -10
- Ajout de la clé i18n `battle.fall` (FR: "Chute", EN: "Fall") utilisée par le handler `FallDamageDealt` dans `GameController.ts` — plus de hardcoded "Fall -XX".

### ~~Police WOFF2 corrompue~~ (plan 045)
- WOFF2 regénéré proprement, plus d'erreur CFF

### ~~Confusion wobble post-KO~~ (commit a0b0c0a)
- Tween confusion stoppé dans `playFaintAndStay`

### ~~Distinguer alliés et ennemis sur la grille~~ (plan 042)
- HP bars, InfoPanel, Timeline et BattleLog colorisés par couleur d'équipe (12 couleurs, `TEAM_COLORS` dans constants.ts)

### ~~Pas d'écran de victoire en mode IA vs IA~~ (plan 042)
- Fix dans `GameController.ts` — le flow BattleEnded → showVictory fonctionne désormais en mode spectateur IA vs IA

### ~~Border blanc sur les badges de statut (InfoPanel)~~ (plan 042)
- `setStrokeStyle` blanc ajouté sur les rectangles de badges dans `InfoPanel.ts`

### ~~Touche Espace pour passer le tour~~ (plan 042)
- Espace → end turn, touche C → recentrer la caméra (décision #219)

### ~~Dégâts Vampigraine pas reflétés sur la HP bar~~ (plan 024)
### ~~Status burn non affiché au spawn en sandbox~~ (plan 024)
### ~~Événements du tour Dummy non animés~~ (fix 2026-04-02)
