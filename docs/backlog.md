# Backlog — Bugs et Feedback

Centralise les bugs connus et les retours de playtest non encore traités.

## Bugs

### Profondeur du sélecteur/highlight vs sprites Pokemon
- Le curseur de sélection et les zones de highlight (move, attack, enemy range) passent **par-dessus** les sprites Pokemon au lieu de passer derrière quand le Pokemon est plus proche de la caméra (iso depth plus grande).
- Probable : les `Graphics` de highlight utilisent une depth fixe (`DEPTH_GRID_HIGHLIGHT`, `DEPTH_GRID_CURSOR`, `DEPTH_GRID_ENEMY_RANGE` dans `constants.ts`) alors qu'il faudrait qu'elle soit interpolée par tile (comme les sprites de terrain).
- Cf. `packages/renderer/src/grid/IsometricGrid.ts` (highlights en Graphics plein écran).
- À corriger : soit une depth par tile highlightée, soit dessiner les highlights **sous** les sprites et ajouter un overlay de contour par-dessus.

### Flanc différent sur flip pente/escalier (raccord visible)
- Les variantes E de pente et escalier sont obtenues au rendu via `sprite.setFlipX(true)` (cf. `decodeTiledGid` + `IsometricGrid.drawGridFromTileData`).
- Problème : le flip horizontal inverse aussi la répartition d'ombrage sur les flancs. La convention de rendu dans `scripts/make-iso-tile.py` (LEFT_BRIGHTNESS=0.75, RIGHT_BRIGHTNESS=0.55) suppose un éclairage depuis le sud-est. Quand la tile est flipée, la face lumineuse se retrouve du "mauvais" côté → raccord visible avec les tiles non-flipées adjacentes.
- Options :
  - Dessiner des variantes E explicites dans le tileset (4 tiles au lieu de 2 par orientation, pas de flip).
  - Uniformiser l'ombrage des flancs gauche/droit (même brightness) — plus simple mais plus plat visuellement.

## Feedback visuel

### Transparence / silhouette des Pokemon derrière un obstacle
- Quand un Pokemon passe derrière une tile haute ou une décoration, il disparaît complètement.
- Idée : afficher le sprite en transparence ou en contour de couleur (effet **silhouette X-ray** / "occlusion outline", courant dans les jeux iso).
- Impl possible : détecter côté renderer si un sprite est occlu par une tile de depth supérieure, appliquer `sprite.setAlpha(0.4)` + un outline avec shader/PostFX Phaser, ou basculer sur une version silhouette du sprite.
- À planifier comme tâche renderer dédiée (après le fix de depth highlights ci-dessus, probablement partagera la détection d'occlusion).

## Tâches futures identifiées (hors backlog actif)

### Portée dynamique selon la hauteur (dénivelé)
- Idée : un attaquant en hauteur voit plus loin et peut tirer plus loin. Bonus de portée +N cases selon la différence de hauteur caster - cible (par ex : +1 case par niveau au-dessus, cap +2).
- Pour l'instant, le plan 046/047 n'ajoute que le modificateur de **dégâts** (`getHeightModifier`, ±10%/niveau, cap +50%/-30%). Aucun bonus de portée.
- À planifier : décider de la formule (flat +N, multiplicatif, avec cap), adapter `getValidTargetPositions` dans BattleEngine pour calculer une portée effective par caster, affecter la preview renderer.

### Marquages d'arène → tiles Tiled
- Les overlay Graphics (pokeball centrale, lignes latérales) devraient être des tiles Tiled dans le layer `decorations`, pas des Graphics Phaser dessinés au runtime
- À traiter dans un plan dédié (après tileset custom)

### Animations de vol + trajectoire des Flying Pokemon
- Actuellement aucun sprite du roster n'a les animations `FlapAround` / `Hover` / `Special10`. Le fallback (`FLYING_JUMP_ANIMATION_CANDIDATES` dans `packages/renderer/src/game/movement-animation.ts`) retombe sur `Hop` / `Walk`, et `animateMoveTo` utilise un tween diagonal avec easing asymétrique sur Y — ça marche parce que le Hop sprite anim fournit déjà le lift vertical visuel.
- **Quand on intégrera de vraies animations de vol** (via PMDCollab ou pack custom) :
  - Ces animations n'ont probablement pas de lift vertical intégré (le pokemon est en vol stationnaire dans ses frames, il n'a pas besoin de "sauter" visuellement).
  - Il faudra sans doute réintroduire la trajectoire 2-phase pour les Flying uniquement : rise-in-place puis walk horizontal à target height pour les montées, walk horizontal à source height puis drop straight pour les descentes. Le code de la version précédente est dans l'historique git (branche main, avant ce commit).
  - Ou mieux : une vraie trajectoire en arc parabolique qui fait monter/descendre le container plus nettement, puisque le sprite ne compense plus avec ses frames.
  - Les constantes à ajuster : `JUMP_TWEEN_DURATION_MS` peut rester, mais les Flying pourraient avoir leur propre durée + courbe (ex: `Sine.easeInOut`).
- À traiter en même temps que l'ajout des assets flying.


## Résolus

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
