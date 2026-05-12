# Roadmap — Pokemon Tactics

> Phases de développement du POC au jeu complet.
> Roster limité : 151 premiers Pokemon (Gen 1) — décision #92.

---

## Phase 0 — Prototype technique (POC) ✅ *Terminé*

> But : valider la stack, avoir un combat jouable minimaliste

### Core
- [x] Setup monorepo (pnpm workspaces, tsconfig, Vite, Vitest, Biome)
- [x] Modèles de base (Pokemon, Move, Grid, BattleState)
- [x] Grille plate, placement 2 Pokemon
- [x] Système de tour simple (round-robin par Vitesse)
- [x] Déplacement (pathfinding BFS)
- [x] Attaque single target + calcul dégâts (formule Gen 5+, STAB, types)
- [x] Condition de victoire (dernière équipe debout)
- [x] Move+Act par tour (FFTA-like)
- [x] 5 statuts majeurs (brûlure, poison, paralysie, gel, sommeil)
- [x] 9 targeting patterns (single, self, cone, cross, line, dash, zone, slash, blast)
- [x] Friendly fire actif
- [x] Type chart 18x18
- [x] Tests unitaires pour chaque mécanique (664 tests, 100% coverage — 73 fichiers moves + 14 mécaniques transversales)

### Renderer
- [x] Grille isométrique 2D avec Phaser 4
- [x] Sprites Pokemon animés (PMDCollab : Idle/Walk/Attack/Hurt/Faint, portraits)
- [x] Sélection + déplacement visuel + animation
- [x] UI FFT-like (menu d'action, sous-menu attaque, panel info, timeline, curseur)
- [x] State machine 6 états + overlay scene séparée
- [x] Écran de victoire
- [x] Hot-seat 2 joueurs basique

### AI
- [x] IA random headless (validation API core, 58 rounds, victoire détectée)

---

## Phase 1 — Combat fonctionnel ✅ *Terminé*

> But : combat complet et varié, jouable en hot-seat, avec assez de Pokemon pour tester toutes les mécaniques

### Fondations (Phase 0)
Formule dégâts, type chart, 9 targeting patterns, 5 statuts majeurs, friendly fire, Move+Act, stat stages (-6/+6), hot-seat, 12 Pokemon + 48 moves, format 6v6, placement interactif.

### Core
- [x] KO définitif : corps reste sur tile, traversable mais non-stoppable (plan 011)
- [x] Placement initial configurable : `MapDefinition`, `PlacementPhase`, alternance serpent, mode random (plan 013)
- [x] Direction de fin de tour (orientation choisie avant EndTurn)
- [x] Nouveaux patterns : `slash` (arc frontal 3 cases) et `blast` (projectile + explosion circulaire) — décisions #108-109
- [x] `tactical.ts` : 7 changements de pattern (décision #110)
- [x] **Mode Sandbox** : 1 Pokemon joueur vs 1 Dummy configurable, 2 panels (Joueur/Dummy), toolbar Réinitialiser + Exporter JSON, `pnpm dev:sandbox [config.json|json]`, Dummy preset ou custom stats (décisions #138-139) — plan 023 + plan 035
- [x] 8 moves défensifs : Abri, Détection, Garde Large, Prévention, Riposte, Voile Miroir, Fulmifer, Ténacité (décisions #141-146) + tests intégration Gherkin — plan 023
- [x] Moves stat changes : Épée Danse (+2 Atk), Mur de Fer (+2 Def), Rugissement (-1 Atk cone), Hurlement (-1 Atk cone), Flash (-1 Accuracy zone r2) — plan 026
- [x] Moves AoE variés : Séisme (zone r2), Acide (cone + SpDef debuff), Tranche (slash), Draco-Queue (slash + knockback) — plan 026
- [x] Moves portées variées : Ultimapoing (mêlée), Dard-Venin (mêlée + poison), Ultralaser (ligne 5 + recharge), Double Pied (multi-hit x2), Combo-Griffe (multi-hit 2-5) — plan 026
- [x] Statuts volatils : confusion tactique (redirection allié, direction aléatoire, tour perdu si pas d'allié) — plan 026
- [x] Poison grave : dégâts croissants via toxicCounter (1/16 à 15/16 HP) — plan 026
- [x] Format 6v6 (plan 013)
- [x] Tests d'intégration par move : 73 fichiers moves + 14 fichiers mécaniques, helper `buildMoveTestEngine`, **595 tests** (plans 025+026)
- [x] Roster élargi (~20 Pokemon) — 20 Pokemon jouables (+1 Dummy), 72 moves, sprites PMDCollab (plan 027)
- [x] Stats niveau 50 : `computeStatAtLevel` (plan 015)
- [x] Système de replay (log d'actions déterministe, seed + rejeu)

### Renderer
- [x] Placement initial visuel : phase interactive, panel roster, zones spawn highlight (plan 013)
- [x] Choix direction fin de tour
- [x] Corps KO visible (sprite Faint persistant, alpha réduit)
- [x] Stat change indicators (flèches ↑↓ colorées) dans InfoPanel
- [x] Status icons (pastilles colorées) dans turn timeline
- [x] Niveau affiché dans UI (`Lv.50` dans InfoPanel)
- [x] Info détaillées attaques : catégorie icon SV + nom + PP courants/max + tooltip hover — plan 016
- [x] Refonte panel info stats : badges colorés Showdown (bleu buff / rouge debuff) — plan 018
- [x] Feedback visuel statuts sur sprites (icônes ZA, miniature ZA InfoPanel, animation Sleep PMD) — plan 018
- [x] Prévisualisation AoE : preview hover, flow 2 étapes FFTA (verrouillage + clignotement + confirmation), `confirmAttack` configurable, couleurs rouge/bleu, outline périmétrique portée — plan 017
- [x] Preview dégâts estimés : random roll x0.85–1.00, `estimateDamage()` core, zone dégradée HP bar + texte flottant min–max, "Immune" pour immunités, AoE multi-cibles — plan 019
- [x] Canvas responsive FIT (Phaser.Scale.FIT, CSS 100vw/100vh) — plan 020
- [x] Zoom 3 niveaux (close-up 2.0x / medium 1.3x / overview 0.85x), molette + touches +/- — plan 020
- [x] Pan caméra aux bords (50px threshold, 6px/frame) + suivi Pokemon actif (camera.pan fluide) — plan 020
- [x] Sprite offsets corrects via Shadow.png PMDCollab + ombres ellipse — plan 021
- [x] Refonte turn order (timeline) — plan 022

---

## Phase 2 — Démo jouable ✅ *Terminé*

> But : lien partageable, quelqu'un joue seul contre l'IA et s'amuse

- [x] i18n FR/EN (détection auto navigateur, persistance localStorage, bouton bascule) — plan 030
- [x] Menu principal + Settings (langue, damage preview on/off) — plan 036 (MainMenuScene, BattleModeScene, SettingsScene, CreditsScene, GameSettings localStorage, i18n ~20 clés)
- [x] Feedbacks visuels mécaniques (confusion, vampigraine, bind, knockback, etc.) — plan 031 (BattleText, knockback slide, confusion wobble, icônes Seeded/Trapped)
- [x] Refactor core : Vampigraine et Piège en statuts volatils (remplace ActiveLink) — plan 031
- [x] Indicateur visuel miss — texte flottant "Miss" via BattleText (plan 031)
- [x] Animations fluides (attaque par catégorie Contact/Shoot/Charge, direction dynamique, pipeline sprites Shoot/Charge/Hop) — plan 039
- [x] IA jouable avec personnalité (plan 029 — AiDifficulty easy/medium/hard, action-scorer, scored-ai, AiTeamController, smoke test 6v6)
- [x] IA améliorée : lookahead move+attack (évaluer attaques possibles après déplacement)
- [x] Battle log — panel haut droite, i18n FR/EN, couleurs par type message, noms cliquables, pliable, scroll auto — plan 037
- [x] Portée déplacement ennemis au hover (overlay orange, layer `enemyRangeGraphics`) — plan 038
- [x] Algo portée déplacement revu — plan 032
- [x] Sélection d'équipe (grille portraits 82px colorés, bouton Auto re-randomize/Vider, toggle Humain/IA, toggle placement auto/manuel, validation `validateTeamSelection()`, support IA vs IA, bypass sandbox, noms i18n, bouton Retour) — plan 033
- [x] Hot-seat 1v1 + multi-équipes (2 à 12 joueurs, IA ou humain, carte 12x20, 12 couleurs) — plan 040
- [x] Repo public (README EN, LICENSE MIT, issue templates, wiki joueur, CI GitHub Actions)
- [x] Publication (GitHub Pages, release v2026.4.1, CalVer)

---

## Phase 3 — Terrain & Tactics ✅ *Terminé*

> But : la vraie profondeur tactique — le terrain change le jeu

- [x] Tileset isométrique (ICON Isometric Pack / Jao — tiles 32×32 ×2, filtre NEAREST, marquages arène overlay) — plan 043
- [x] Supprimer POKEMON_SPRITE_SCALE=2 + TILE_SPRITE_SCALE=2, rattraper offsets, ajuster zoom — plan 044
- [x] Mode pixel art Phaser (roundPixels:true, NEAREST manuel par texture, police adaptée) — plan 044
- [x] Format de carte compatible Tiled + pipeline chargement (parseTiledMap, validateTiledMap, loadTiledMap, MapPreviewScene — plan 045)
- [x] Dénivelés (hauteur tiles) + dégâts de chute (plan 046 — canTraverse, getHeightModifier, isMeleeBlockedByHeight, calculateFallDamage, renderer surélevé, highlands.tmj, 45 tests)
- [x] Tileset custom PMD-based (remplace tiles JAO) — plan 050 (11 solides + 4 liquides, pipeline Python, 24 maps migrées vers tileset.tsj)
- [x] Obstacles + line of sight — plan 047
- [x] Types de terrain (lave, eau, herbe) + modificateurs — plan 051 (core + tests + maps sandbox + renderer tint)
- [x] Orientation tactique (dos/face FFTA) — plan 052 (face -15%, flanc neutre, dos +15% dégâts, preview "(+15%)" / "(-15%)", 28 tests)
- [x] Système CT (remplacement round-robin) — plan 054 (interface `TurnSystem`, `ChargeTimeTurnSystem`, `ct-costs`, dual-mode BattleEngine, TurnTimeline CT, ActionMenu CT, toggle TeamSelectScene, i18n, 999 tests. Décisions #254-256)
- [x] **[UX CT]** Timeline CT prédictive scrollable style FFX — 24 slots simulés par core, slot 0 ancré, 11 slots scrollables molette, bordure teal-vert Pokemon actif, entrée tail "..." — plan 058 + plan 059
- [x] Undo déplacement (annulable avant attaque) — plan 053 (action `undo_move`, bouton "Annuler déplacement", annulation brûlure magma, 8 tests)
- [x] Curseur FFTA — variantes curseur (settings + touche H), depth bugfix curseur (500 global) — plan 060 Section A
- [ ] ~~Silhouette X-ray occlusion~~ — **SKIPPÉE** (résolue nativement par renderer Babylon Phase 3.5, décision 2026-04-18)
- [x] Système décorations Tiled — `decorations.tsj`, Ghost traverse obstacles, parser objectgroup, sprites PixelLab, `DecorationsLayer` renderer — plan 064. Bonus différé : marquages arène + pokéball centrale.
- [x] **Occlusion dynamique par sprite** — fix depth tiles surélevées (`DEPTH_RAISED_TILE_BASE`), Alt-click picking multi-niveaux (`COLOR_CURSOR_ALT`), module `OcclusionFader` (fade alpha 0.4, AABB screen-space). **Phase 3.5 rewrite Babylon repoussée après Phase 7** (décision #272). — plan 065
- [x] Roster de maps variées — 7 maps thématiques : forest (14×14), cramped-cave (12×12), le-mur (16×16), volcano (14×14), swamp (14×14), desert (14×14), naval-arena (14×14). Toutes multi-format (5 objectgroups). Plan 066 terminé 2026-04-23.
- [x] Génération maps par IA (prompt → `MapDefinition` ou .tmj valide) — agent `level-designer` utilisé pour 7 maps du plan 066.
- [x] Choix maps depuis UI (écran sélection, preview, metadata) — plan 067 terminé 2026-04-23.
- [x] Remplacer `le-mur` par toundra plate — `tundra.tmj` livrée 2026-04-24 (neige/glace, corridor central, 5 formats).

### Décisions format de carte (plan 045)

- **Tiled comme éditeur principal**. Core ne connaît pas Tiled — voit uniquement `MapDefinition`.
- **Parser dans `packages/data`** (`packages/data/src/tiled/`) : convertit .tmj → `MapDefinition` au runtime. Zéro dépendance Phaser.
- **Layers** : `terrain` (tilelayer, GID→TileState via propriétés custom), `decorations` (ignoré core), 5 objectgroups spawns `spawns_1v1/3p/4p/6p/12p`. Layer legacy `spawns` avec `formatTeamCount` conservé pour compat `dev/*.tmj` uniquement.
- **Propriétés custom** par tile : `terrain` (string → TerrainType), `height` (int). `isPassable` supprimé.
- **Chargement dynamique** : `loadTiledMap(url)` fait fetch runtime + parse + validate. Pas de conversion build-time.
- **Tilesets externes .tsj supportés**.

---

> **Note — Phase 3.5 et Phase 3.6 déplacées après Phase 7** (2026-04-20). Noms conservés pour les refs historiques.

---

## Phase 4 — Gameplay Pokemon complet

> But : couvrir toutes les mécaniques Pokemon, ajouter profondeur stratégique

- [x] Talents (capacités passives) — plans 069 + 070 terminés. 20 abilities, `AbilityHandlerRegistry`, 9 hooks, 26+ tests intégration. Pattern Showdown : hooks blocants retournent `BlockResult { blocked, events }`, modifieur de durée retourne `DurationModifyResult`. Buffer startup events, Lévitation terrain corrigée, Tempo Perso bloque Intimidation, anti-spam seuil 1/3 HP. Voir `docs/abilities-system.md`.
- [x] Genres des Pokemon (mâle/femelle/asexué selon ratio officiel) — plan 071 terminé. `PokemonGender` enum, `genderRatio` exposé via loaders, roll déterministe via `genderRng` (replay), `genderOverride` prêt pour Team Builder. Cute Charm vérifie genre opposé non-genderless. Symboles ♂/♀ Unicode dans InfoPanel.
- [x] Natures / Stat Alignment — plan 072 terminé (mécanique core uniquement, affichage UI reporté). `Nature` enum (25), table boost/lowered en dur dans le core, `applyNatureModifier(stats, nature)` + `computeCombatStats(baseStats, level, nature?)`. Roll uniforme via `rollNature(rng)`, déterministe via `creationRng` partagé avec gender. `natureOverrides` prêt pour Team Builder. HP toujours exclu. **Affichage InfoPanel différé** à la refonte UI.
- [x] Objets tenus — plan 073 terminé. `HeldItemId` (12 items), `HeldItemHandler` (8 hooks dont `onMoveLock` pour verrou Choice piloté par hook), `HeldItemHandlerRegistry`, mini-système critiques, verrou Choice, validateur `DuplicateItem`, 4 nouveaux `BattleEventType`, fix `HpRestored` HP bar renderer, i18n `battle.itemConsumed`, 12 tests intégration. Décisions #288-295.
- [x] EV / IV — plan 074 terminé. IV fixes à 31 pour tous les Pokemon. EV → Stat Points (SP) : 66 max, 32 max par stat, 1 SP = +1 stat. `applyStatPoints(stats, sp)`, `rollStatPoints(rng)`, `statPointsOverrides` prêt pour Team Builder. Formule dégâts alignée IV=31.
- [ ] Roster élargi — 70 finales Gen 1 (hors Ditto, starters/intermédiaires hors mini à partir de cette phase)
  - [x] **Batch A (12)** — Starters finaux + Éévolutions + iconiques — plan 075 terminé 2026-05-04. Venusaur, Dracaufeu, Tortank, Raichu, Alakazam, Mackogneur, Léviator, Ronflex, Dracolosse, Aquali, Pyroli, Voltali. 29 moves ajoutés (102 total). 8 abilities ajoutées (28 total). Formes non-finales retirées du roster mini. 4-move limit en combat (décision #300, 2026-05-05).
  - [x] **Batch B (19)** — Coverage types variés — plan 076 terminé 2026-05-06. Nidoqueen, Nidoking, Colossinge, Arcanin, Flagadoss, Grolem, Tartard, Gengar, Hypnomade, Noadkoko, Ossatueur, Kicklee, Tygnon, Rhydon, Starmie, Insécateur, Scarabrute, Kabutops, Ptéra. 10 moves ajoutés (112 total). 8 abilities ajoutées (36 total). Hooks `blocksRecoil`, `preventsCrit`, `onEndTurn`.
  - [x] **Batch C (17)** — Secondaires + spéciaux — plan 077 terminé 2026-05-07, Haunter retiré post-playtest (roster 52→51). Sablaireau, Feunard, Grodoudou, Rafflesia, Akwakwak, Tentacruel, Magnéton, Lamantine, Crustabri, Kingler, Électrode, Lippoutou, Élektek, Magmar, Lokhlass, Poissoroy, Amonistar. 15 moves ajoutés (127 total). 8 abilities ajoutées (44 total). `StatusType.LockedOn` + accuracy-check hook.
  - [ ] **Batch D** — Exotiques + légendaires : Haunter (réintégrable), Dodrio, Grotadmorv, Onix, Smogogo, Leveinard, Saquedeneu, Hypocéan, M. Mime, Tauros, Artikodin, Électhor, Sulfura, Roucoul, Staross…
- [ ] Moves & talents restants post-batchs — compléter pool attaques et talents des 70 nouveaux Pokemon. Chaque batch introduit moves + talents ; un plan de finition couvrira les manquants transversaux (moves multi-Pokemon partagés, talents encore absents).
- [ ] Team Builder (import/export Showdown)
  - [x] **OP Sets curation + gap analysis — plan 082 terminé 2026-05-12.** `packages/data/op-sets/op-sets.json` (160 sets Smogon+custom). Script `pnpm op-sets:analyze` → `docs/op-sets-gap-analysis.md`. Résultat : 128/160 sets `full` (80%), gap : 4 moves + 2 items 🟡 + 10 items 🟢 + 0 ability manquant.
  - [ ] Plans 083-086 restants (UI selection moves/items/SP, import Showdown…)

---

## Phase 5 — Équilibrage

> But : outils pour tester et équilibrer avant d'ouvrir le multi

- [ ] IA LLM (Claude adversaire)
- [ ] Mode headless + outils d'équilibrage — **prérequis** : déplacer `.tmj` dans `packages/data/src/maps/tiled/` et ajouter `loadMapDefinition(id)` Node-compatible. Aujourd'hui maps dans `packages/renderer/public/` chargées via `fetch()` HTTP — inutilisable sans browser.
- [ ] Passes d'équilibrage

---

## Phase 6 — Social & Partage

> But : features qui donnent envie de partager et revenir

- [ ] Share replay via URL + lecteur de replay
- [ ] Défi du jour (seed quotidienne, même combat pour tous)
- [ ] Screenshot de fin de combat partageable

---

## Phase 7 — Multijoueur

> But : jouer contre de vrais adversaires

- [ ] Multijoueur réseau (WebSocket)
- [ ] Écran de victoire enrichi (récap, tours, KO, MVP)
- [ ] Speed controls (skip/accélérer animations)
- [ ] Tutoriel interactif
- [ ] Support manette

---

## Phase 3.5 — Migration renderer 2D-HD (Babylon.js)

> **Position actuelle : après Phase 7** (reordonné 2026-04-20).
>
> But : remplacer renderer Phaser 4 isométrique par Babylon.js 2D-HD (sprites billboards sur terrain 3D extrudé, style Tactics Ogre PSP / Triangle Strategy / FFTIC).

### Contexte

Pivot décidé 2026-04-17 (décisions #263-266). Spike plan 062 (Three.js) validé 4/4. Spike plan 063 (Babylon.js) terminé 2026-04-18 → **Babylon.js retenu** (décision #269). Report post-Phase 7 décidé 2026-04-20 : plan 065 résout l'occlusion en iso 2D, rotation caméra reste un want non-bloquant.

Prérequis :
- Phases 3 → 7 livrées.
- Plan 065 (occlusion fade) livré.
- Occlusion plan 060 silhouette **skippée**.

### À décider en début de phase

- [ ] **Découpage en plans** : 1 plan monolithique vs 4 plans incrémentaux. Voir pistes dans `docs/next.md`.
- [ ] **Tiled : conserver ?** Option A : garder Tiled, `loadTiledMap` → `MapDefinition`. Option B : format map custom orienté 3D. Option C : éditeur custom in-game.
- [ ] **UI stack** : `@babylonjs/gui` natif vs HTML/CSS overlay. Mesurer les deux sur un panel avant de trancher.

### Items techniques

- [ ] Port core renderer : terrain extrudé, sprites directional billboards (atlas PMDCollab), caméra orthographique dimetric, curseur FFTA, occlusion native.
- [ ] Parité feature avec renderer Phaser actuel sur map de référence (combat complet jouable).
- [ ] Port UI : timeline CT, ActionMenu, sous-menu attaque, InfoPanel, battle log, écrans menu/sélection/victoire.
- [ ] Features Phase 3 pour 3D : décorations (herbes hautes billboards), rotation caméra 4 angles.
- [ ] Bundle & perfs : audit `rollup-plugin-visualizer`, flat-shaded `ShaderMaterial` custom (cohérence pixel-art FFTA), Inspector shim type (`skipLibCheck: false`), cible 180-220 kB gzip (vs 273 kB spike).
- [ ] Régler gotchas spike (voir `docs/references/babylon-gotchas.md`) : `GridMaterial.gridOffset`, UV `invertY`, `renderingGroupId`, `alphaCutOff`/`transparencyMode`, deep imports.

### Gates

- Chaque plan sort renderer fonctionnel sur `main` (pas de branche longue).
- Parité feature = critère de succès avant de retirer renderer Phaser.
- Activation `.claude/rules/renderer-babylon.md` dès premier plan.

---

## Phase 3.6 — Maps & Éditeur

> **Position actuelle : après Phase 3.5** (reordonnée 2026-04-20, donc post-Phase 7).
>
> But : contenu varié, roster de maps équilibré, outils de création.

Tie à Babylon : éditeur et props terrain repensés pour renderer 3D.

> **Note 2026-04-20** : *Choix maps UI*, *Roster maps variées* et *génération IA* remontés en Phase 3 — ne dépendent pas de Babylon. Seul l'éditeur in-game reste ici.

- [ ] Éditeur de terrain in-game (placement tiles, hauteurs, spawns, décorations)

---

## Phase 8 — Polish

> But : confort et qualité visuelle

- [ ] Scaling sprites selon taille Pokemon
- [ ] Son / Musique
- [ ] Effets visuels (particules, ombres, lumières)
- [ ] Décors sur les maps
- [ ] Rotation caméra 4 angles
- [ ] UI revamps
- [ ] Auto-save localStorage
- [ ] Tooltips type chart (efficacités au hover)

---

## Phase 9 — Futur / À voir

- [ ] **Générations 2-9** — ajout des 874 Pokemon restants (Gen 2 : 100, Gen 3 : 135, Gen 4 : 107, Gen 5 : 156, Gen 6 : 72, Gen 7 : 88, Gen 8 : 96, Gen 9 : 120). Sprites PMDCollab disponibles pour la majorité. Nécessite pipeline `sprite-config.json` étendu + movesets tactiques par Pokemon.
- [ ] **Méga-Évolutions** — 21 formes Méga Gen 1 (16 officielles + 5 exclusives Pokémon Champions). Sprites PMDCollab : 6 formes ont des fichiers partiels (pending review), aucune complète en mai 2026. À replanifier quand PMDCollab coverage s'améliore. Voir `docs/implementations.md#méga-évolutions-gen-1`.
- [ ] Mode histoire / aventure
- [ ] Conditions de victoire alternatives
- [ ] Draft/ban phase
- [ ] **Modification dynamique du terrain par attaques** — certaines attaques transforment terrain pendant combat (Feu → supprime tall grass, Ébullition crée tiles lave/magma, Force déplace rochers, Glace gèle tiles eau). Mutation runtime `TerrainType` + décoration associée. Reporté Phase 3 en 2026-04-20 : scope trop lourd tant que roster attaques et palette terrains pas figés.
- [ ] **Météo (Tempête de Sable, Soleil, Pluie, Grêle) + capacités/talents associés** — sand-veil (Sandshrew) dormant (hook `onAccuracyModify` supprimé plan 070, à ré-ouvrir ici quand `sandstormActive` ajouté à `BattleState`). Synthèse (Florizarre) affectée : soigne 100% sous Soleil, 25% sous Pluie/Grêle.
- [ ] **Champs (Herbeux, Psy, Électrique, Brumeux, Distorsion)** — modificateurs terrain affectant dégâts, statuts et capacités.
- [ ] **Modèles 3D pour les Pokemon** — remplacer sprites billboards 2D par modèles 3D (glTF/GLB) style Pokemon Champions / Stadium. À évaluer après stabilisation renderer Babylon.
