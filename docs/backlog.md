# Backlog — Bugs et Feedback

Centralise les bugs connus et les retours de playtest non encore traités.

## Bugs

*(rien d'ouvert)*

## Feedback visuel

*(rien d'ouvert)*

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

### Tileset custom pour remplacer les tiles JAO
- Les tiles ICON Isometric Pack (Jao) sont libres mais limitées — un tileset custom permettrait d'améliorer la lisibilité tactique
- À planifier après implémentation du rendu des dénivelés (height rendering)
- **Extraire le tileset dans un fichier `.tsj` externe** (tileset Tiled séparé) avec les propriétés `height`, `terrain`, `slope` définies une seule fois. Actuellement chaque map embarque 76 tile definitions redondantes. Le parser supporte déjà les tilesets externes via `resolveExternalTilesets` dans `load-tiled-map.ts`.

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
