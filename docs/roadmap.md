# Roadmap — Pokemon Tactics

> Phases de développement du POC au jeu complet.
> Limite de roster : 151 premiers Pokemon (Gen 1) — décision #92.

---

## Phase 0 — Prototype technique (POC) ✅ *Terminé*

> But : valider la stack et avoir un combat jouable minimaliste

### Core
- [x] Setup monorepo (pnpm workspaces, tsconfig, Vite, Vitest, Biome)
- [x] Modèles de base (Pokemon, Move, Grid, BattleState)
- [x] Grille plate (pas de dénivelé), placement de 2 Pokemon
- [x] Système de tour simple (round-robin par Vitesse)
- [x] Déplacement (pathfinding BFS sur grille)
- [x] Attaque single target + calcul de dégâts (formule Gen 5+, STAB, types)
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

> But : un combat complet et varié, jouable en hot-seat, avec assez de Pokemon pour tester toutes les mécaniques

### Ce qui est posé (fondations Phase 0)
Formule de dégâts, type chart, 9 targeting patterns, 5 statuts majeurs, friendly fire, Move+Act, stat stages (-6/+6), hot-seat basique, 12 Pokemon avec 48 moves, format 6v6, phase de placement interactive.

### Core
- [x] KO définitif : corps reste sur la tile, traversable mais non-stoppable (plan 011)
- [x] Placement initial configurable : `MapDefinition`, `PlacementPhase`, alternance serpent, mode random (plan 013 — implémenté, non commité)
- [x] Direction de fin de tour (orientation choisie avant EndTurn)
- [x] Nouveaux patterns core : `slash` (arc frontal 3 cases) et `blast` (projectile + explosion circulaire) — voir `docs/reflexion-patterns-attaques.md` et décisions #108-109
- [x] Mettre à jour `tactical.ts` avec les 7 changements de pattern effectifs (décision #110) — Ball'Ombre absente du roster actuel
- [x] **Mode Sandbox** : 1 Pokemon joueur vs 1 Dummy configurable sur micro-carte 6x6, 2 panels séparés (Joueur/Dummy), toolbar Réinitialiser + Exporter JSON, accès via `pnpm dev:sandbox [config.json|json]`, Dummy avec preset Pokemon ou custom stats (décisions #138-139) — plan 023 + post-plan + plan 035
- [x] 8 moves défensifs : Abri, Détection, Garde Large, Prévention, Riposte, Voile Miroir, Fulmifer, Ténacité (décisions #141-146) + tests d'intégration scénario Gherkin (décision #140) — plan 023
- [x] Plus de moves stat changes : Épée Danse (+2 Atk), Mur de Fer (+2 Def), Rugissement (-1 Atk cone), Hurlement (-1 Atk cone), Flash (-1 Accuracy zone r2) — plan 026
- [x] Plus de moves AoE variés : Séisme (zone r2), Acide (cone + SpDef debuff), Tranche (slash), Draco-Queue (slash + knockback) — plan 026
- [x] Plus de moves avec portées variées : Ultimapoing (mêlée), Dard-Venin (mêlée + poison), Ultralaser (ligne 5 + recharge), Double Pied (multi-hit x2), Combo-Griffe (multi-hit 2-5) — plan 026
- [x] Statuts volatils : confusion tactique (redirection allié, direction aléatoire, tour perdu si pas d'allié) — plan 026
- [x] Poison grave : dégâts croissants via toxicCounter (1/16 à 15/16 HP) — plan 026
- [x] Plusieurs Pokemon par équipe : format 6v6 implémenté (plan 013)
- [x] Tests d'intégration par move : 73 fichiers moves + 14 fichiers mécaniques, helper `buildMoveTestEngine`, **595 tests** (plans 025+026)
- [x] Roster élargi (~20 Pokemon) — **20 Pokemon jouables** (+1 Dummy) avec 72 moves, sprites PMDCollab, tests d'intégration par move (plan 027)
- [x] Stats niveau 50 : fonction `computeStatAtLevel` pour calculer HP et stats réelles au niveau 50 (plan 015)
- [x] Système de replay (log d'actions déterministe, seed + rejeu)

### Renderer
- [x] Placement initial visuel : phase de placement interactive, panel roster, zones de spawn highlight (plan 013 — implémenté, non commité)
- [x] Choix de direction en fin de tour
- [x] Corps KO visible sur la grille (sprite Faint persistant, alpha réduit)
- [x] Stat change indicators (flèches ↑↓ colorées) dans l'info panel
- [x] Status icons (pastilles colorées) dans la turn timeline
- [x] Afficher le niveau dans l'UI (`Lv.50` dans l'InfoPanel)
- [x] Info détaillées des attaques dans le sous-menu (catégorie icon SV + nom + PP courants/max) + tooltip hover (catégorie, puissance, précision, nom pattern FR + portée conditionnelle, grille dynamique) — plan 016
- [x] Refonte panel info stats : badges colorés Showdown (bleu buff / rouge debuff) pour les stat changes (plan 018)
- [x] Feedback visuel des statuts sur les sprites (icônes ZA sur sprites + timeline, miniature ZA dans InfoPanel, animation Sleep PMD) (plan 018)
- [x] Prévisualisation AoE dynamique sur la grille : preview hover, flow 2 étapes FFTA (verrouillage + clignotement + confirmation), `confirmAttack` configurable, couleurs rouge/bleu selon effets, outline périmétrique pour la portée (plan 017)
- [x] Preview dégâts estimés dans `confirm_attack` : random roll x0.85–1.00, `estimateDamage()` core, zone dégradée HP bar + texte flottant min–max, "Immune" pour les immunités, AoE multi-cibles (plan 019)
- [x] Canvas responsive FIT (Phaser.Scale.FIT, CSS 100vw/100vh) — plan 020
- [x] Zoom 3 niveaux discrets (close-up 2.0x / medium 1.3x / overview 0.85x), molette + touches +/- — plan 020
- [x] Pan caméra aux bords de l'écran (50px threshold, 6px/frame) + suivi automatique du Pokemon actif (camera.pan fluide) — plan 020
- [x] Sprite offsets corrects via Shadow.png PMDCollab + ombres ellipse sous sprites — plan 021
- [x] Refonte turn order (timeline) — plan 022

---

## Phase 2 — Démo jouable ✅ *Terminé*

> But : un lien partageable où quelqu'un peut jouer seul contre l'IA et s'amuser

- [x] i18n FR/EN (détection auto navigateur, persistance localStorage, bouton bascule) — plan 030
- [x] Menu principal + Settings (langue, damage preview on/off) — plan 036 (MainMenuScene, BattleModeScene, SettingsScene, CreditsScene, GameSettings localStorage, i18n ~20 clés)
- [x] Feedbacks visuels des mécaniques (confusion, vampigraine, bind, knockback, etc.) — plan 031 (BattleText, knockback slide, confusion wobble, icônes Seeded/Trapped)
- [x] Refactor core : Vampigraine et Piège en statuts volatils (remplace ActiveLink) — plan 031
- [x] Indicateur visuel de miss (attaque ratée) — texte flottant "Miss" via BattleText (plan 031)
- [x] Animations fluides (attaque par catégorie Contact/Shoot/Charge, direction dynamique pendant déplacement et avant attaque, pipeline sprites Shoot/Charge/Hop) — plan 039
- [x] IA jouable avec personnalité (plan 029 — AiDifficulty easy/medium/hard, action-scorer, scored-ai, AiTeamController, smoke test 6v6)
- [x] IA améliorée : lookahead move+attack (évaluer les attaques possibles après déplacement)
- [x] Battle log (afficher les moves utilisés par l'IA et les joueurs) — panel haut droite, i18n FR/EN, couleurs par type de message, noms cliquables, pliable, scroll auto (plan 037)
- [x] Afficher la portée de déplacement des ennemis au hover (overlay orange, layer dédié `enemyRangeGraphics`) — plan 038
- [x] Revoir l'algo de portée de déplacement (tous les Pokemon semblent avoir la même portée) — plan 032
- [x] Sélection d'équipe (grille portraits 82px colorés par équipe, bouton Auto re-randomize/Vider, toggle Humain/IA, toggle placement auto/manuel, validation core validateTeamSelection(), support IA vs IA, bypass sandbox, noms Pokemon i18n, bouton Retour au menu en victoire) — plan 033
- [x] Hot-seat 1v1 + multi-équipes (2 à 12 joueurs, IA ou humain par équipe, carte 12x20, 12 couleurs d'équipe) — plan 040
- [x] Repo public (README EN, LICENSE MIT, issue templates, wiki joueur, CI GitHub Actions) — hors plan
- [x] Publication (GitHub Pages, release v2026.4.1, CalVer) — hors plan

---

## Phase 3 — Terrain & Tactics

> But : la vraie profondeur tactique — le terrain change la façon de jouer

- [x] Tileset isométrique (ICON Isometric Pack / Jao — tiles 32×32 ×2, filtre NEAREST, marquages arène overlay) — plan 043
- [x] Supprimer POKEMON_SPRITE_SCALE=2 + TILE_SPRITE_SCALE=2, rattraper offsets, ajuster zoom — uniformiser la résolution pixel (plan 044)
- [x] Mode pixel art Phaser (roundPixels:true, NEAREST manuel par texture, police adaptée) — plan 044
- [x] Format de carte compatible Tiled + pipeline de chargement (parseTiledMap, validateTiledMap, loadTiledMap, MapPreviewScene, test-arena.tmj — plan 045)
- [x] Dénivelés (hauteur tiles) + dégâts de chute (plan 046 — canTraverse, getHeightModifier, isMeleeBlockedByHeight, calculateFallDamage, renderer surélevé, highlands.tmj, 45 tests)
- [x] Tileset custom PMD-based (remplacer les tiles JAO) — plan 050 (11 solides + 4 liquides, pipeline Python, 24 maps migrées vers tileset.tsj externe, dead code renderer nettoyé — validation visuelle humaine en cours)
- [x] Obstacles + line of sight (trajectoires de tir visibles) — plan 047
- [x] Types de terrain (lave, eau, herbe) + modificateurs — plan 051 terminé (core + tests + maps sandbox + renderer tint). Tooltip InfoPanel déplacé au backlog.
- [ ] Interactions type/terrain + modification terrain par attaques
- [x] Orientation tactique (bonus dos/face FFTA) — plan 052 (face -15%, flanc neutre, dos +15% sur les dégâts, preview "(+15%)" / "(-15%)", 28 tests)
- [x] Système CT (remplacement round-robin) — plan 054 terminé. Interface `TurnSystem`, `ChargeTimeTurnSystem`, `ct-costs`, dual-mode BattleEngine, TurnTimeline CT, ActionMenu CT, toggle TeamSelectScene, i18n, 999 tests. Décisions #254-256.
- [x] Toggle CT/Round-Robin dans `TeamSelectScene` (bouton "Tours fixes" / "Charge Time", i18n FR/EN) — plan 054
- [x] **[UX CT]** Timeline CT prédictive scrollable style FFX — 24 slots simulés par le core, slot 0 ancré (acteur courant), 11 slots scrollables à la molette, bordure teal-vert sur le Pokemon actif au `confirm_attack`, entrée tail "..." si hors des 24 slots. Remplace les ghost entries du plan 058. — plan 058 + plan 059
- [x] Undo déplacement (annulable tant qu'on n'a pas attaqué) — plan 053 (action `undo_move`, bouton "Annuler déplacement" en menu, annulation brûlure magma, 8 tests)
- [x] Curseur FFTA — variantes de curseur (settings + touche H), depth bugfix curseur (500 global) — plan 060 Section A
- [ ] ~~Silhouette X-ray occlusion~~ — **SKIPPÉE** (résolue nativement par le renderer Babylon Phase 3.5, décision humain 2026-04-18)
- [x] Système de décorations Tiled — tileset `decorations.tsj` dédié, Ghost traverse obstacles, parser objectgroup, sprites PixelLab (herbe haute, rochers, arbre), `DecorationsLayer` renderer — plan 064. Bonus différé : marquages arène + pokéball centrale.
- [ ] **[PROCHAIN] Occlusion dynamique par sprite — fade adaptatif des tiles/décos qui masquent un Pokemon.** Plan 065 (à rédiger). Détection par frame/event : pour chaque déco et tile surélevée, si un Pokemon est "derrière" (screen-space overlap + depth sort devant), abaisser son alpha (≈0.4). Per-sprite, pas de toggle global — réutilise `setAlpha()`. Pattern "fading foliage" (StarCraft/Diablo/Transistor). Couvre aussi les tiles `height > 0` qui masquaient les Pokemon (bug iso 2D historique, tenté en silhouette plan 061 et abandonné). **Si le résultat est convaincant, Phase 3.5 rewrite Babylon peut être repoussée** — la rotation caméra reste un want futur mais plus un prérequis bloquant.
- [ ] Interactions type/terrain + modification terrain par attaques

### Décisions prises — Format de carte (plan 045)

- **Tiled comme éditeur principal** de maps. Le core ne connaît pas Tiled — il ne voit que `MapDefinition`.
- **Parser dans `packages/data`** (`packages/data/src/tiled/`) : convertit .tmj → `MapDefinition` au chargement runtime. Zéro dépendance Phaser.
- **Layers** : `terrain` (tilelayer, GID→TileState via propriétés custom), `decorations` (ignoré par le core), `spawns` (objectgroup, teamIndex + formatTeamCount).
- **Propriétés custom** par tile : `terrain` (string → TerrainType), `height` (int). `isPassable` supprimé — le terrain détermine la passabilité.
- **Chargement dynamique** : `loadTiledMap(url)` fait un fetch runtime + parse + validate. Pas de conversion build-time.
- **Tilesets externes .tsj supportés** en plus des tilesets embarqués.

---

> **Note ordre — Phase 3.5 et Phase 3.6 déplacées après Phase 7** (2026-04-20). Les noms restent `3.5` et `3.6` pour préserver les refs historiques (décisions, plans), mais leur **position dans la séquence de livraison** est désormais post-Phase 7. Raison : si le plan 065 (fade per-sprite) résout l'occlusion en iso 2D, le rewrite Babylon n'est plus urgent et on priorise gameplay/core/multi avant. Voir les sections Phase 3.5 et 3.6 plus bas (après Phase 7).

---

## Phase 4 — Gameplay Pokemon complet

> But : couvrir les mécaniques Pokemon qui donnent de la profondeur stratégique

- [ ] Talents (capacités passives)
- [ ] Objets tenus
- [ ] Natures (boost +10% / malus -10% sur une stat) — renommé "Stat Alignment" dans Pokemon Champions, à discuter
- [ ] EV / IV — simplification Pokemon Champions :
  - **IV supprimés** : tous les Pokemon ont 31 IVs fixes (pas de randomisation à la capture)
  - **EV → Stat Points (SP)** : 66 points max à distribuer, 32 max par stat, 1 SP = +1 point de stat directement (au lieu du système 4 EV = +1 stat)
- [ ] Méga-évolutions
- [ ] Roster élargi (~30-40 Pokemon) + attaques
- [ ] Team Builder (import/export Showdown)

---

## Phase 5 — Équilibrage

> But : des outils pour tester et équilibrer avant d'ouvrir le multi

- [ ] IA LLM (Claude adversaire)
- [ ] Mode headless + outils d'équilibrage
- [ ] Passes d'équilibrage

---

## Phase 6 — Social & Partage

> But : les features qui donnent envie de partager et revenir

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

> **Position actuelle : après Phase 7** (reordonnée 2026-04-20). Numéro conservé pour les refs historiques.
>
> But : remplacer le renderer Phaser 4 isométrique par un renderer Babylon.js 2D-HD (sprites billboards sur terrain 3D extrudé, style Tactics Ogre PSP / Triangle Strategy / FFTIC).

### Contexte

Pivot décidé le 2026-04-17 (décisions #263-266). Spike plan 062 (Three.js) validé 4/4. Spike plan 063 (Babylon.js) terminé le 2026-04-18 → **Babylon.js retenu** (décision #269). Report post-Phase 7 décidé le 2026-04-20 : le plan 065 (fade per-sprite) résout l'occlusion en iso 2D, la rotation caméra reste un want non-bloquant → on priorise gameplay/équilibrage/multi avant le rewrite renderer.

Prérequis :
- Phases 3 → 7 livrées. Les features renderer sont implémentées en Phaser puis reportées sur Babylon.
- Plan 065 (occlusion fade) livré — sinon ce rewrite redevient prioritaire.
- Occlusion plan 060 silhouette **skippée** (résolue par plan 065 en iso, ou nativement par le depth buffer 3D).

### À décider en début de phase

- [ ] **Découpage en plans** : 1 plan monolithique vs 4 plans incrémentaux (core / UI / features Phase 3 / perfs). Numéros attribués au moment de la rédaction. Voir pistes dans `docs/next.md`.
- [ ] **Tiled : on garde ou pas ?** Dépend du workflow de maps côté renderer 3D. Option A : garder Tiled, `loadTiledMap` transforme en `MapDefinition` (pipeline déjà validée plan 062/063). Option B : format de map custom orienté 3D (volumes, rotations, props). Option C : éditeur custom in-game (item Phase 3.6 « Éditeur de terrain / génération IA »).
- [ ] **UI stack** : `@babylonjs/gui` natif (WYSIWYG GUI Editor, intégré au moteur) vs HTML/CSS overlay au-dessus du canvas (CSS standard, accessible). Mesurer les deux sur un panel représentatif avant de trancher.

### Items techniques (à ventiler dans les plans une fois le découpage décidé)

- [ ] Port du core renderer : terrain extrudé, sprites directional billboards (atlas PMDCollab), caméra orthographique dimetric, curseur FFTA, occlusion native.
- [ ] Parité feature avec le renderer Phaser actuel sur une map de référence (combat complet jouable).
- [ ] Port UI : timeline CT, ActionMenu, sous-menu attaque, InfoPanel, battle log, écrans menu/sélection/victoire.
- [ ] Features Phase 3 repensées pour la 3D : décorations (herbes hautes billboards), rotation caméra 4 angles (remonte de Phase 8).
- [ ] Bundle & perfs : audit `rollup-plugin-visualizer`, flat-shaded `ShaderMaterial` custom (cohérence pixel-art FFTA), Inspector shim type (tester `skipLibCheck: false`), cible 180-220 kB gzip initial (vs 273 kB spike).
- [ ] Régler les gotchas spike (voir `docs/references/babylon-gotchas.md`) : `GridMaterial.gridOffset`, UV `invertY`, `renderingGroupId`, `alphaCutOff`/`transparencyMode`, deep imports.

### Gates

- Chaque plan sort un renderer fonctionnel sur `main` (pas de branche longue).
- Parité feature = critère de succès avant de retirer le renderer Phaser.
- Activation de `.claude/rules/renderer-babylon.md` dès le premier plan.

---

## Phase 3.6 — Maps & Éditeur

> **Position actuelle : après Phase 3.5** (reordonnée 2026-04-20, donc post-Phase 7). Numéro conservé pour les refs historiques.
>
> But : donner du contenu varié à jouer. Choix de maps, roster de maps équilibré, et outils pour en créer (à la main ou via IA).

Tie à Babylon : l'éditeur et les props terrain seront repensés pour le renderer 3D, donc cette phase suit la 3.5.

- [ ] Choix de maps depuis l'UI (écran de sélection, preview, metadata)
- [ ] Roster de maps variées (dénivelés, types de terrain, décors, tailles)
- [ ] Éditeur de terrain in-game (placement tiles, hauteurs, spawns, décorations)
- [ ] Génération de maps par IA (prompt → `MapDefinition` valide, review humain avant intégration)

---

## Phase 8 — Polish

> But : le confort et la qualité visuelle

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

- [ ] Mode histoire / aventure
- [ ] Conditions de victoire alternatives
- [ ] Draft/ban phase
- [ ] **Modèles 3D pour les Pokemon (à voir)** — remplacer les sprites billboards 2D par des modèles 3D (glTF/GLB) style Pokemon Champions / Stadium. À évaluer après stabilisation du renderer Babylon : coût pipeline (sourcing/licence modèles), impact bundle, cohérence stylistique avec terrain pixel-art, animations (rig existant vs recréer).
