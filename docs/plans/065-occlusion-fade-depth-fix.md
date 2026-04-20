---
status: in_progress
created: 2026-04-20
updated: 2026-04-20
---

# Plan 065 — Fix depth unifié + picking modifier + occlusion dynamique par fade per-sprite

> Objectif long terme : **rendre la 2D iso viable pour un jeu complet** — suppression du bug Pokemon-par-dessus-pilier + disambiguation picking sur piliers + fading foliage pattern. Si ce plan réussit visuellement, Phase 3.5 (rewrite Babylon) est repoussée après Phase 7 (décision #272).

## Objectif

Rendre lisible l'occlusion Pokemon ↔ environnement sur carte iso 2D, en trois parties séquentielles :

**Partie A — Fix depth unifié** : supprimer le bug structurel « Pokemon affiché devant les tiles surélevées peu importe sa position en grid ». Cause : les tiles de terrain sont à `depth = 0 + (x+y)*K + elevation` (range 0-205) alors que les Pokemon sont à `depth = 520 + (x+y)*K + h` (range 520+). Un Pokemon à gridY=3 devant un pilier à gridY=10 est correctement trié ; un Pokemon à gridY=10 **derrière** le pilier est quand même affiché devant.

**Partie B — Picking disambiguation (Alt-click modifier)** : résoudre l'ambiguïté de sélection sur piliers multi-niveaux. Actuellement `screenToGridWithHeight` (iso-math.ts) applique « greatest depth wins » quand un pixel tombe dans plusieurs diamonds — le haut d'un pilier gagne toujours sur la tile derrière dont le diamond chevauche pixel-parfait. Solution : tenir **Alt** pendant le survol/clic pour préférer la tile de depth **inférieure** (la tile « dessous / derrière »).

**Partie C — Fade dynamique per-sprite** : une fois la Partie A livrée, les tiles surélevées et décos masquent légitimement les Pokemon derrière elles. Pattern « fading foliage » (StarCraft / Diablo / Transistor) — chaque obstacle passe à `alpha = 0.4` quand un Pokemon est derrière lui.

## Contexte

### Code state 2026-04-20

- `packages/renderer/src/grid/IsometricGrid.ts:142` — chaque tile est un `Phaser.GameObjects.Image` individuel stocké dans `this.tileSprites`. `setAlpha()` per-tile = trivial (pas de `TilemapLayer`).
- `packages/renderer/src/grid/IsometricGrid.ts:147` — depth tile : `DEPTH_GRID_TILES(0) + (x+y) * DEPTH_TILE_MAX_ELEVATION(5) + layer.elevation`.
- `packages/renderer/src/sprites/PokemonSprite.ts:152` — depth Pokemon : `DEPTH_POKEMON_BASE(520) + (gridX+gridY) * 5 + tileHeight + 0.5`.
- `packages/renderer/src/grid/DecorationsLayer.ts:119` — depth déco : `DEPTH_POKEMON_BASE + (x+y) * 5 + heightUnits + DEPTH_DECORATIONS_OBSTACLE_OFFSET(0.3)`.
- Les **décos** inter-trient déjà correctement avec les Pokemon (même base `DEPTH_POKEMON_BASE`). Les **tiles** non.
- `packages/renderer/src/grid/iso-math.ts:68-97` — `screenToGridWithHeight` fait un **strict diamond hit test + greatest-depth-wins**. Quand un point écran tombe dans plusieurs diamonds (cas pilier 2×2 avec tile plate derrière à la même ligne d'écran), la cellule de depth max gagne — impossible de cliquer la tile « derrière / dessous ».

### Décisions adjacentes

- Plan 060 Section B silhouette X-ray **skippée** (plan 061 archivé, bancale visuellement).
- Décision #272 : Phase 3.5 Babylon repoussée après Phase 7 **si ce plan réussit**. Sinon retour à l'ordre initial (Babylon prioritaire).
- Best-practices 2026-04-20 : approche « footprint grid comparison + garde-fou screen-space » recommandée (voir sources en fin de plan).

## Décisions arrêtées

- **Partie A = prérequis bloquant de la Partie C.** Sans fix depth, le fade ne se déclencherait jamais (Pokemon toujours devant les tiles en depth).
- **Partie B indépendante de A et C.** Elle peut être livrée avant, entre ou après — elle ne touche qu'au picking (`iso-math.ts`) et au scene input. On la positionne en B (après A) car le scénario démo « pilier sur sandbox-los » est la map qui rend **A + B** convaincants ensemble.
- **Scope Partie A** : unifier les tiles **surélevées (elevation > 0)** dans l'espace `DEPTH_POKEMON_BASE`. Les tiles plates (elevation = 0) peuvent rester à `DEPTH_GRID_TILES` (toujours sous tout le monde, zéro ambiguïté).
- **Scope Partie B** : modifier **Alt** (desktop). Tenir `Alt` pendant le survol/clic = préférer la 2e meilleure cellule candidate (depth inférieure, donc « derrière / dessous » visuellement). Un simple tap sur Alt bascule l'état pour la durée où il est maintenu. Pas de toggle persistant.
- **Indicateur UI Partie B** : quand `Alt` est maintenu et qu'au moins 2 candidats existent sous le curseur, afficher un liseré subtil (couleur secondaire) autour de la cellule sélectionnée pour signaler « tu es en mode pick alternatif ». Sinon silencieux.
- **Touch / mobile Partie B** : hors scope MVP. Si touch devient supporté un jour, un bouton UI ou long-press activera le mode. Noté dans Risques.
- **Scope Partie C** : décos (rochers, arbres, herbe haute) **+** tiles `elevation > 0`. Même détection, même fade.
- **Fréquence détection Partie C** : par frame (pas par event). Coût mesuré : ~360 comparaisons/frame (30 décos × 12 Pokemon), négligeable à 60 fps.
- **Critère "derrière" Partie C** : approche hybride
  1. Filtre depth : `depth_obstacle > depth_pokemon + 0.5` (epsilon contre le scintillement diagonale iso).
  2. Garde-fou screen-space : chevauchement horizontal des bbox écran du Pokemon et de l'obstacle (évite les faux positifs sur la même diagonale iso à plusieurs cellules d'écart).
- **Alpha fade** : `0.4` constant (`OCCLUSION_FADE_ALPHA`). Pas de transition animée en MVP — bascule immédiate. Tween différable si scintillement.
- **Pipeline per frame** : `reset all → test all → apply`. Jamais `reset+test entrelacés` (sinon le dernier Pokemon dans la boucle gagne et les décos derrière lesquelles plusieurs Pokemon sont cachés perdent leur fade).
- **Conflit avec `previewMode`** : guard `if (this.previewMode) return` en tête de `updateOcclusion()` — le preview mode du ciblage reste maître quand actif.
- **Pas de détection au niveau décoration herbe haute** : l'herbe haute masque volontairement le Pokemon (décision plan 064 : « tête visible, corps masqué »). Le fade **ne s'applique pas** à la tall grass — seulement aux obstacles (rochers, arbres) et aux tiles surélevées.

## Partie A — Fix depth unifié (prérequis)

### A.1 — Nouveau layout depth (renderer + docs) (S)

- Introduire `DEPTH_TILE_BASE = DEPTH_POKEMON_BASE` dans `constants.ts` comme **alias explicite** (pas une nouvelle valeur) — objectif : nommer l'intention « les tiles surélevées partagent l'espace depth des Pokemon ». Toute référence future au constant reste égale à `DEPTH_POKEMON_BASE`.
- Offsets relatifs par layer type (tous additionnés à `DEPTH_POKEMON_BASE + (x+y)*K + h`) :
  - Tile surélevée : offset `0.0` (sous tout le reste à même cell)
  - Pokemon : offset `0.5` (inchangé, au-dessus de la tile où il se tient)
  - Obstacle déco : offset `0.3` (inchangé, masque le corps si même cell)
  - Tall grass : offset `0.6` (inchangé)
- Les tiles **plates** (`elevation = 0`) restent à `DEPTH_GRID_TILES = 0` — pas de changement. Évite de polluer l'espace Pokemon avec des centaines de tiles de fond.
- Mettre à jour `docs/design-system.md` avec le nouveau tableau de depths unifiées et l'intention (inter-sort correct Pokemon ↔ tiles surélevées).

### A.2 — Modif `drawGridFromTileData` (renderer) (S)

- `IsometricGrid.ts:147` — changer la formule :
  ```ts
  const depth = layer.elevation > 0
    ? DEPTH_POKEMON_BASE + (x + y) * DEPTH_TILE_MAX_ELEVATION + layer.elevation
    : DEPTH_GRID_TILES + (x + y) * DEPTH_TILE_MAX_ELEVATION;
  ```
- Vérifier qu'on ne casse pas les highlights (move range, attack range, enemy range) — leurs offsets (`DEPTH_HIGHLIGHT_ISO_OFFSET=0.1`, `DEPTH_ENEMY_RANGE_ISO_OFFSET=0.15`, `DEPTH_PREVIEW_ISO_OFFSET=0.2`) sont appliqués sur `(x+y)*K + height` sans base — donc ils sont à depth ~0-205. Si une tile surélevée passe à 520+, les highlights sur cette tile se retrouvent **dessous**. → ajuster : les highlights doivent suivre la tile (donc utiliser la même base).

### A.3 — Cohérence highlights + curseur (renderer) (S)

- **Bug à corriger** : `IsometricGrid.getOrCreateTileGraphicsAtHeight` (ligne 377) utilise actuellement une base implicite de 0 :
  ```ts
  graphics.setDepth((gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height + isoOffset);
  ```
  Après A.2, les tiles `elevation > 0` passent à `DEPTH_POKEMON_BASE + ...` (520+), mais les highlights de ces tiles restent à `~5-20` — ils se retrouvent **sous** la tile. Correction :
  ```ts
  const baseDepth = height > 0
    ? DEPTH_POKEMON_BASE + (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height
    : (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height;
  graphics.setDepth(baseDepth + isoOffset);
  ```
- **Curseur** : `showCursor` (lignes 394-400) utilise déjà `DEPTH_POKEMON_BASE` quand une déco est présente. Étendre la condition pour inclure les cells avec `height > 0` **sans** déco :
  ```ts
  const isOnRaisedCell = decorationHeight > 0 || height > 0;
  const cursorDepth = isOnRaisedCell
    ? DEPTH_POKEMON_BASE + (gridX + gridY) * DEPTH_TILE_MAX_ELEVATION + height + DEPTH_CURSOR_OVER_DECORATION_OFFSET
    : DEPTH_CURSOR_GROUND;
  ```
  `DEPTH_CURSOR_OVER_DECORATION_OFFSET` reste à 0.8, inchangé.

### A.4 — Tests visuels de régression (renderer)

- Lancer `pnpm dev:sandbox` sur `sandbox-los.tmj` — le Pokemon derrière un pilier doit être masqué par le pilier.
- Vérifier sur `highlands.tmj` (dénivelés variés) que le tri reste correct dans les 4 directions.
- Vérifier sur `decorations-demo.tmj` que les décos + tiles surélevées + Pokemon inter-trient bien.
- Pas de scintillement sur les bordures (epsilon 0.5 applique).
- Screenshots dans `.screenshots/plan-065/partie-a/`.

**Critère de sortie Partie A** : sur `sandbox-los.tmj`, tout Pokemon dont la depth iso est **inférieure** à celle d'un pilier (i.e. `(pokX + pokY) < (pillarX + pillarY)` avec pour chaque cellule `depth = (x+y)*K + height`) est **occulté** par le pilier (pas de fade encore, juste le bon tri). Validable dans les 4 directions cardinales.

## Partie B — Picking disambiguation (Alt-click modifier)

### B.1 — Extension `screenToGridWithHeight` (renderer) (S)

- `packages/renderer/src/grid/iso-math.ts:68` — enrichir la signature (conserver `heightData: readonly number[]` 1D flat-indexed `y * gridWidth + x`, cf. signature actuelle) :
  ```ts
  export function screenToGridWithHeight(
    screenX: number,
    screenY: number,
    heightData: readonly number[],
    context: IsoProjectionContext,
    options: { preferLower?: boolean } = {},
  ): GridPosition | null;
  ```
- Au lieu de ne garder que `bestDepth`, accumuler **tous les candidats** qui passent le hit-test strict : `const candidates: { x: number; y: number; depth: number }[] = []`.
- Tri final :
  - `preferLower = false` (défaut, comportement actuel) → retourner le candidat de depth **max**.
  - `preferLower = true` → retourner le candidat de depth **min** **strictement inférieure** à la max (i.e. la 2e meilleure). Si 1 seul candidat, on retourne quand même ce candidat (fallback gracieux, pas de null).
- Tests unitaires dans `iso-math.test.ts` : cas pilier 2×2 avec tile plate derrière dont les diamonds se chevauchent au pixel près.

### B.2 — Propagation du flag `preferLower` (renderer) (S)

- `IsometricGrid.screenToGrid(screenX, screenY, preferLower = false)` : passer le flag à `screenToGridWithHeight`.
- **Approche retenue** : `BattleScene` input handler (pointermove + click) lit `pointer.event.altKey` directement sur l'event natif (idiomatique Phaser 4, zéro overhead, pas de `Key` à maintenir). Si `preferLower` doit être lu hors event (ex. tween), prévoir une lecture one-shot dans le handler et la stocker temporairement.
- Fallback documenté dans `docs/references/` seulement si un navigateur remonte `altKey = undefined` : instancier `addKey(Phaser.Input.Keyboard.KeyCodes.ALT)` et lire `.isDown`. Pas de code mort dans le MVP.

### B.3 — Indicateur UI (renderer) (XS)

- Quand le survol pointe une cell en mode `preferLower = true` ET qu'au moins 2 candidats existent, dessiner un liseré autour du curseur avec une couleur secondaire.
- Ajouter dans `constants.ts` : `export const COLOR_CURSOR_ALT = 0xffd54f;` (jaune chaud, cohérent avec `CURSOR_COLOR = 0xffdd44` or). Documenter dans `docs/design-system.md`.
- Sinon : curseur normal inchangé.
- Implémentation : `IsometricGrid.showCursor` accepte un 3e paramètre `variant: "default" | "alt"`. Switch de couleur + pas de changement de shape.

### B.4 — Tests visuels Partie B (renderer)

- `sandbox-los.tmj` : hover sur le haut d'un pilier → cellule du haut sélectionnée (comportement actuel, inchangé).
- Maintenir Alt → cellule **derrière** le haut du pilier (la tile plate au même pixel) devient sélectionnée. Liseré jaune.
- Relâcher Alt → cellule du haut reprend.
- Cliquer (sans Alt) sur le haut d'un pilier → move range de la cellule haute.
- Maintenir Alt + clic → move range / sélection de la cellule derrière.
- Aucun changement de comportement sur cells sans ambiguïté (1 seul candidat, preferLower ignoré).
- Screenshots dans `.screenshots/plan-065/partie-b/`.

**Critère de sortie Partie B** : sur `sandbox-los.tmj` avec un pilier, il est possible de sélectionner toutes les cells du plateau, y compris celles dont le diamond est pixel-parfait recouvert par le haut du pilier, via Alt.

## Partie C — Fade dynamique per-sprite

### C.1 — Module `OcclusionFader` (renderer) (M)

- Créer `packages/renderer/src/grid/OcclusionFader.ts`.
- Signature :
  ```ts
  class OcclusionFader {
    register(sprite: Phaser.GameObjects.Image, cell: { x: number; y: number; width: number; height: number; heightUnits: number }): void;
    unregister(sprite: Phaser.GameObjects.Image): void;
    unregisterAll(): void;
    updateAll(pokemonPositions: readonly { x: number; y: number; height: number; screenBounds: Phaser.Geom.Rectangle }[]): void;
    setEnabled(enabled: boolean): void;
  }
  ```
- Pipeline `updateAll` :
  1. Pour chaque obstacle enregistré : reset `setAlpha(1.0)`.
  2. Pour chaque obstacle : itérer sur les Pokemon.
     - `depth_obstacle > depth_pokemon + 0.5` ? Sinon skip.
     - Bbox écran Pokemon chevauche bbox écran obstacle ? Sinon skip.
     - Si les deux : marquer l'obstacle comme « occluded » et break (1 seul Pokemon suffit).
  3. Pour chaque obstacle marqué : `setAlpha(0.4)`.
- Constante `OCCLUSION_FADE_ALPHA = 0.4` dans `constants.ts` (section depth / occlusion, vers ligne 391). Documenter dans `docs/design-system.md`.
- Early return si `!enabled` (e.g. preview mode actif) — ne touche à aucun alpha.
- **Justification epsilon `0.5`** (cf. Décisions arrêtées) : plus grand que tout offset de `constants.ts` (`DEPTH_DECORATIONS_OBSTACLE_OFFSET = 0.3`, `DEPTH_CURSOR_OVER_DECORATION_OFFSET = 0.8` restant exclusif car non-obstacle). Garantit qu'un Pokemon au même gridX+gridY qu'un obstacle à même hauteur n'active jamais le fade (ils sont au même niveau, pas "derrière"). Commentaire inline dans `OcclusionFader.updateAll`.

### C.2 — Intégration `DecorationsLayer` (renderer) (S)

- Dans `DecorationsLayer.placeObjectSprite` / `placeTallGrass` : ajouter un `fader.register(sprite, cell)` après chaque création de sprite **obstacle** (pas tall grass — voir décisions).
- Dans `clear()` : `fader.unregisterAll()`.
- Guard `if (previewMode) fader.setEnabled(false)` dans `setPreviewMode`.
- **Transition preview ↔ normal** : lors du basculement `setEnabled(false)`, `OcclusionFader` doit **reset tous les obstacles à alpha 1.0** avant de laisser le preview mode prendre la main (sinon certains obstacles restent en fade 0.4 et leur alpha est ré-écrasé à 0.45 par le preview — état incohérent au retour en mode normal). Implémentation dans `setEnabled(false)` : un `for (const obstacle of this.registered) obstacle.sprite.setAlpha(1.0)` avant le `return`.

### C.3 — Intégration tiles surélevées (renderer) (S)

- Dans `IsometricGrid.drawGridFromTileData` : après création d'un sprite de tile avec `layer.elevation > 0`, appeler `fader.register(sprite, cell)`.
- Avant un `drawGridFromTileData` suivant (rechargement de map) : `fader.unregisterAll()`.

### C.4 — Boucle de mise à jour (renderer) (S)

- `BattleScene.update(time, delta)` : appeler `fader.updateAll(pokemonPositions)` par frame.
- `pokemonPositions` dérivé du `GameController` : pour chaque Pokemon vivant, récupérer `gridPosition`, `tileHeight`, `screenBounds` (calculé depuis `container.x/y` et une bbox fixe type `48×48`).
- Coût mesuré cible : < 0.5 ms/frame pour 30 obstacles × 12 Pokemon.

### C.5 — Screen bounds d'un Pokemon (renderer) (XS)

- Helper `PokemonSprite.getScreenBounds()` : `Phaser.Geom.Rectangle` centré sur `container.x/y`, width=48, height=48 (matche la taille sprite PMDCollab). Pas de recalcul — juste `new Rectangle(x-24, y-24, 48, 48)`.

### C.6 — Screen bounds d'une déco / tile surélevée (renderer) (XS)

- Helper `getSpriteScreenBounds(sprite)` : `Phaser.Geom.Rectangle.fromPoints([sprite.getTopLeft(), sprite.getBottomRight()])`. Phaser 4 expose déjà ces helpers.

### C.7 — Tests visuels (renderer)

- `sandbox-los.tmj` : un Pokemon derrière un pilier → le pilier fade à alpha 0.4. Le Pokemon reste pleinement visible derrière (car alpha 0.4 sur le pilier, pas sur le Pokemon).
- `decorations-demo.tmj` : un Pokemon derrière l'arbre → l'arbre fade.
- Pokemon juste à côté (même gridY, 2 cellules d'écart latéral) → pas de fade (screen bbox ne chevauche pas).
- Plusieurs Pokemon derrière la même déco → la déco fade, aucun revert quand le 2e Pokemon est traité (pipeline reset→test→apply).
- Preview mode attack (ciblage) → `previewMode` override, fade désactivé (le preview mode masque déjà tout à 0.45).
- Screenshots dans `.screenshots/plan-065/partie-c/`.

### C.8 — Test d'intégration (obligatoire)

- Test headless du `OcclusionFader.updateAll` avec mock sprites (positions fixes, pokemonPositions fixes) — vérifier que le bon alpha est appliqué sur les bons sprites. Le pipeline reset→test→apply est critique ; un test headless attrape tôt les régressions (notamment le cas « plusieurs Pokemon derrière la même déco » où un apply entrelacé casse l'état).

## Critères de complétion

- `pnpm test` + `pnpm typecheck` + `pnpm lint` + `pnpm test:integration` : zéro erreur.
- Partie A : Pokemon derrière un pilier en gridY > gridY_pilier est correctement **occulté** par le pilier sur `sandbox-los.tmj`. Aucun scintillement.
- Partie B : sur `sandbox-los.tmj`, toutes les cells du plateau sont accessibles au pointeur. Les cells dont le diamond est pixel-parfait recouvert par un haut de pilier restent sélectionnables via `Alt`. Feedback visuel (liseré secondaire) quand Alt est actif avec candidats multiples.
- Partie C : obstacle (déco ou tile surélevée) devant un Pokemon est fade à alpha 0.4 quand chevauchement screen, sinon alpha 1.0. Pas de faux positifs sur diagonale iso décalée.
- Preview mode du ciblage reste prioritaire sur le fade d'occlusion.
- Tall grass **non** affectée par le fade (masquage volontaire conservé).
- Documentation : `docs/design-system.md` mis à jour avec le nouveau tableau depths + constantes `OCCLUSION_FADE_ALPHA` et `COLOR_CURSOR_ALT`.

## Risques / Questions

- **Touch / mobile hors scope Partie B** : `Alt` n'existe pas sur mobile. Si l'on supporte un jour le touch, il faudra un bouton toggle UI ou long-press pour activer le mode `preferLower`. Pas urgent — desktop-only acceptable pour le MVP.
- **Différence OS pour `Alt`** : sur macOS, `Alt/Option` bloque certains raccourcis navigateur (insertion de caractères spéciaux, etc.). Tester sur macOS. Fallback possible : accepter aussi `Shift` en alias.
- **Détection de Alt via `pointer.event`** : si Phaser normalise l'event différemment sur certains backends, lire via `pointer.event.altKey` peut retourner undefined. Fallback : instancier un `altKey` via `addKey(ALT)` et lire `altKey.isDown` — plus fiable, coût zéro.
- **Combo Alt + drag caméra** (si plan 020 zoom+pan touch-friendly arrive) : `Alt+drag` pourrait entrer en conflit avec un panning futur. À trancher plus tard — pour l'instant Alt = picking only.
- **Scintillement sur les tiles-pilier multi-niveaux** : un pilier à `height=2` partage sa cellule avec les niveaux `elevation=1` et `elevation=2`. Les deux doivent fade ensemble. Le `OcclusionFader` doit les enregistrer indépendamment, et le critère « Pokemon derrière » s'applique à chaque strate — à vérifier en test C.7.
- **Performance** : 30 décos + 20×20 tiles surélevées (partielles) × 12 Pokemon = au pire ~1200 comparaisons/frame. Reste < 1ms. Si une map future pousse à 100 obstacles → passer à un spatial hash basé sur `x+y` bucket. Pas le cas MVP.
- **Cohérence avec les animations de mouvement** : pendant qu'un Pokemon traverse une tile (tween en cours), sa `gridPosition` est la destination mais son `container.x/y` est entre deux cells. Le fade doit suivre la position **écran** du Pokemon (screen bbox), pas sa gridPosition figée → on passe déjà le `screenBounds` dans `pokemonPositions`, c'est OK.
- **Fade qui oscille pendant un mouvement** : un Pokemon qui traverse plusieurs cellules peut brièvement déclencher / annuler le fade sur plusieurs obstacles. Acceptable visuellement (c'est même plutôt agréable). Si ça scintille : tween linéaire 150ms sur l'alpha au lieu du set immédiat.
- **Tiles plates `elevation=0` qui participeraient à une scène « creuse » (trou)** : actuellement hors scope. Si un futur terrain `Pit` doit occulter visuellement, on réintroduira dans la partie A.
- **Obstacles multi-tiles (rocher 2×2 du plan 064)** : le `OcclusionFader` enregistre **1 sprite = 1 entrée**. Pour un rocher 2×2 qui est 1 seul sprite 64×64 (plan 064 décision « sprite unique, pas de quarts »), l'évaluation doit utiliser la screen bbox du sprite entier (couvre les 4 cellules du footprint visuellement), pas une cellule unique. `B.6` utilise `getTopLeft()/getBottomRight()` du sprite — OK. Pas de bug d'agrégation.
- **Zoom caméra** (plans 020, 044) : 3 niveaux de zoom discrets. Les `screenBounds` d'un Pokemon sont calculés depuis `container.x/y` (coordonnées monde) → la caméra Phaser 4 projette automatiquement, donc le chevauchement bbox reste cohérent. À **valider empiriquement** en B.7 sur chaque niveau de zoom (le ratio de superposition visuelle peut changer avec le zoom — un scaling différent change la taille apparente des sprites mais pas le critère de "Pokemon est derrière l'obstacle").
- **KO qui retire un Pokemon** : le `pokemonPositions` passé à `updateAll` doit être la liste des Pokemon **vivants** (ou visibles — corps KO au sol persistent selon décision #24). Si un corps KO reste affiché, il peut continuer à faire fader des obstacles derrière lui. Décision : **les corps KO ne déclenchent pas le fade** (ils sont aplatis au sol, pas une menace tactique). `pokemonPositions` exclut les KO.
- **Passerelles / terrains traversables sous une tile haute** (futur Phase 3.6+) : hors scope. Si une future « passerelle » permet à un Pokemon de passer **sous** une tile surélevée, le fade serait souhaitable. Conservé comme note : « si passerelle ajoutée, vérifier que le Pokemon sous la passerelle fait fade la passerelle — même critère, rien à changer ».

## Sources

- Rapport `best-practices` 2026-04-20 (occlusion fade 2D iso)
- [Isometric depth sorting (Mazebert)](https://mazebert.com/forum/news/isometric-depth-sorting--id775/)
- [Phaser Isometric Game Tutorial — Generalist Programmer](https://generalistprogrammer.com/tutorials/phaser-isometric-game-tutorial)
- [Unity 2D translucent effect when a character is behind an object — Allison Liem](https://allison-liem.medium.com/unity-2d-translucent-effect-when-a-character-is-behind-an-object-f94f09165603)
- [Drawing isometric boxes in the correct order — Shaun LeBron](https://shaunlebron.github.io/IsometricBlocks/)

## Dépendances

- **Prérequis** : Plan 064 (décorations Tiled) livré — `DecorationsLayer` + `obstacleHeightByCell` + constantes depth des décos existent.
- **Débloque** : validation empirique de la question « l'iso 2D Phaser est-elle viable pour un jeu complet ? ». Réponse oui → Phase 3.5 Babylon reste après Phase 7. Réponse non (fade non convaincant, picking toujours frustrant, bugs résiduels irréductibles) → Phase 3.5 redevient prioritaire (retour à l'ordre d'avant #272).
- **Conflit** : aucun plan en cours ne touche aux depths. RAS.
