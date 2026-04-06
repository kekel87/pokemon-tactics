---
status: done
created: 2026-03-31
updated: 2026-03-31
---

# Plan 020 — Canvas responsive et camera zoom/pan

**Prerequis** : Plan 019 termine

## Objectif

Rendre le jeu lisible et agreable visuellement : canvas adaptatif (plein ecran), zoom 3 niveaux et pan camera. Le jeu est actuellement trop petit, surtout sur ecran 4K. On ne touche PAS aux tailles des tiles, sprites ou UI — tout passe par la camera.

## Contexte

Le canvas est fixe 1280x720 dans une div fixe. Sur un ecran 4K, c'est minuscule. Les tiles (64x32) et sprites PMDCollab (scale 2x) sont deja bien proportionnes entre eux (~ratio 2x sprite/tile, standard du genre). Le probleme n'est pas les proportions internes mais l'absence de scaling du canvas et de controle camera.

### Decision : pas de scaling des elements, camera uniquement

On a envisage d'agrandir les tiles (96x48) et le sprite scale (2.5x), mais ca pose un probleme de coherence pixel : les sprites PMDCollab sont du pixel art natif, et changer le scale introduit du sub-pixel blur ou une densite de pixel differente entre tiles et sprites. En restant sur les tailles standard (tiles 64x32, sprites scale 2x), on garde une coherence pixel parfaite et un acces facile aux assets isometriques standard du marche.

Le zoom camera produit le meme effet visuel qu'agrandir les elements, sans ces inconvenients.

### Recherche comparative

| | FFT (PS1) | FFTA (GBA) | Triangle Strategy | Nous (actuel) | Nous (cible) |
|---|---|---|---|---|---|
| Tile (LxH) | ~28x14 | 16x8 | ~80-90x40-45 | 64x32 | **64x32 (inchange)** |
| Sprite scale | 1x | 1x | variable | 2x | **2x (inchange)** |
| Ratio sprite/tile | ~2.0x | ~4-5x | ~1.8x | ~2x | **~2x (inchange)** |
| Tiles visibles | ~90 | ~80 | ~270 (medium) | 144 | **~80-100 (medium zoom)** |
| Zoom | 3 discrets | Non | 3 discrets | Non | **3 discrets** |
| Pan | Centree | Non | Suit curseur | centerOn | **Suit curseur** |
| Canvas | Fixe | Fixe | Adaptatif | Fixe 1280x720 | **FIT responsive** |

### Conclusions

1. Les proportions tiles/sprites/UI sont deja correctes — on n'y touche pas
2. Le canvas doit s'adapter a la fenetre (modele PokeRogue : `Phaser.Scale.FIT`)
3. 3 niveaux de zoom discrets comme FFT et Triangle Strategy
4. Pan camera aux bords + suivi Pokemon actif comme Triangle Strategy
5. Conserver les tailles standard (64x32) pour faciliter l'ajout d'assets tiers

---

## Etapes

### Etape 1 — Canvas responsive (FIT)

- [x] Ajouter `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }` dans la config Phaser (`main.ts`)
- [x] `antialias` et `roundPixels` retires de la config Phaser globale. Filtre `NEAREST` applique par sprite (`texture.setFilter(Phaser.Textures.NEAREST)`) pour conserver le pixel art propre sans pixeliser le texte.
- [x] CSS : `#game-container { width: 100vw; height: 100vh; }` (`index.html`)

**Impact** : zero sur le code. Le jeu continue dans l'espace logique 1280x720. Phaser upscale le canvas CSS. Letterboxing auto pour le ratio 16:9.

**Verification** (`visual-tester`) :
- Le canvas remplit la fenetre du navigateur
- Le ratio 16:9 est preserve (barres noires si fenetre pas 16:9)
- Les clics/hovers restent precis
- Les sprites ne sont pas floutes par l'upscaling

---

### Etape 2 — Camera : zoom 3 niveaux

- [x] Definir les constantes de zoom dans `constants.ts` : `ZOOM_CLOSE` (2.0x), `ZOOM_MEDIUM` (1.3x, defaut), `ZOOM_OVERVIEW` (0.85x)
- [x] `BattleScene.ts` : initialiser la camera avec `setZoom(ZOOM_MEDIUM)`
- [x] `GameController.ts` : ecouter la molette souris + touches +/- pour cycler entre les 3 niveaux
- [x] Transition animee : tween sur ~300ms entre les niveaux (pas de cut brutal)
- [x] `IsometricGrid.screenToGrid` : utiliser `camera.getWorldPoint(screenX, screenY)` au lieu des coords directes pour tenir compte du zoom et du scroll
- [x] Verifier que `BattleUIScene` n'est PAS affectee par le zoom (camera independante)

3 niveaux de zoom discrets (pas de zoom libre) :

| Niveau | Nom | Zoom factor | Tiles visibles (approx) | Usage |
|--------|-----|-------------|------------------------|-------|
| 1 | Close-up | ~2.0x | ~6x6 = 36 | Suivre l'action de pres |
| 2 | Medium (defaut) | ~1.3x | ~10x10 = 100 | Vue tactique standard |
| 3 | Overview | ~0.85x | toute la grille 12x12 | Vue d'ensemble strategique |

Les facteurs exacts seront ajustes visuellement pour que le zoom medium montre ~80-100 tiles (reference FFT/FFTA). Le zoom s'applique uniquement a la `BattleScene`. La `BattleUIScene` overlay reste a zoom 1.0x.

**Verification** (`visual-tester`) :
- Les 3 niveaux de zoom fonctionnent
- Les clics/hovers restent precis a tous les niveaux de zoom
- L'UI overlay ne bouge pas quand on zoom
- La transition est fluide (tween)

---

### Etape 3 — Camera : pan (suivi du curseur)

- [x] `BattleScene.ts` : `setBounds` pour limiter le pan a la zone de la grille + marge (constante `CAMERA_BOUNDS_MARGIN`)
- [x] `BattleScene.update()` : pan aux bords — souris dans les 50px du bord → deplace de 6px/frame dans cette direction
- [x] `GameController.ts` : `centerOn` au debut du tour remplace par `camera.pan(x, y, 400)` (tween fluide)
- [x] Verifier que `setBounds` de `BattleScene` n'affecte pas `BattleUIScene`
- [x] Pan fonctionne a tous les niveaux de zoom

Design (modele Triangle Strategy) :
1. **Suivi automatique** : camera pan vers le Pokemon actif au debut du tour (tween 400ms)
2. **Pan aux bords** : souris proche du bord ecran → camera se deplace dans cette direction
3. **Limites** : camera ne sort pas de la zone grille (bounds)

**Verification** (`visual-tester`) :
- La camera pan quand la souris approche des bords
- La camera centre sur le Pokemon actif au debut du tour (avec animation fluide)
- La camera ne sort pas des limites de la grille
- Le pan fonctionne a tous les niveaux de zoom
- Le pan est fluide (pas saccade)

---

### Etape 4 — Agrandir les portraits de la timeline

- [x] `constants.ts` : tailles ajustees apres test visuel — inactif 42px, actif 48px (valeurs finales calibrees)
- [x] `TurnTimeline.ts` : adapter le rendu aux nouvelles tailles, Y remonte a 20, alignee a gauche avec InfoPanel (X=16)

Les portraits de la timeline sont sur la `BattleUIScene` (pas affectes par le zoom camera), donc il faut les agrandir manuellement. Le reste de l'UI (InfoPanel, ActionMenu, etc.) est deja lisible a taille actuelle une fois le canvas en plein ecran.

**Verification** (`visual-tester`) :
- Les portraits de la timeline sont lisibles (48px minimum)
- La timeline ne deborde pas du canvas verticalement

---

### Etape 5 — Polish et ajustements finaux

- [x] Raccourcis clavier : molette (zoom), +/-/= (zoom), Espace (recentrer sur Pokemon actif), fleches (pan manuel)
- [x] Edge pan (souris aux bords) supprime — feedback utilisateur, pan fleches suffit
- [x] Test combat complet hot-seat : placement → deplacement → attaque → preview AoE → direction fin de tour — OK
- [x] Test visuel : canvas responsive, zoom 3 niveaux, pan fleches, recenter espace — tout fonctionne

> Note : agrandissement tiles (96x48) et sprite scale (2.5x) annules — decision : garder 64x32 et scale 2x, tout passe par la camera. `POKEMON_SPRITE_OFFSET_Y` remis a 0, sera traite dans un prochain plan avec les donnees Shadow.png de PMDCollab.

**Verification** (`visual-tester`) :
- Toutes les interactions fonctionnent a tous les niveaux de zoom
- Les animations sont fluides
- Le texte est lisible partout

---

## Ordre d'execution

1. **Etape 1** (canvas responsive) — independant, quickwin, zero risque
2. **Etape 2** (zoom) — le plus impactant visuellement
3. **Etape 3** (pan) — necessite etape 2 pour que le pan soit utile
4. **Etape 4** (portraits timeline) — independant, peut etre fait a tout moment
5. **Etape 5** (polish) — apres que tout fonctionne

Chaque etape est testable visuellement de facon independante.

---

## Criteres de completion

- [x] Le canvas remplit la fenetre du navigateur (FIT responsive)
- [x] 3 niveaux de zoom fonctionnels (close-up 2.0x, medium 1.3x, overview 0.85x) avec transition animee
- [x] Pan camera aux bords de l'ecran (50px, 6px/frame) + suivi automatique du Pokemon actif (camera.pan fluide)
- [x] L'UI overlay (menus, panels, timeline) n'est pas affectee par le zoom/pan
- [x] Portraits de la timeline ajustes (42px inactif / 48px actif, alignes a gauche X=16)
- [x] Toutes les interactions restent precises a tous les niveaux de zoom
- [x] Combat complet jouable en hot-seat sans regression
- [x] Lisible sur ecran 4K en fenetre (canvas FIT responsive)

---

## Fichiers impactes

- `packages/renderer/src/main.ts` — config Phaser scale + antialias + roundPixels
- `packages/renderer/index.html` — CSS responsive
- `packages/renderer/src/constants.ts` — zoom levels, pan thresholds, timeline sizes
- `packages/renderer/src/grid/IsometricGrid.ts` — screenToGrid avec `getWorldPoint`
- `packages/renderer/src/game/GameController.ts` — zoom controls, centerOn → pan tween
- `packages/renderer/src/ui/TurnTimeline.ts` — taille portraits
- `packages/renderer/src/scenes/BattleScene.ts` — camera setup, setBounds, update() pour edge pan
- `packages/renderer/src/scenes/BattleUIScene.ts` — verifier que l'overlay ne zoom pas

## Dependances

- **Avant ce plan** : Plan 019 termine (done)
- **Ce plan debloque** : confort visuel pour la suite du developpement, prerequis pour mobile/ecrans varies

## Risques / Questions

- **Phaser 4 RC6 Scale Manager** : verifier que `Phaser.Scale.FIT` et `Phaser.Scale.CENTER_BOTH` existent dans cette version. L'API peut differer de Phaser 3.
- **screenToGrid precision** : le passage par `camera.getWorldPoint()` est critique. Si Phaser 4 a une API differente, il faudra adapter.
- **Performance du pan** : le pan continu (bord d'ecran) dans `update()` peut generer beaucoup de re-renders. A surveiller.
- **Facteurs de zoom** : les valeurs proposees (2.0 / 1.3 / 0.85) sont des estimations. A calibrer visuellement pour que le zoom medium montre ~80-100 tiles.
- **UI overlay et zoom/bounds** : s'assurer que `BattleUIScene` est bien une scene separee dont la camera n'est pas affectee par le zoom ni le `setBounds` de `BattleScene`.
