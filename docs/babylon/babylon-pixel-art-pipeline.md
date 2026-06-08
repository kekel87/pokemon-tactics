# Babylon — Pipeline pixel-art (RTT + integer scaling)

> Phase 5, **jalon dédié** (à planifier — voir plan 119). Synthèse des bonnes
> pratiques pour donner un aspect pixel cohérent (arêtes des tiles + textures
> sur la même grille de pixels). Décision 2026-06-08 : reporté à un jalon propre,
> full-res en attendant (pas de hack `hardwareScalingLevel` dans le code livré).

## ⚠️ VERDICT FINAL 2026-06-10 — Jalon 3.5 ABANDONNÉ (décision humaine)

**4 approches implémentées, testées et rejetées le même jour.** Décision finale
du directeur créatif : « c'est un détail, ça rend déjà super bien comme c'était »
— le rendu pleine résolution actuel est conservé tel quel. **Ne réexplorer
AUCUNE de ces pistes sans décision humaine explicite.**

Le besoin réel, clarifié au fil des essais : « contrôler le crénelage des
tiles » — forcer des marches de GROS pixels sur les bords des blocs de terrain,
sans toucher textures/sprites. Historique des essais :

| # | Approche | Résultat | Pourquoi rejeté |
|---|----------|----------|-----------------|
| 1 | **Pipeline plein-écran** : `PassPostProcess` taille fixe `{ size: { width, height } }` NEAREST, réso interne paire `floor(css/N)`, frustum depuis réso interne (1 texel = 1 px interne), zoom paliers entiers ×1→×8, snap caméra texel au repos | Fonctionnait (validé techniquement) | Perte de qualité sprites/décos/textures/curseur — tout resamplé |
| 2 | **Liseré 1 texel baké dans le tileset** (`terrain-3d/*-top.png` assombris ×0.7 sur le ring de bord) + curseur/outline en quads 2 texels | Fonctionnait | Dessine une grille sur CHAQUE tile, pas le contour des blocs — « pas du tout ce que j'avais demandé » |
| 3 | **Liserés géométriques** : quads sombres 2 texels posés sur les cassures de relief à l'extrusion (`?edges=1`) | Fonctionnait | Trait AJOUTÉ, pas du crénelage — toujours pas le besoin |
| 4 | **Crénelage contrôlé** (`edge-pixelate-spike.ts`, `?edges=N`) : RTT profondeur terrain basse réso (ShaderMaterial `gl_FragCoord.z`, HALF_FLOAT, renderList terrain seul) + post-process qui mosaïque en blocs N×N les pixels dont le bloc basse-réso présente un saut de profondeur (seuil 0.0025 ≈ demi-marche 0.5u avec minZ 0.1/maxZ 100) | Le plus proche du besoin — « c'est pas mal » | « ça le fait pas partout » (les arêtes internes top/side sans saut de profondeur ne crénellent pas — il aurait fallu les normales en plus) ; jugé non prioritaire |

Si la question se rouvre un jour : repartir de l'essai 4 (code dans l'historique
git de cette session, recherche best-practices dans les sources ci-dessous) et
ajouter la détection par normales (GeometryBufferRenderer) pour couvrir les
arêtes internes. La recherche du 2026-06-10 classait cette approche « élevée en
complexité, risque de flicker documenté, exclusion sprites difficile » — c'est
pour ça qu'elle était en spike jetable.

**Enseignements durables** (valables quel que soit le futur choix) :
- UI DOM en résolution native, jamais snappée sur une grille basse-réso
  (standard HD-2D : Octopath, Triangle Strategy) ; cohérence rétro par la police
  pixel `pokemon-emerald-pro`.
- Gotcha Babylon : un `PostProcess` à taille fixe **se recrée** (pas de
  `resize()` in-place — les options de construction sont relues à chaque
  activation).
- `EdgesRenderer` natif : inadapté (1 px écran, arêtes manquantes entre cubes
  adjacents, bug instancing #6539).
- MSAA (`antialias: true`) lisse les bords de polygones SANS toucher les
  textures NEAREST ni les sprites alpha-test — testé, c'est l'inverse du besoin,
  mais utile à savoir.

## Le problème

La géométrie 3D (arêtes des cubes, contour du losange) est rendue en pleine
résolution → escaliers fins, alors que les textures sont chunky (1 texel ≈ 3px).
Arêtes et textures ne partagent pas la même grille → incohérent en pixel-art.

## Technique standard (consensus marché)

Rendre la scène 3D dans une **render target basse résolution**, puis l'upscaler
en **NEAREST** vers le canvas. Tout (arêtes, textures, sprites) tombe alors sur
une grille de pixels unique.

Points durs à respecter :
1. **Integer scaling** — facteur d'upscale entier (×2, ×3…), jamais fractionnaire,
   sinon scintillement / pixels de tailles inégales. Choisir la résolution interne
   = `canvas / N` entier.
2. **Pixel snapping** — arrondir les positions projetées au pixel de la cible
   basse-réso → évite le "pixel creep" (bave des pixels) au déplacement caméra/sprite.
3. **1 px interne = 1 texel visé** — c'est ce qui aligne arêtes et textures.
4. NEAREST partout + `image-rendering: pixelated` sur le canvas d'affichage.

## Enseignement clé (HD-2D type Octopath)

Tout est rendu à **UNE résolution interne**. Les sprites sont **dessinés à la
taille pixel cible**, pas "haute réso préservée". La cohérence vient d'une
**densité de pixels unique** pour tout l'art.

→ Notre tension actuelle : tiles **24px/unité** vs sprites **24px/unité** (= densité tile, choix
0.5×, cf. `babylon-2d-overlay-scaling.md`). Densités différentes → aucune
résolution interne unique ne rend à la fois « arêtes = gros pixel tile » ET
« sprites nets ». À trancher au jalon : soit unifier la densité source, soit
choisir la grille interne = densité sprite (tiles à 2 px/texel, encore propres).

## Option « terrain pixel + sprites nets » — DÉCONSEILLÉE ici

Render-target par objet (terrain en RTT basse-réso → quad, sprites nets par-dessus)
donne les deux, MAIS casse le depth/occlusion entre le quad terrain et les sprites.
Rédhibitoire pour notre iso **à reliefs** (un Pokemon derrière un mur ne s'occulte
plus correctement). À écarter.

## Implémentation Babylon visée (jalon dédié)

1. `RenderTargetTexture` à résolution interne fixe (= `floor(canvasH / N)`),
   sampling NEAREST.
2. Rendre la scène 3D dedans (caméra ortho iso inchangée).
3. Plan plein écran (ou post-process `PassPostProcess`) qui sample la RTT en
   NEAREST vers le canvas, + `image-rendering: pixelated`.
4. Recalculer N sur resize pour garder un scaling entier (letterbox si besoin).
5. Pixel-snap des projections monde→écran de l'overlay DOM (cat. A du contrat UI)
   sur la même grille.

## Gotchas

- `hardwareScalingLevel` est le hack rapide équivalent mais **sans** garantie
  d'integer scaling → scintillement. Acceptable pour un test ressenti (touches
  `k`/`l` du spike), pas pour le livré.
- Penser à la résolution des **ombres**, **textes flottants**, **curseur** : ils
  doivent suivre la même grille (cf. contrat overlay UI).

## Sources

- [Bentine — Pixelizing 3D objects](https://medium.com/@elliotbentine/pixelizing-3d-objects-b55ec33328f1)
- [ProPixelizer — pixelization controls](https://propixelizer.github.io/docs/usage/pixelization/)
- [Unity — low-res 3D pixel art + integer upscaling](https://discussions.unity.com/t/low-resolution-rendering-3d-pixel-art-with-integer-upscaling/848462)
- [MDN — crisp pixel art look](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look)
- [GDQuest — pixel art setup (Godot 4)](https://www.gdquest.com/library/pixel_art_setup_godot4/)
