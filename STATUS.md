# État du projet — Pokemon Tactics

> MAJ : 2026-05-06 (Phase 4 — Roster Batch B plan 076 + 5 bugfixes hors plan)
> Point d'entrée pour reprendre projet après pause.
> Dire "on en était où ?" → Claude Code lit ce fichier.

---

## Décision majeure — Pivot 2D-HD (Babylon.js, Phase 3.5) — **repoussé après Phase 7**

Renderer Phaser 4 iso 2D remplacé par Babylon.js 2D-HD (sprites billboards sur géométrie 3D extrudée, style Tactics Ogre PSP / Triangle Strategy). Spikes 062 (Three.js) et 063 (Babylon.js) finis — **Babylon.js retenu** (décision #269).

**MAJ 2026-04-20 (décision #272)** : plan 065 résolu occlusion iso 2D (fade per-sprite via `OcclusionFader`), Phase 3.5 rewrite Babylon repoussée **après Phase 7 Multijoueur**. Priorité Phase 4 gameplay → Phase 5 équilibrage → Phase 6 social → Phase 7 multi. Si visuel insuffisant à l'usage, Phase 3.5 redevient prioritaire.

**Intact** : core, data, IA, LoS 3D, CT, statuts, Tiled comme format carte. Seul rendu (`packages/renderer/`) réécrit le moment venu.

**Plan 061 silhouette** : archivé sur branche `plan-061-occlusion-before-3d-pivot` (commit `2426edf`). Obsolète — occlusion gérée par `OcclusionFader` iso 2D.

---

## Phase actuelle : Phase 4 — Gameplay Pokemon complet

### Fait en Phase 4
- **Roster Batch B (2026-05-06) — plan 076** : 19 Pokemon Gen 1 finaux ajoutés (nidoqueen, nidoking, primeape, arcanine, poliwrath, golem, slowbro, gengar, hypno, exeggutor, marowak, hitmonlee, hitmonchan, rhydon, starmie, scyther, pinsir, kabutops, aerodactyl). Roster 15 → **34 Pokemon jouables**. 10 nouveaux moves (cross-chop, rock-slide, confuse-ray, energy-ball, bonemerang, blaze-kick, thunder-punch, ice-punch, fire-punch, double-edge) — total 112. 8 nouvelles abilities (vital-spirit, insomnia, cursed-body, rock-head, limber, iron-fist, natural-cure, battle-armor) — total 36. 3 nouveaux hooks AbilityHandler : `blocksRecoil` (handle-recoil.ts), `preventsCrit` (damage-calculator.ts), `onEndTurn` (BattleEngine). Scyther + Aerodactyl : FlyingIdle → Walk fallback (décision #304). Exeggutor sans ability (chlorophyll Phase 9, décision #301). CI : 1188 unit + 166 intégration verts.
- **Bugfixes hors plan (2026-05-06)** : 5 bugs résolus — (1) natural-cure émet désormais `StatusRemoved` avant `AbilityActivated` → icône statut retirée au renderer ; (2) noms Pokemon Batch B (+19) injectés dans `pokemon-names.*.json` et locales renderer, type `Translations` mis à jour — slug disparu en sandbox/team builder ; (3) selects moves sandbox : double fix init (`movepool[i]` par défaut, slice à 4) + changement Pokemon (`select.value` lu avant vidage options, fallback `movepool[i]` dans `rebuildMoveOptions`) ; (4) `dexNumber` ajouté à `PokemonDefinition` + chargé dans `loadPokemonFromReference`, tri par dex dans `SandboxPanel` et `TeamSelectScene` ; (5) `GRID_COLS = 7` dans `TeamSelectScene` — 5 lignes au lieu de 7 sur 34 Pokemon, bouton Launch visible.
- **Fixes post-plan 075 + playtest (2026-05-05 — hors plan)** : Sprites 12 Pokemon Batch A téléchargés via PMDCollab (`pnpm extract-sprites`). Tests intégration corrigés (pokemonTypesMap, compteurs roster). `BattleSetup.ts` limite `moveIds` aux 4 premiers moves du `movepool` (movepool reste réservoir complet pour futur Team Builder). `regenerate-golden-replay.ts` aligné. Sandbox : 4 premiers moves par défaut quand aucun configuré. i18n : anciens non-finaux retirés (bulbasaur, charmander, squirtle, pidgey, pikachu, machop, abra, gastly, geodude, growlithe, jigglypuff, seel, eevee, tentacool, nidoran-m, meowth, magnemite, sandshrew), 12 Pokemon Batch A ajoutés dans `types.ts`, `en.ts`, `fr.ts`. Biome format sprites JSON. Décision #300. CI : 1168 unit + 157 intégration verts.
- **Roster Batch A (2026-05-04) — plan 075** : 18 formes non-finales retirées du roster (bulbasaur, charmander, squirtle, pidgey, pikachu, sandshrew, nidoran-m, jigglypuff, tentacool, geodude, magnemite, abra, machop, seel, gastly, growlithe, meowth, eevee). 12 Pokemon finaux Gen 1 ajoutés : venusaur, charizard, blastoise, raichu, alakazam, machamp, gyarados, snorlax, dragonite, vaporeon, flareon, jolteon. Roster 21 → 15 Pokemon (formes non-finales restent dans reference/, non exposées dans rosterPoc jusqu'au Team Builder). 29 nouveaux moves (102 total) : petal-blizzard, synthesis, growth, fire-blast, flare-blitz, lava-plume, dragon-claw, dragon-dance, air-slash, surf, hydro-pump, waterfall, aqua-tail, ice-beam, thunder, iron-tail, charge-beam, psychic, recover, rest, amnesia, dynamic-punch, close-combat, brick-break, shadow-ball, crunch, outrage, extreme-speed, acid-armor. 8 nouvelles abilities (28 total) : lightning-rod, magic-guard, no-guard, moxie, multiscale, water-absorb, flash-fire, volt-absorb. Mécaniques core ajoutées : `chance?` sur StatChange effect + `loadAllPokemonTypes()` dans data. Décision : lightning-rod sans redirect Batch A — redirect plan dédié.
- **Objets tenus / Held Items (2026-04-30) — plan 073** : `HeldItemId` enum (12 items). `HeldItemHandler` interface avec 8 hooks : `onDamageModify`, `onCritStageBoost`, `onAfterMoveDamageDealt`, `onAfterDamageReceived`, `onEndTurn`, `onTerrainTick`, `onCtGainModify`, `onMoveLock` (nouveau — verrou Choice piloté par hook, plus de check hardcodé ChoiceBand/ChoiceScarf). `HeldItemHandlerRegistry` (miroir `AbilityHandlerRegistry`). `PokemonInstance.heldItemId?` + `lockedMoveId?`. Mini-système critiques intégré à `damage-calculator.ts` (×1.5 + ignore stages défensifs négatifs, Gen 6+ simplifié). `BattleEngine` câblé : heal fin de tour, verrou Choice via `onMoveLock`, modificateur CT gain, blocage terrain. Validateur d'équipe : erreur `DuplicateItem` + champ `heldItems` sur `TeamSelection`. `BattleEventType` : `HeldItemActivated`, `HeldItemConsumed`, `HpRestored`, `CriticalHit`. Renderer : `GameController` fix `HpRestored` → mise à jour HP bar + `BattleLogFormatter` gèrent les 4 nouveaux types. i18n : clés `battle.critical` + `battle.itemConsumed` FR/EN. 12 tests intégration (`held-items.integration.test.ts`, 1 par item). Décisions #288-295.
- **Natures / Stat Alignment (2026-04-29) — plan 072** : mécanique core uniquement, affichage UI reporté. `Nature` enum (25 valeurs), `NatureEffect` type, table `NATURE_TABLE` Bulbapedia Gen 3+ (5 neutres + 20 non-neutres). `applyNatureModifier(stats, nature)` floor(stat × 1.1 / 0.9), HP exclu. `computeCombatStats(baseStats, level, nature?)` étendu (paramètre optionnel pour rétrocompat tests). `rollNature(rng)` uniforme sur 25. `PokemonInstance.nature` non-optionnel. `BattleSetupConfig.genderRng` renommé `creationRng` + ajout `natureOverrides?`. **Affichage InfoPanel reporté à la refonte UI** (étapes 4 + 5 du plan). Pas d'i18n nature, pas de constante couleur nature. 13 nouveaux tests unitaires (`nature-modifier.test.ts` + `roll-nature.test.ts` + extension `stat-calculator.test.ts`). Décisions #284-287. CI verte : 1154 unit + 137 intégration + typecheck + lint clean.
- **Genres Pokemon (2026-04-29) — plan 071** : `PokemonGender` enum (Male/Female/Genderless), `GenderRatio` type, helper `rollGender(ratio, rng)`. `PokemonInstance.gender` rolled à la création (`createPokemonInstance` accepte `rng` + `genderOverride` pour future Team Builder). Loaders `load-pokemon` et `reference-types` exposent `genderRatio` depuis `reference/pokemon.json`. Cute Charm vérifie genre opposé non-genderless (rule Showdown — fix bug latent plan 069). Symboles ♂/♀ Unicode colorés (`#5fa8ff` / `#ff7fb4`) à droite du nameText `InfoPanel`. Genderless → aucun symbole. 5 tests unitaires `roll-gender.test.ts` + 3 nouveaux scénarios intégration Cute Charm (mirror female, vs genderless, male carrier). Décisions #280-283. Bug data Kangaskhan (50/50 vs 0/100 canon) tracé en backlog. CI verte : 1135 unit + 137 intégration + typecheck + lint 0 error.
- **Polish talents/abilities (2026-04-29) — plan 070** : finitions système abilities plan 069. Lévitation traverse lava/deep_water sans malus. Tempo Perso bloque Confusion + Intimidation. Engrais/Brasier/Torrent émettent au seuil 1/3 HP (première traversée + battle start si déjà sous seuil). Cran (Guts) émet quand statut majeur reçu. Matinal (Early Bird) émet au réveil avec `shortenedByAbilityId` sur `StatusEffect`. Refactor hooks passifs (`onStatusBlocked` / `onStatChangeBlocked` / `onTypeImmunity` / `onStatusDurationModify`) → return type `{ blocked|duration, events: BattleEvent[] }` (pattern Showdown). Buffer startup events `BattleEngine` + `consumeStartupEvents()` + `rerunBattleStartChecks()` (sandbox). Helper `isEffectivelyFlying` extrait `packages/core/src/battle/effective-flying.ts`. Battle log + i18n FR/EN pour `AbilityActivated`. 6 nouveaux tests intégration. Doc `docs/abilities-system.md`. Suppression API `onAccuracyModify` (sand-veil dormant Phase 9). CI verte : 1130 unit + 134 intégration + typecheck + lint clean.
- **Système talents/abilities (2026-04-27) — plan 069** : `AbilityHandlerRegistry`, interface `AbilityDefinition` avec 9 hooks. 20 abilities pour 20 Pokemon roster. Statuts volatils `Intimidated` et `Infatuated` (position-linked). Helper `isEffectivelyFlying`. Event `AbilityActivated`. 20 tests intégration verts. Floating text jaune doré `"{abilityName}!"` renderer.
- **Animations vol (2026-04-26)** : refonte animations repos pour Pokémon Vol. `PokemonSprite` : `restingAnim` + `setRestingAnimation()` + `playRestingAnimation()` — volants restent FlyingGlide au repos, après dégâts et knockback. `getFlyingAnimationMode` simplifié (`"glide" | null`). `BattleScene` injecte `setRestingAnimation` à création sprite selon type. CI verte : 1130 unit + 107 integration.

### Fait avant (Phase 3 et antérieur)
- Doc complète : game-design, architecture, decisions (264 décisions), roadmap, references, methodology, roster POC, glossaire
- 21 agents + 7 skills Claude Code (`.claude/`)
- **Plan 001** : monorepo setup (pnpm workspaces, TypeScript bundler, Vite, Vitest, Biome)
- **Plan 002** :
  - 11 const object enums (TargetingKind, Direction, EffectTarget...)
  - 16 interfaces/types (1 fichier = 1 type)
  - Classe Grid avec helpers spatiaux
  - 7 targeting resolvers (single, self, cone, cross, line, dash, zone)
  - Traversée alliés/Vol/Spectre
  - Mocks centralisés (MockPokemon avec 4 Pokemon roster)
- **Plan 003** :
  - `TurnManager` : initiative, ordre tours, cycle rounds, gestion KO
  - `BattleEngine` : `getLegalActions` (BFS pathfinding), `submitAction` (move + skip_turn), event system, `getGameState`
  - `packages/data` : 4 Pokemon, 16 moves complets, type chart 18x18, overrides tactical/balance, deepMerge, loadData()
  - `validate.ts` : validation données au startup
  - `ActionError` enum, `Accuracy`/`Evasion` dans `StatName`, `MockBattle`
  - 117 tests, 100% coverage
- **Plan 004** :
  - `stat-modifier.ts` : multiplicateurs stages, `getEffectiveStat`, `clampStages`
  - `damage-calculator.ts` : formule Gen 5+, STAB (1.5x), type effectiveness, burn penalty
  - `accuracy-check.ts` : accuracy/evasion stages, random check
  - `effect-processor.ts` : 4 processors — processDamage, processStatus, processStatChange, processLink
  - `BattleEngine.executeUseMove` : pipeline complet resolveTargeting → accuracy → processEffects → events
  - 172 tests, 100% coverage
- **Plan 005** : `EffectHandlerRegistry`, pipeline phases tour StartTurn → Action → EndTurn, initiative dynamique
- **Plan 006** :
  - `statusTickHandler` : burn 1/16, poison 1/8, sleep 1-3t, freeze 20%/t, paralysie 25% proc
  - `linkDrainHandler` : drain Vampigraine EndTurn, rupture KO/distance
  - `handleKo` : retrait turn order, libération tile, rupture liens, idempotent
  - `checkVictory` : dernière équipe debout gagne, `BattleEnded`, combat verrouillé
  - 225 tests, 6 tests intégration
- **Tests headless IA** : IA Random (58 rounds), IA Smart (67 rounds) — core validé bout en bout

- **Maintenance 2026-03-22** : fix infra `vite-tsconfig-paths`, "créature" → "Pokemon", README réécrit, agents améliorés, style commit titre seul

- **Plan 007** — Renderer POC : bootstrap Phaser 4 RC6, grille iso 12x12, sprites placeholder, sélection + highlight, déplacement + ciblage hot-seat, queue animations

- **Plan 008** — Move+Act FFTA-like : `turnState { hasMoved, hasActed }`, `EndTurn` avec direction, `getLegalActions` conditionnel, 234 tests

- **Plan 010** — Sprites PMDCollab : script `extract-sprites.ts`, `SpriteLoader.ts`, `PokemonSprite.ts` refactoré, portraits timeline, atlas pour 4 Pokemon

- **Plan 009** — UI FFT-like : `BattleUIScene` overlay, menu action FFT, sous-menu attaque, panel info, timeline, curseur animé, state machine 6 états

- **Post-plan 009 — Bugfixes + features dash (2026-03-24)** : `PlayerId` const enum, fix `HighlightKind`, fix dash targeting, `getValidTargetPositions` Dash toutes directions, Dash repositionne caster, Dash dans vide autorisé

- **Plan 011** — KO body blocking : `koCountdown` supprimé, corps traversable non-stoppable, `playFaintAndStay`, 249 tests

- **Plan 012** — Direction fin de tour : `direction` obligatoire sur `EndTurn`, `DirectionPicker` spritesheet arrows, orientation initiale vers centre grille

- **Plan 013** — Modèle carte + phase placement : `MapDefinition`, `PlacementPhase` serpent/libre/undo/autoPlaceAll, `poc-arena` 12x12, `PlacementRosterPanel`, flow placement → combat

- **Post-plan 013 — Roster 4 → 12, 16 → 48 moves, format 6v6 (2026-03-26)** : 8 nouveaux Pokemon, 32 nouveaux moves, URL `?random`, status icons, stat change indicators

- **Plan 015** — Stats niveau 50 : `computeStatAtLevel(base, 50)`, `PokemonInstance.combatStats`, damage-calculator utilise combatStats, 305 tests

- **Plan 019** — Preview dégâts estimés : `estimateDamage()`, preview dégradée HP bar, "Immune" pour immunités, 316 tests

- **Plan 020** — Canvas responsive + zoom/pan : FIT scaling, 3 niveaux zoom discrets, pan clavier/caméra, `roundPixels`, filtre NEAREST par sprite

- **Plan 021** — Sprite offsets PMDCollab + ombres : `Idle-Offsets.png`, `offsets.json`, HP bar/icône statut positionnés via headOffsetY, ombre ellipse sous pieds

- **Plan 018** — Status icons ZA + HP bar FFTIC + badges stat + sleep anim : `TurnTimeline` icônes ZA, HP bar 3 couleurs, icône statut sur sprite, badges Showdown stat changes

- **Plan 017** — Preview AoE sur grille : preview dynamique (mouse), flow 2 étapes style FFTA (preview → lock → confirm), outline périmétrique portée

- **Plan 016** — Infos attaques UI + type icons : fix `resolveCone` largeur dynamique, fix `Cross` self-centered, type icons Pokepedia ZA, category icons Bulbagarden, `MoveTooltip`, `pattern-preview.ts`

- **Plan 022** — Refonte timeline turn order : `predictedNextRoundOrder` dans BattleState, section haute/basse, séparateur round, KO retirés

- **Plan 023** — Mode Sandbox + 8 moves défensifs : micro-carte 6x6, DummyAiController, 2 panels, Protect/Detect/Wide Guard/Quick Guard/Counter/Mirror Coat/Metal Burst/Endure, `DefensiveKind`, `ActiveDefense`, 56 moves

- **Refonte orchestration agents (2026-04-01)** : agents `commit-message` et `sandbox-url`, flow plan revu, 21 agents actifs

- **Plan 026** — Roster expansion Phase 1 : BadlyPoisoned, Confusion tactique, Bind, Knockback, Multi-hit, Recharge, 17 nouveaux moves, 595 tests

- **Plan 025** — Tests intégration par move + mécaniques : 56 fichiers test moves, 9 fichiers mécaniques transversales, `buildMoveTestEngine`, 582 tests

- **Plan 027** — Roster 12 → 20 Pokemon : 8 nouveaux (Évoli, Tentacool, Nidoran♂, Miaouss, Magnéti, Sabelette, Excelangue, Kangourex), sprites PMDCollab

- **Bugfix DummyAiController (2026-04-02)** : `playTurn()` retourne `BattleEvent[]`, 596 tests

- **Plan 029** — IA jouable : `AiDifficulty`, `AiProfile`, `action-scorer.ts`, `AiTeamController`, Player2 = IA Easy par défaut, 671 tests

- **Améliorations IA post-plan (2026-04-03)** : EndTurn orienté ennemi, scoring tiles réelles, friendly fire penalty, self-buffs intelligents, lookahead move+attack, filtrage scores négatifs

- **Plan 033** — Team Select : `TeamSelectScene`, `validateTeamSelection()`, toggle Humain/IA, bouton Auto/Vider/Valider, zones spawn colorées par équipe, 664 tests

- **Plan 032** — Portée déplacement variable : `computeMovement(baseSpeed, stages)`, paliers 2-7, recalcul dynamique, 705 tests

- **Plan 031** — Feedbacks visuels + refactor statuts volatils : BattleText unifié, knockback slide, confusion wobble permanent, 5 niveaux efficacité, refactor `ActiveLink` → `Seeded`/`Trapped`, 630 tests

- **Plan 030** — i18n FR/EN : système maison 70 lignes, `t()`/`setLanguage()`/`detectLanguage()`, fichiers JSON data, 7 fichiers UI migrés, bouton bascule FR/EN, 687 tests

- **Plan 028** — Replay déterministe : PRNG mulberry32 seedé, `BattleReplay`, `runReplay`, golden-replay.json, 659 tests

- **Plan 024** — Bugfixes sandbox : fix status au spawn, fix Vampigraine HP bar, menu action bas-droite relocalisé, 333 tests

- **Plan 037** — Battle Log Panel : `BattleLogFormatter` (16 event types, i18n FR/EN), `BattleLogPanel` scroll/pliable/clickable, 694 tests

- **Bugfixes post-plan 039 (2026-04-05)** : fix DirectionPicker import, fix portée ennemie hover, fix direction IA, fix self-target direction

- **Plan 039** — Animations combat : `AnimationCategory` (Contact/Shoot/Charge), pipeline sprites 3 nouvelles anims, direction pendant déplacement/avant attaque, `playAnimationOnce` avec fallback

- **Plan 038** — Portée déplacement ennemis hover : `getReachableTilesForPokemon`, layer `enemyRangeGraphics`, overlay orange, `docs/design-system.md` créé

- **Plan 036** — Menu principal + Settings + Disclaimer : `MainMenuScene`, `BattleModeScene`, `SettingsScene`, `CreditsScene`, `GameSettings`, `VITE_SANDBOX`

- **Plan 035** — Sandbox CLI : suppression query params, `VITE_SANDBOX`, `SandboxConfig`, `pnpm dev:sandbox`, agent `sandbox-json`

- **Plan 040** — Hot-seat multi-équipes : `PlayerId` 12 valeurs, serpentine N équipes, `TEAM_COLORS[12]`, poc-arena 12×20 avec 5 formats, `TeamSelectScene` dynamique, 699 tests

- **Publication Phase 2 (2026-04-06)** : README anglais, LICENSE MIT, GitHub Actions CI+Deploy, GitHub Pages, wiki joueur submodule, 5 nouveaux agents, fix lint ~100 violations

- **Plan 041** — Analytics Goatcounter (production uniquement, sans cookies, conforme RGPD)

- **Plan 042** — Bugfixes playtest : HP bar couleur équipe, preview dégâts noir semi-transparent, border blanc badges statut, Espace/C raccourcis clavier, fix IA vs IA victoire

- **Plan 043** — Tileset arène PMD : ICON Isometric Pack (Jao), `IsometricGrid.drawGrid()` texturé, variantes pseudo-aléatoires 15%

- **Plan 044** — Mode pixel art + police Pokemon Emerald Pro : `roundPixels: true`, `FONT_FAMILY`, `TILE_WIDTH=32/HEIGHT=16`, zoom × 2

- **Plan 045** — Format carte Tiled + parser + validation : `TerrainType` 11 valeurs, suppression `isPassable`, pipeline `packages/data/src/tiled/`, `MapPreviewScene`, `pnpm dev:map`

- **Plan 046** — Dénivelés + dégâts chute : `canTraverse` (montée max 0.5), `getHeightModifier` (±10%), `calculateFallDamage` (paliers 33/66/100%), BFS asymétrique, renderer `gridToScreen(x,y,height)`, `TILE_ELEVATION_STEP=8`, Hop/Walk selon `heightDiff`, 45 tests

- **Plan 046 — 6 vagues feedback playtest (2026-04-11)** : `canTraverse` descente max 1.0, `MovementStep`, single diagonal tween, `movement-animation.ts`, SandboxPanel accordéon, 810/810 tests

- **Plan 047** — LoS 3D + collisions terrain : `heightBlocks`, `MoveFlags` aligné Showdown, `hasLineOfSight` Bresenham, LoS dans 9 resolvers targeting, `ignoresLineOfSight` dérivé, dash contre mur `WallImpactDealt`, `resolveBlastEpicenter`, peuplement `moveFlags` ~74 moves, preview AoE filtrée

- **Plan 047 — hotfixes post-playtest (2026-04-11)** : `heightBlocks` min→max corrigé, `withinHeightReach`, blast épicentre = case avant pilier, `getLegalActions` utilise `resolveTargeting`, map unique `sandbox-los.tmj`, 839/839 tests

- **Plan 049** — Migration données vers référence JSON : `packages/data/src/roster/`, 3 loaders, suppression `base/pokemon.ts` etc., balance overrides

- **Plan 048** — Pokedex Reference Knowledge Base : `packages/data/reference/` 5 JSON (1025 espèces, 850 moves, 311 abilities, 948 items, type-chart), 19 index inversés, script `build-reference.ts`

- **Session 2026-04-13 — Plan 050 tileset custom PMD** : `tileset.png` (32×2368px, 74 tiles) + `tileset.tsj`, pipeline Python (4 scripts), 24 `.tmj` migrés, `resolveTileProperties` slope flip, dead code renderer supprimé, 849/849 tests

- **Bugfix depth animations (2026-04-12)** : `PokemonSprite.playAttackAnimation` bump depth, `animateMoveTo` idem, constantes `ATTACK_DEPTH_ENVELOPE_RADIUS=3`, `MOVEMENT_DEPTH_ENVELOPE_RADIUS=1`

- **Bugfix renderer (2026-04-14)** : layering `constants.ts` — tiles (1-125) → highlights (500-510) → Pokemon (520+) → curseur (900) → UI (1000+)

- **Plan 052** — Orientation tactique : `FacingZone`, `getFacingModifier` (0.85/1.0/1.15), intégré damage calc + preview, 28 tests

- **Plan 053** — Undo déplacement : action `undo_move`, snapshot restaure position, bouton "Annuler déplacement", 958 tests

- **Plan 054** — Système CT : `TurnSystem` interface, `ChargeTimeTurnSystem` (CT 600, seuil 1000, `ctGain`), `ct-costs.ts`, `EffectTier`, barre CT timeline, `ActionMenu` CT, 999 tests, CT activé par défaut

- **Plan 051** — Types terrain + modificateurs : 6 nouveaux BattleEventType, `terrain-effects.ts`, BFS Dijkstra malus terrain, bonus type/terrain +15%, brûlure au passage magma, `terrain-tick-handler`, ice slide, KO létal terrain (lava/deep_water), renderer tint supprimé ensuite

- **Plans Phase 3** :
  - **Plan 055** — bug gatling (immunité statut par type, icône terrain, KO anim, HP preview, stagger texte, ombrage flancs)
  - **Plan 056** — pipeline données Champions : `pnpm data:update`, `pnpm data:diff`, 45 moves overridés, `champions-status.json`
  - **Plan 057** — statuts Champions runtime : `StatusRules` injecté `BattleEngine`, paralysie 12.5%, gel 25% max 3t, sommeil sample([2,3,3])
  - **Session 2026-04-16** : fix `PlacementPhase` test, CI `pnpm test:integration`, tileset brightness uniforme
  - **Plan 058** — Preview CT Timeline : `BattleEngine.predictCtTimeline(moveId, count)`, entrées ghost timeline
  - **Plan 059** — CT Timeline prédictive scrollable : 24 slots, scroll molette, auto-scroll confirm_attack, entrée tail
  - **Plan 060 partiel** — Curseur FFTA (livré) + silhouette occlusion SKIPPÉE
  - **Plan 065** — Fix depth + Alt-click picking + OcclusionFader : `DEPTH_RAISED_TILE_BASE`, Alt picking, `OcclusionFader.ts`, fade alpha 0.4, Phase 3.5 repoussée (décision #272)
  - **Plan 066** — 7 maps thématiques (forest, cramped-cave, le-mur, volcano, swamp, desert, naval-arena), multi-format 5 objectgroups spawns
  - **Plan 067** — Écran sélection carte : `MapSelectScene`, flow MainMenu → TeamSelect → MapSelect → Placement → Battle
  - **Session 2026-04-24** : suppression `TERRAIN_TINT` (commit `d37b7d0`)
  - **Plan 068** — Fix IA terrain + pathfinding : `DANGEROUS_TERRAIN_PENALTY=8`, `scoreMove` BFS sans budget, 3 méthodes publiques BattleEngine, fix traversal Flying/Fire sur terrains
  - **Plan 064** — Décorations + obstacles Tiled : Ghost traverse obstacles, parser `decorations`, `DecorationsLayer.ts`, 4 sprites PixelLab, 6 scénarios Gherkin

### Historique plans Phase 3 finis
*(voir ci-dessus — section "Plans Phase 3")*

### Prochaine étape

**Phase 4 en cours.** Plans 069–076 terminés.

Prochain : **Roster Batch C** (Pokemon Gen 1 restants) ou **Team Builder** (sélection moves + items + SP). Méga-évolutions → Phase 9.

### Bugs connus non corrigés

*(voir `docs/backlog.md`)* — `le-mur.tmj` désactivée, CT scoring IA différé (nécessite lookahead multi-tour)

### Points à adresser (renderer)
- Représentation visuelle moves défensifs : animation/feedback quand Protect bloque, Counter renvoie
- Menu action : position bas-droite retenue définitive

### Standards code établis
- Pas d'abréviations, variables nommées comme leur type
- Const object enum pattern (`as const` + type dérivé)
- 1 fichier = 1 interface, séparation enums/types/grid/battle
- Pas de commentaires (sauf algo complexe)
- Mocks : `abstract class` + `static readonly` + données pures
- Tests : comportement uniquement, const enums
- Coverage 100% core (threshold bloquant)

### Questions ouvertes
- Formules dérivées (Mouvement/Saut/Initiative depuis Vitesse+Poids) — Phase 1
- Movesets POC : Bombe-Beurk trop forte, Salamèche trop faible — Sludge Bomb 112 dégâts sur Pidgey (40 HP), ratio 2.8x à surveiller
- Friendly fire fréquent avec IA random (comportement attendu, à garder en tête pour équilibrage)
- PP system : IA sans filtre cible gaspille PP — `getLegalActions` peut servir de garde-fou
