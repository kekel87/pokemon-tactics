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
- [x] Roster Gen 1 mini — 81 Pokemon jouables (hors Ditto + Méga). Formes non-finales retirées du roster, conservées en reference pour Team Builder futur.
  - [x] **Batch A (12)** — Starters finaux + Éévolutions + iconiques — plan 075 terminé 2026-05-04. 29 moves ajoutés. 8 abilities ajoutées. Formes non-finales retirées du roster mini. 4-move limit en combat (décision #300, 2026-05-05).
  - [x] **Batch B (19)** — Coverage types variés — plan 076 terminé 2026-05-06. 10 moves ajoutés. 8 abilities ajoutées. Hooks `blocksRecoil`, `preventsCrit`, `onEndTurn`.
  - [x] **Batch C (17)** — Secondaires + spéciaux — plan 077 terminé 2026-05-07, Haunter retiré post-playtest (roster 52→51). 15 moves ajoutés. 8 abilities ajoutées. `StatusType.LockedOn` + accuracy-check hook.
  - [x] **Batch D (16)** — plan 078 terminé 2026-05-11. arbok, clefable, parasect, dugtrio, persian, victreebel, rapidash, dodrio, muk, onix, weezing, chansey, tangela, seadra, mr-mime, tauros. 8 moves. 2 abilities (poison-touch, filter). Hook `onAfterDamageDealt`.
  - [x] **Batch E (14)** — plan 079 terminé 2026-05-12. butterfree, beedrill, pidgeot, raticate, fearow, golbat, venomoth, farfetch-d, seaking, articuno, zapdos, moltres, mewtwo, mew. 8 moves. 6 abilities (compound-eyes, swarm, water-veil, pressure, shield-dust, inner-focus). Mécanismes `EffectKind.Drain`, `accuracyMultiplier`, `targetedCtBonus`, `bypassAccuracy`, `onSecondaryEffectBlocked`.
  - Ditto et Méga-évolutions reportés Phase 9.
- [x] **OP Sets curation + gap analysis — plan 082 terminé 2026-05-12.** `packages/data/op-sets/op-sets.json` (160 sets Smogon+custom). Script `pnpm op-sets:analyze` → `docs/op-sets-gap-analysis.md`.
- [x] **Content Batch F + hook onStatLowered — plan 083 terminé 2026-05-12.** 2 moves (giga-drain, focus-blast), 9 items, hook `onStatLowered`.
- [x] **Système Météo — plans 084 + 084b terminés 2026-05-13.** Sun/Rain/Sand/Snow, weather war, BP/accuracy/defense modifiers, Synthesis, Solar-Beam 2-turn, weather-ball, 4 abilities, heat-rock, WeatherHud, i18n, sandbox selector. **op-sets 160/160 full (100%)**.
- [x] Team Builder (import/export Showdown)
  - [x] **085 — Team Builder UI terminé 2026-05-17 + polish CSS/a11y 2026-05-18.** `MyTeamsScene` (list + delete + new + generate random + export) + `TeamEditScene` (6 slots, édition slot actif, 2 colonnes pickers gauche / stats+SP+presets droite, modals Pokemon/Move/Item, nature dropdown 25 entrées ordre Champteams, 4 presets SP, Set OP par slot avec 1-3 sets, Showdown io import/export avec clipboard, auto-save débounce 300 ms). Items non-implémentés grisés. i18n FR/EN ~100 clés + noms FR Pokemon. Menu MainMenu : entry "Constructeur d'équipe". CSS : 12 modules `packages/renderer/src/styles/` (@layer, tokens, `<dialog>` natif, HTML sémantique, bugfix padding global). Décisions #321-325.
  - [ ] **086** — Refonte `TeamSelectScene` (équipes saved + Aléatoire + Nouvelle) + phase placement = sous-pick N mons depuis 6 selon format → **prochain**
- [x] **Mécaniques avancées — lot livré (post-Team Builder).** Plans 088–101. Mécaniques restantes regroupées plus bas (« Mécaniques restantes — moves complexes »).
  - [x] **Barrières aura mobile — plan 095 (2026-05-23).** Reflect / Light Screen, aura mobile r3 Manhattan suit caster. Casse-Brique interaction. Aurora Veil reporté (0 learner Gen 1).
  - [x] **TP moves (`TargetingKind.Teleport`) — plan 088 (2026-05-21).** 7 moves (teleport, fly, dig, bounce, phantom-force, shadow-force, dive), LoS/terrain/hauteur bypassés, états semi-invul Flying/Burrowing/Diving/Vanished.
  - [x] **TP inversé (`TargetingKind.HitAndRun`) — plan 092 (2026-05-21).** u-turn / volt-switch / flip-turn, frappe Single puis retraite Chebyshev, miss/Protect bloque retraite.
  - [x] **MoveCharging visible — plan 094 (2026-05-22).** skull-bash / sky-attack / razor-wind, indicateur ⚡, Flinch volatile, `MoveDefinition.chargeEffects`.
  - [x] **Baton Pass — plan 093 (2026-05-22).** `EffectKind.TransferStatStages`, allié r1, reset caster. Volatils non transférés.
  - [x] **Substitute — plan 099 (2026-05-28).** `substituteHp`, `PostSubstitute`, absorption dégâts/statuts/baisses-stats, flags sound/bypasssub.
  - [x] **Provoc (Taunt) — plan 100 (2026-05-28).** `StatusType.Taunted` volatile 3 tours, filtre `getLegalActions`, Sub bloque / Safeguard-Mist non.
  - [x] **Encore + Entrave (Disable) — plan 101 (2026-05-30).** Move-locking, `lastUsedMoveId`, `timed-volatile-tick-handler` généralisé (Taunted+Disabled+Encored).
- [ ] **Content Batches G — moves « simples » (shape + effet déjà supporté)** — moves Gen 1 learnable par le roster, sans nouvelle mécanique (cf. analyse 2026-05-31, audit complet 2026-06-02). Découpés en batches faits 1 par 1. Chaque move = entrée `tactical.ts` (targeting + effects) + i18n FR/EN + pattern (`move-pattern-designer`, à décider au lancement de chaque batch). Pas de sprite, OP sets optionnels.
  - [x] **G1 — Damage pur physique (40)** — done 2026-05-31 — 213 moves total. Riders complexes différés (throat-chop sound-lock, lash-out/temper-flare/fury-cutter power conditionnel, ice-spinner/steel-roller terrain, supercell-slam crash, fell-stinger KO-boost, psychic-fangs/raging-bull screen-break, poltergeist item-check). Plan 102.
  - [x] **G2 — Damage pur spécial + multi-hit (23)** — done 2026-06-01 — **236 moves total**. Spéciaux : `swift, dragon-pulse, dazzling-gleam, hyper-voice, overheat, vacuum-wave, leaf-storm, aura-sphere, magical-leaf, power-gem, disarming-voice, draco-meteor, shock-wave` ; multi-hit : `dual-wingbeat, rock-blast, scale-shot, bullet-seed, double-hit, pin-missile, fury-attack, bone-rush, icicle-crash, tail-slap`. 5 moves sortis du batch vers plans dédiés : `psyshock`/`psystrike` (dégâts spé sur Déf physique), `alluring-voice`/`burning-jealousy` (secondaire conditionnel si cible boostée), `triple-axel` (escalade multi-hit). Plan 103.
  - [x] **G3 — Damage + statut/flinch/confusion secondaire (24)** — done 2026-06-02 — **260 moves total**. Spéciaux : Vibraqua (water-pulse), Canicule (heat-wave), Sable Ardent (scorching-sands), Vibrobscur (dark-pulse), Vent Violent (hurricane), Ébullition (scald), Éclair (thunder-shock), Élecanon (zap-cannon), Feu d'Enfer (inferno), Poudreuse (powder-snow), Détritus (sludge), Purédpois (gunk-shot), Extrasenseur (extrasensory), Ouragan (twister) ; physiques : Psykoud'Boul (zen-headbutt), Direct Toxik (poison-jab), Tête de Fer (iron-head), Détricanon (dragon-rush), Poison Croix (cross-poison), Draco-Charge (dragon-rush variant, +knockback 1), Étincelle (spark), Étonnement (astonish), Frotte-Frimousse (nuzzle), Queue-Poison (poison-tail). 3 moves sortis vers plans dédiés : Lyophilisation/freeze-dry (super-efficace vs Eau, override type-chart), Ronflement/snore (gate sommeil), Talon-Marteau/axe-kick (crash on miss). Plan 104.
  - [x] **G4 — Damage + stat-drop / high-crit / recoil / drain (36)** — done 2026-06-02 — **296 moves total**. Recoil rammers en Dash 3 (Bélier/take-down, Éclair Fou/wild-charge, Rapace/brave-bird, Aquatacle/wave-crash) ; Martobois/wood-hammer Single (coup de masse). Drain : Vampi-Poing/drain-punch, Vole-Vie/absorb, Vampibaiser/draining-kiss. High-crit (critRatio reference, Damage seul) : Lame de Roc/stone-edge, Tunnelier/drill-run (Line 2), Griffe Ombre/shadow-claw, Tranch'Air/air-cutter, Coupe Psycho/psycho-cut, Tranche-Nuit/night-slash. Stat-drop secondaire (22) : Piétisol/bulldoze, Tomberoche/rock-tomb, Balayette/low-sweep, Bond/pounce, Tir de Boue/mud-shot, Toile Élek/electroweb, Furie-Bond/lunge, Abattage/breaking-swipe, Douche Froide/chilling-water, Câlinerie/play-rough, Aqua-Brèche/liquidation, Coqui-Lame/razor-shell, Éclate Griffe/crush-claw, Telluriforce/earth-power, Bourdon/bug-buzz, Bombe Acide/acid-spray, Ravage Rampant/skitter-smack, Aboiement/snarl, Feu Ensorcelé/mystical-fire, Survinsecte/struggle-bug, Coud'Boue/mud-slap, Ocroupi/muddy-water. AoE → Zone/Cone/Slash. Bugfix hors-plan : flake focus-blast.test.ts seedé (createPrng(1)). Plan 105.
  - [x] **G5 — Pure stat + pure statut (23)** — done 2026-06-02 — **319 moves total**. Debuffs ennemi : Grimace/scary-face, Charme/charm, Croco Larme/fake-tears, Ondes Étranges/eerie-impulse, Strido-Son/metal-sound, Regard Touchant/baby-doll-eyes, Confidence/confide, Chatouille/tickle (Atq+Déf), Gros'Yeux/leer (Cone), Mimi-Queue/tail-whip (Cone), Doux Parfum/sweet-scent (Cone, Esquive), Sécrétion/string-shot (Cone). Buffs : Armure/harden (self Déf+1), Rengorgement/work-up (self Atq+AtqSpé), Poliroche/rock-polish (self Vit+2), Coaching/coaching (allié Atq+Déf via `targetsAlly` — 1er buff-stat-allié générique). Statut : Poudre Toxik/poison-powder + Para-Spore/stun-spore + Danse Folle/teeter-dance (Zone r1), Gaz Toxik/poison-gas (Cone), Doux Baiser/sweet-kiss (Single), Vantardise/swagger (Atq+2 + Confusion), Flatterie/flatter (AtqSpé+1 + Confusion). **4 deferred** (mécanique core absente → mini-plans dédiés) : Dépit/spite (PP-reduction), Venimprégne/venom-drench (conditionnel cible empoisonnée), Influx Magnétik/magnetic-flux (gate Plus/Minus + multi-allié), Grondement/howl (buff multi-allié Gen8+). Plan 106.
  - [x] **G6 — Simples oubliés des batches G1-G5 (11)** — done 2026-06-02 — **330 moves total**. Force/strength (Single 1-1), Écrasement/stomp (Single 1-1, Flinch 30%), Double Baffe/dual-chop (Single 1-1, hits:2), Camaraderie/play-nice (Single 1-3, Atq -1 + bypassAccuracy), Rafale Feu/blast-burn + Végé-Attaque/frenzy-plant + Hydroblast/hydro-cannon (Line 5, recharge), Giga Impact/giga-impact (Dash 3, recharge), Lame Solaire/solar-blade (Single 1-1, twoTurnCharge+sunSkipsCharge), Laser Météore/meteor-beam (Line 5, twoTurnCharge+chargeEffects AtqSpé+1 self), Trempette/splash (Self, no-op). 2 changements core : `validate.ts` exempte `TargetingKind.Self` (décision #410) ; golden-replay figé `GOLDEN_MOVESETS` (décision #411). Plan 107.
- [x] **Couverture tests 100% moves + garde-fou CI** — done 2026-06-02 — plan 108. 210 fichiers `<id>.test.ts` créés (scénarios positionnels bout en bout). Meta-test `move-test-coverage.test.ts` bloque la CI si un move n'a pas de test. Règle dure ajoutée `docs/methodology.md`. Décisions #412-413. Suite CI : **2288 unit + 269 intégration**.

- [x] **Power conditionnel — moteur dynamicPower + 12 moves état-seul — done 2026-06-03 — plan 109.** Moteur générique `dynamic-power-system.ts` (`resolveDynamicPower`, `getEffectivePowerFloor`, `DynamicPowerKind`, `DynamicPowerSpec`). Champs `MoveDefinition.dynamicPower` + `ignoresBurnAttackDrop`. Branché dans `handle-damage` + `estimateDamage`. `getEffectivePowerFloor` corrige le scoring IA (power null=0 ne sont plus exclus). **12 moves livrés (330 → 342)** : Façade/`facade` (×2 si statut self + exemption baisse Atk brûlure via `ignoresBurnAttackDrop`), Châtiment/`hex` (×2 si cible a un statut), Choc Venin/`venoshock` (×2 si cible empoisonnée), Acrobatie/`acrobatics` (×2 sans objet tenu), Force Ajoutée/`stored-power` (20 +20/cran positif), Boule Élek/`electro-ball` (ratio vitesse), Gyroballe/`gyro-ball` (ratio vitesse inverse +1, formule `min(150, floor(25 × spdCible/spdSoi + 1))`), Gigotage/`flail` + Contre/`reversal` (HP% bas), Saumure/`brine` (×2 si cible ≤50% HP), Pression Extrême/`hard-press` (BP selon HP% cible), Giclédo/`water-spout` (150×HP% soi). Tag renderer MoveTooltip « Puissance variable » + i18n FR/EN. Gate CI : **2361 unit + 269 intégration**. Décisions #414-416.

- [ ] **Mécaniques restantes — moves « complexes » (nouvelle méca par type)** — **~162 moves « complexes »** (185 restants audit 2026-06-02, −12 livrés plan 109 → ~173, dont ~11 familles power conditionnel encore à faire). Chacun demande une mécanique non encore codée. Une entrée par type, attaquée 1 par 1. Pool learnable roster total = 494 moves ; 321 implémentés in-pool + 21 hors-pool.
  - [ ] **Champs / Terrains** (Grassy / Electric / Psychic / Misty) — pose AoE r3-4 sur tile cible, ne suit pas le lanceur, 5 tours, single field MVP (un nouveau remplace l'ancien), persiste si setter KO. Grassy +1/16 HP/tour si au sol + Plante ×1.3 ; Psychic Psy ×1.5 + bloque priority entrant ; Electric pas de Sommeil + Élec ×1.3 ; Misty pas de statut majeur + Dragon ×0.5. Multi-fields option future.
  - [ ] **Distorsion (Trick Room)** — global field-wide, 5 tours, flip `ctGain = BASE - vitesse`. Timeline CT reflète l'ordre inversé automatiquement.
  - [ ] **Contrôle moves restants** (Provoc/Entrave/Encore déjà livrés plans 100-101) — in-pool roster : Possessif/`imprison` (foe ne peut utiliser un move connu du lanceur, tant que lanceur vivant), Dissonance Psy/`psychic-noise` (Heal Block 2t — bloque soin), **Dépit/`spite`** (réduit PP du dernier move cible de 4). Hors-pool mais à prévoir si learnsets élargis : Torment, Magic Coat. Statuts volatils modifiant `getLegalActions`. *Dépit = deferred batch G5.*
  - [ ] **Delayed / countdown** — Future Sight/Doom Desire (case fixe AoE r1 délayée 2t, dégâts calculés au cast), Wish (tile-bound heal T+1, wasted si vide), Perish Song (countdown global 3t, applique tous présents), Pain Split (moyenne HP), Endeavor (cible HP = lanceur HP si supérieur), Helping Hand (×1.5 prochain move allié r1, 1t).
  - [ ] **Hazards** (Stealth Rock / Spikes / Toxic Spikes / Sticky Web) — pose tile-locked zone r2-3 centrée tile target (portée r3-4 lanceur), persiste jusqu'à cleanup. Spikes 1/8 HP entrant, Stealth Rock dégâts type-based (×4 Feu/Glace/Vol/Insecte), Sticky Web -1 Vit, Toxic Spikes poison à l'entrée. Cleanup in-pool : Tour Rapide/`rapid-spin` (libère hazards/bind/Vampigraine + Vit +1) et Anti-Brume/`defog` (-1 Esquive cible + retire hazards/terrain).
  - [ ] **Power conditionnel — familles restantes (~22)** — Stat-source : Pression Corporelle/`body-press` (utilise Déf propre), Jeu Déloyal/`foul-play` (Atk cible). Poids : Lancer Gravé/`low-kick` + Écras'Herbe/`grass-knot` + Lourde Bombe/`heavy-slam` + Dévastateur/`heat-crash` (besoin `weightkg` sur instance). Timing : Avalanche/`avalanche` + Représailles/`payback` + Vendetta/`revenge` + Bégaiement/`stomping-tantrum` + Durement/`retaliate` (×2 si frappé avant ou conditions timing). Compteurs : Poing Rageur/`rage-fist` + Mélodie Écho/`echoed-voice` + Unisson/`round` + Dernier Recours/`last-resort`. Terrain : Tension Montante/`rising-voltage` + Force Amplifiée/`expanding-force` + Impulsion Terrain/`terrain-pulse` (après plan Champs/Terrains). Divers : Dernier Tribut/`last-respects`, Nage Furieuse/`fishious-rend` + Bec Supersonique/`bolt-beak`.
  - [ ] **Soin / Cure (~16)** — heal % HP self ou tile-bound. `recover`/`slack-off`/`soft-boiled`/`milk-drink`/`roost` (50%), `morning-sun`/`moonlight`/`synthesis` (météo-dépendant), `rest` (full + sleep), `wish` (T+1 tile-bound, déjà esquissé Delayed), `heal-pulse`/`life-dew`/`pollen-puff` (allié), `aromatherapy`/`heal-bell` (cure statut équipe), `pain-split` (moyenne HP), `strength-sap` (heal = Atk cible + debuff), `ingrain`/`aqua-ring` (regen/tour), `swallow` (stockpile), `healing-wish`/`lunar-dance` (sacrifice + heal switch).
  - [ ] **Item interaction (~12)** — manipulation objet tenu. Sabotage/`knock-off` (×1.5 + retire objet), Larcin/`thief` + Implore/`covet` (vole), Tour de Magie/`trick` + Passe-Passe/`switcheroo` (échange), Dégommage/`fling` (lance objet), Picore/`pluck` + Piqûre/`bug-bite` (mange baie), Calcination/`incinerate` (brûle baie), Gaz Corrosif/`corrosive-gas` (retire), Recyclage/`recycle` (restaure objet consommé), Éructation/`belch` (échoue sauf si baie mangée — gate). Prérequis : système objets consommables/retirables en combat.
  - [ ] **Puissance Cachée / Hidden Power — RÉSOLU SIMPLE** — type normalement variable selon IVs (tout type sauf Fée/Normal), 60 BP. Learnable par Fearow/Parasect/Pidgeot/Raticate. ✅ **Pokemon Champions n'a pas d'IV** (standardisés 31, comme notre projet) → Hidden Power perd sa variabilité : formule all-IV-31 = **type Ténèbres (Dark) fixe, 60 BP**, sans secondaire. Donc **move simple → candidat Batch G6** (Ténèbres spécial 60 BP). Alternative si on veut coller au plus près de Champions : le **retirer du movepool** (son rôle compétitif disparaît sans IVs). À trancher : implémenter Ténèbres 60 BP fixe, ou exclure. Sources : [genpkm](https://genpkm.com/blog/pokemon-champions-no-ivs-stat-points-competitive-guide-2026), [Game8](https://game8.co/games/Pokemon-Champions/archives/593716).
  - [ ] **Trapping (~6)** — empêche déplacement/fuite. `bind`/`wrap`/`fire-spin`/`whirlpool`/`sand-tomb` (dmg/tour + trap 4-5t — `StatusType.Trapped` existe), `block`/`mean-look` (trap pur). Adapter au grid : pas de switch → empêche éloignement ?
  - [ ] **Type manip (~5)** — Conversion/`conversion`, Conversion 2/`conversion-2`, Copie-Type/`reflect-type`, Détrempage/`soak` (change type cible), Flamme Ultime/`burn-up` + Téra Explosion/`tera-blast` (retire/change type self). Mutation runtime du type.
  - [ ] **Morphing / Transform — POINT DÉDIÉ** — `transform` copie cible (stats / moves / type / talent). Très lourd (mutation runtime complète du Pokemon). Learnable par **Mew** dans le roster actuel. À concevoir conjointement avec **Métamorph (Ditto)** + son talent Imposter (transform auto à l'entrée) — Ditto reporté Phase 9, mais Mew rend le move pertinent dès maintenant. Décider : implémenter Transform standalone (Mew) d'abord, ou attendre le bundle Ditto/Imposter Phase 9.
  - [ ] **Move-copy (~6)** — appelle/copie un autre move. `metronome` (random), `mimic`/`sketch`, `mirror-move`/`copycat` (dernier move), `nature-power` (selon terrain), `sleep-talk`/Ronflement (random parmi les siens, pendant sommeil — sorti de G3, plan dédié car gate sommeil). Réentrance moteur à gérer.
  - [ ] **Field global (~4)** — effet pleine arène 5t. `gravity` (ground tous + accuracy↑), `tailwind` (vitesse ×2 équipe, recompute ctGain), `wonder-room`/`magic-room` (swap Def/SpD, désactive objets). Mirror du système Trick Room.
  - [ ] **Stat/state manip (~8)** — `haze` (reset tous stages), `psych-up` (copie stages cible), `clear-smog` (dmg + reset cible), `topsy-turvy` (inverse stages), `guard-swap`/`power-swap`/`speed-swap`/`heart-swap` (échange stages), `burn-up`/`tera-blast` (change/retire type self).
  - [ ] **Phazing / forçage (~3)** — `whirlwind`/`roar` (force fin de tour / repositionne ?), `circle-throw` (knockback comme Dragon-Queue déjà fait). Sans switch, adapter sémantique grid.
  - [ ] **Sacrifice / Self-KO (~3)** — `explosion`/`misty-explosion` (self-KO + AoE, comme `self-destruct` déjà fait), `memento` (self-KO + debuff cible -2/-2), `final-gambit` (self-KO + dmg = HP).
  - [ ] **OHKO (~4)** — `fissure`/`guillotine`/`horn-drill`/`sheer-cold` (KO direct, accuracy 30 niveau-dépendant). Mécanique à part (bypass dégâts).
  - [ ] **Priorité / timing conditionnel (~3)** — `fake-out`/`first-impression` (T1 only + flinch), `sucker-punch` (échoue si cible n'attaque pas), `focus-punch`/`beak-blast`/`shell-trap` (charge + interrupt si frappé). Nécessite ordre d'intention.
  - [ ] **Lock-in multi-turn (~4)** — `thrash`/`petal-dance`/`outrage`/`raging-fury` (2-3t forcés + confusion fin), `uproar` (3t no-sleep), `rollout`/`ice-ball` (5t escalade). Verrou `getLegalActions` + compteur.
  - [ ] **Escalade multi-hit (~1)** — `triple-axel` (3 coups, BP 20/40/60 par coup, précision vérifiée par coup). Compteur interne hits réussis + BP variable par coup.
  - [ ] **Type-chart override (~1)** — `freeze-dry`/Lyophilisation (Glace, super-efficace vs Eau quelle que soit l'efficacité normale — override type-chart dans damage-calculator). Sorti de G3, plan dédié.
  - [ ] **Dégâts spé calculés sur Déf physique (~2)** — `psyshock`/`psystrike` : catégorie Spécial (AtqSpé attaquant) mais défense = Déf physique cible. Nouveau param `usePhysicalDefense` dans damage-calculator.
  - [ ] **Effet conditionnel selon état cible (~3)** — Vocemicile/`alluring-voice` (Confusion si cible boostée ce tour), Jalousie Ardente/`burning-jealousy` (Brûlure si cible boostée ce tour) → tracking `wasStatBoostedThisTurn` sur `PokemonInstance`. Venimprégne/`venom-drench` (Atq + AtqSpé -1 uniquement si cible empoisonnée) → check statut cible. *Vocemicile/Jalousie = deferred batch G2, Venimprégne = deferred batch G5.*
  - [ ] **Crash on miss (~2)** — `jump-kick`/`high-jump-kick` (dégâts self si miss/immune) + `axe-kick`/Talon-Marteau (sorti de G3, plan dédié).
  - [ ] **Buff de stat multi-allié (~2)** — Grondement/`howl` (Atq +1 lanceur + alliés adjacents, Gen 8+), Influx Magnétik/`magnetic-flux` (Déf + DéfSpé +1 alliés ayant le talent Plus ou Minus — gate ability). Étend le pattern `targetsAlly` (Coaching, single-allié déjà livré G5) à un AoE alliés. *Deferred batch G5.*
  - [ ] **Misc volatile / utility (~26)** — Malédiction/`curse` (Ghost self-KO partiel vs non-Ghost stat), Bâillement/`yawn` (sleep T+1), Puissance/`focus-energy` + Affilage/`laser-focus` (crit↑), Vol Magnétik/`magnet-rise` (lévite 5t), Par Ici/`follow-me` + Poudre Fureur/`rage-powder` (redirect ciblage — pertinent en grid ?), Après Vous/`after-you` (réordonne CT), Interversion/`ally-switch` (échange position alliés), Coup d'Main/`helping-hand` (cf. Delayed), Baston/`beat-up`, Cognobidon/`belly-drum` (-50% HP +6 Atq), Acupression/`acupressure` (+2 stat random), Faux-Chage/`false-swipe` (laisse 1 HP) + Ruse/`feint` (casse Protect), Anti-Air/`smack-down` (ground), Soucigraine/`worry-seed` + Suc Digestif/`gastro-acid` + Imitation/`role-play` + Échange/`skill-swap` (manip ability), Poursuite/`pursuit` (×2 si cible « fuit »), Attraction/`attract` (volatile infatuation), Lien du Destin/`destiny-bond`, Cri Draconique/`dragon-cheer` (crit allié), Dark Lariat/`darkest-lariat` (ignore les boosts défensifs cible), Yama Arashi/`storm-throw` (crit garanti — nouveau flag `alwaysCrit`, absent), Croc Fatal/`super-fang` (dmg = 1/2 HP cible), **Corps Perdu/`vital-throw`** (never-miss + priorité -1 « frappe en dernier » — rien de prévu côté never-miss combiné prio négative).

- [ ] **Talents & items de finition** — compléter pool transversal une fois moves livrés. Pool restant : abilities 52/114, items 23/~159 (OP sets déjà à 100% — finition = couverture exhaustive movepools Gen 1 pour Team Builder libre).

---

## Phase 5 — Migration renderer 2D-HD (Babylon.js)

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

## Phase 6 — Maps & Éditeur (3D)

> **Position actuelle : après Phase 3.5** (reordonnée 2026-04-20, donc post-Phase 7).
>
> But : contenu varié, roster de maps équilibré, outils de création.

Tie à Babylon : éditeur et props terrain repensés pour renderer 3D.

> **Note 2026-04-20** : *Choix maps UI*, *Roster maps variées* et *génération IA* remontés en Phase 3 — ne dépendent pas de Babylon. Seul l'éditeur in-game reste ici.

- [ ] Éditeur de terrain in-game (placement tiles, hauteurs, spawns, décorations)

---

## Phase 8 — Équilibrage

> But : outils pour tester et équilibrer avant d'ouvrir le multi

- [ ] Mode headless + outils d'équilibrage — **prérequis** : déplacer `.tmj` dans `packages/data/src/maps/tiled/` et ajouter `loadMapDefinition(id)` Node-compatible. Aujourd'hui maps dans `packages/renderer/public/` chargées via `fetch()` HTTP — inutilisable sans browser.
- [ ] LLM vs LLM (Claude adversaire) (risque d'être cher maintenant)
- [ ] AI vs IA (+nouveau de difficultés) + reporting équilibrage
- [ ] Passes d'équilibrage

---

## Phase 7 — Multijoueur

> But : jouer contre de vrais adversaires

- [ ] Multijoueur réseau (WebSocket)
- [ ] Écran de victoire enrichi (récap, tours, KO, MVP)
- [ ] Speed controls (skip/accélérer animations)
- [ ] Tutoriel interactif
- [ ] Support manette

---

## Phase 9 — Polish

> But : confort et qualité visuelle

- [ ] UI revamps
- [x] **CSS modulaire Team Builder + `<dialog>` natif + HTML a11y** — livré plan 085 polish 2026-05-18. `packages/renderer/src/styles/` 12 modules (@layer, tokens, `<dialog showModal()>` natif, slot cards `<button>`, aria-label i18n, lazy loading, bugfix `@layer reset`). Rules `.claude/rules/css.md` + `.claude/rules/html.md`. Décisions #321-325.
- [ ] **Biome HTML/CSS lint** — Biome v2.4 gère HTML formatter + CSS formatter. Étendre `biome.json` : `files.includes` += `**/*.{css,html}`, activer `linter.rules.a11y.recommended: true`. Optionnel : audit Axe + Lighthouse. Optionnel : `stylelint-plugin-use-baseline`.
- [ ] Son / Musique
- [ ] Décors sur les maps
- [ ] Tooltips type chart (efficacités au hover)
- [ ] Auto-save localStorage

---

## Phase X — Social & Partage

> But : features qui donnent envie de partager et revenir

- [ ] Share replay via URL + lecteur de replay
- [ ] Défi du jour (seed quotidienne, même combat pour tous)
- [ ] Screenshot de fin de combat partageable

---

## Phase X — Futur / À voir

- [ ] **Générations 2-9** — ajout des 874 Pokemon restants (Gen 2 : 100, Gen 3 : 135, Gen 4 : 107, Gen 5 : 156, Gen 6 : 72, Gen 7 : 88, Gen 8 : 96, Gen 9 : 120). Sprites PMDCollab disponibles pour la majorité. Nécessite pipeline `sprite-config.json` étendu + movesets tactiques par Pokemon.
- [ ] **Méga-Évolutions** — 21 formes Méga Gen 1 (16 officielles + 5 exclusives Pokémon Champions). Sprites PMDCollab : 6 formes ont des fichiers partiels (pending review), aucune complète en mai 2026. À replanifier quand PMDCollab coverage s'améliore. Voir `docs/implementations.md#méga-évolutions-gen-1`.
- [ ] Mode histoire / aventure
- [ ] Conditions de victoire alternatives
- [ ] Draft/ban phase
- [ ] Effets visuels (particules, ombres, lumières, attaques)
- [ ] **Modification dynamique du terrain par attaques** — certaines attaques transforment terrain pendant combat (Feu → supprime tall grass, Ébullition crée tiles lave/magma, Force déplace rochers, Glace gèle tiles eau). Mutation runtime `TerrainType` + décoration associée. Reporté Phase 3 en 2026-04-20 : scope trop lourd tant que roster attaques et palette terrains pas figés.
- [x] **Météo (Soleil, Pluie, Tempête de Sable, Neige) — plans 084 + 084b terminés 2026-05-13.** Livré en Phase 4 (débloqué par roster Gen 1 complet + OP sets). Sand-veil, swift-swim, chlorophyll activés. Synthèse contextuelle. Solar-Beam 2-turn. Heat-Rock 8 tours. Cloud Nine supprime effets.
- [ ] **Champs (Herbeux, Psy, Électrique, Brumeux, Distorsion)** — modificateurs terrain affectant dégâts, statuts et capacités.
- [ ] **Modèles 3D pour les Pokemon** — remplacer sprites billboards 2D par modèles 3D (glTF/GLB) style Pokemon Champions / Stadium. À évaluer après stabilisation renderer Babylon.
