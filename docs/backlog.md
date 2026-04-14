# Backlog — Bugs et Feedback

Centralise les bugs connus et les retours de playtest non encore traités.

## Bugs

### Flanc différent sur flip pente/escalier (raccord visible)
- Les variantes E de pente et escalier sont obtenues au rendu via `sprite.setFlipX(true)` (cf. `decodeTiledGid` + `IsometricGrid.drawGridFromTileData`).
- Problème : le flip horizontal inverse aussi la répartition d'ombrage sur les flancs. La convention de rendu dans `scripts/make-iso-tile.py` (LEFT_BRIGHTNESS=0.75, RIGHT_BRIGHTNESS=0.55) suppose un éclairage depuis le sud-est. Quand la tile est flipée, la face lumineuse se retrouve du "mauvais" côté → raccord visible avec les tiles non-flipées adjacentes.
- Options :
  - Dessiner des variantes E explicites dans le tileset (4 tiles au lieu de 2 par orientation, pas de flip).
  - Uniformiser l'ombrage des flancs gauche/droit (même brightness) — plus simple mais plus plat visuellement.

### Textes flottants superposés (multi-hit, DOT simultanés)
- Quand plusieurs `showBattleText` sont appelés au même moment pour le même Pokemon (ex: Double-Pied 2 coups, ou burn tick + magma DOT), les textes s'affichent à la même position Y et se chevauchent.
- `BATTLE_TEXT_STAGGER_Y` (-10) existe dans les constantes mais n'est pas utilisé automatiquement.
- Fix : compteur par Pokemon pour décaler les textes successifs en Y, ou file d'attente avec délai.

### Afficher les modificateurs terrain actifs dans l'InfoPanel
- Quand on retravaille l'InfoPanel, afficher les effets terrain en cours sur la tile du Pokemon sélectionné/survolé (ex: "Évasion +1 (herbe haute)", "Brûlure au passage (magma)", "Malus déplacement +2 (marécage)").
- Lié à l'étape 22 du plan 051 (terrain dans tooltip).

## Feedback visuel

### Transparence / silhouette des Pokemon derrière un obstacle + cursor FFTA
- Quand un Pokemon passe derrière une tile haute ou une décoration, il disparaît complètement.
- Idée : afficher le sprite en transparence ou en contour de couleur (effet **silhouette X-ray** / "occlusion outline", courant dans les jeux iso).
- Impl possible : détecter côté renderer si un sprite est occlu par une tile de depth supérieure, appliquer `sprite.setAlpha(0.4)` + un outline avec shader/PostFX Phaser, ou basculer sur une version silhouette du sprite.
- **Lié au cursor FFTA** : le curseur de sélection doit être revu dans le style FFTA (au-dessus des sprites Pokemon). Cette tâche partage probablement la détection d'occlusion avec l'effet de transparence — à traiter dans le même plan renderer.
- **Note** : le bug "Pokemon passe devant les piliers pendant le déplacement" (suppression du `maxTileDepthInRadius` dans `animateMoveTo`) n'est pas résolu par le layering de depths — c'est un comportement iso correct (Pokemon derrière un pilier plus proche de la caméra). La solution passe par la transparence/silhouette ci-dessus.

## Tâches futures identifiées (hors backlog actif)

### Portée dynamique selon la hauteur (dénivelé)
- Idée : un attaquant en hauteur voit plus loin et peut tirer plus loin. Bonus de portée +N cases selon la différence de hauteur caster - cible (par ex : +1 case par niveau au-dessus, cap +2).
- Pour l'instant, le plan 046/047 n'ajoute que le modificateur de **dégâts** (`getHeightModifier`, ±10%/niveau, cap +50%/-30%). Aucun bonus de portée.
- À planifier : décider de la formule (flat +N, multiplicatif, avec cap), adapter `getValidTargetPositions` dans BattleEngine pour calculer une portée effective par caster, affecter la preview renderer.

### Système de décorations Tiled
- Créer `decorations.tsj` + `decorations.png` — tileset dédié, pipeline séparée du terrain
- Marquages d'arène : lignes (~12 tiles : segments, coins, T, croisement) + pokeball centrale (~6-8 tiles)
- Décos environnement : herbe haute overlay, arbres, rochers (sources PMD)
- Remplir layer `decorations` de `test-arena.tmj` + maps futures

### Animations de vol + trajectoire des Flying Pokemon
- Actuellement aucun sprite du roster n'a les animations `FlapAround` / `Hover` / `Special10`. Le fallback (`FLYING_JUMP_ANIMATION_CANDIDATES` dans `packages/renderer/src/game/movement-animation.ts`) retombe sur `Hop` / `Walk`, et `animateMoveTo` utilise un tween diagonal avec easing asymétrique sur Y — ça marche parce que le Hop sprite anim fournit déjà le lift vertical visuel.
- **Quand on intégrera de vraies animations de vol** (via PMDCollab ou pack custom) :
  - Ces animations n'ont probablement pas de lift vertical intégré (le pokemon est en vol stationnaire dans ses frames, il n'a pas besoin de "sauter" visuellement).
  - Il faudra sans doute réintroduire la trajectoire 2-phase pour les Flying uniquement : rise-in-place puis walk horizontal à target height pour les montées, walk horizontal à source height puis drop straight pour les descentes. Le code de la version précédente est dans l'historique git (branche main, avant ce commit).
  - Ou mieux : une vraie trajectoire en arc parabolique qui fait monter/descendre le container plus nettement, puisque le sprite ne compense plus avec ses frames.
  - Les constantes à ajuster : `JUMP_TWEEN_DURATION_MS` peut rester, mais les Flying pourraient avoir leur propre durée + courbe (ex: `Sine.easeInOut`).
- À traiter en même temps que l'ajout des assets flying.


## Résolus

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
