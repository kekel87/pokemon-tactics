---
status: done
created: 2026-03-31
updated: 2026-03-31
---

# Plan 021 — Sprite offsets corrects via Shadow.png/Offsets.png PMDCollab + ombres sous sprites

## Objectif

Utiliser les fichiers Shadow.png et Offsets.png de PMDCollab pour aligner chaque sprite correctement sur la tile isométrique, positionner précisément la HP bar et l'icône de statut, et afficher une ombre sous chaque Pokemon.

## Contexte

Les 12 Pokemon du roster ont des sprites de tailles très différentes (Geodude petit et trapu, Pidgey allongé, Jigglypuff rond). Actuellement tous partagent le même `POKEMON_SPRITE_OFFSET_Y = 0` et des positions hardcodées à `-32px` pour la HP bar et l'icône statut.

PMDCollab fournit deux fichiers de référence par Pokemon :
- `Shadow.png` : image avec un pixel blanc indiquant le centre au sol du sprite. La distance entre ce pixel et le centre de l'image donne l'offset Y à appliquer pour poser le sprite sur la tile.
- `Offsets.png` : image avec un pixel vert (centre du corps) et un pixel noir (tête). Ces positions permettent de placer la HP bar et l'icône de statut au bon endroit.

`POKEMON_SPRITE_OFFSET_Y` a été ajouté à `constants.ts` (valeur 0) dans le plan 020, prêt à recevoir une valeur par Pokemon.

## Étapes

- [x] Étape 1 — Télécharger Shadow.png et Offsets.png dans `extract-sprites.ts`
  - Dans `extractPokemon()`, après le téléchargement de l'atlas, ajouter les fetches de `Shadow.png` et `Offsets.png` depuis `${spriteBaseUrl}/Shadow.png` et `${spriteBaseUrl}/Offsets.png`
  - Sauvegarder ces fichiers bruts dans `outputPath/shadow.png` et `outputPath/offsets.png`
  - Gérer les erreurs avec `console.warn` + skip si absent (comme pour le portrait)

- [x] Étape2 — Parser Shadow.png → calculer l'offset Y de centrage au sol
  - Créer une fonction `parseShadowOffset(shadowBuffer: Buffer): number` dans le script
  - Utiliser `sharp(buffer).raw().toBuffer()` pour obtenir les pixels RGBA
  - Trouver le premier pixel avec `r >= 250, g >= 250, b >= 250, a >= 250` (blanc)
  - Calculer `offsetY = pixelY - Math.floor(imageHeight / 2)` : distance entre le pixel blanc et le centre vertical de l'image
  - Retourner `offsetY` (positif = sprite doit monter, négatif = descendre)
  - Si aucun pixel blanc trouvé, retourner `0` avec un warning

- [x] Étape3 — Parser Offsets.png → extraire positions corps et tête
  - Créer une fonction `parseOffsets(offsetsBuffer: Buffer): { body: { x: number; y: number }; head: { x: number; y: number } }` dans le script
  - Pixel vert = corps : `g >= 200` et `r < 100` et `b < 100`
  - Pixel noir = tête : `r < 30` et `g < 30` et `b < 30` et `a >= 250`
  - Retourner les coordonnées de chacun, relatives au centre de l'image
  - Si un pixel est absent, retourner la valeur par défaut `{ x: 0, y: -16 }` (corps) ou `{ x: 0, y: -32 }` (tête)

- [x] Étape4 — Générer `offsets.json` par Pokemon
  - Créer une interface `SpriteOffsets` dans le script :
    ```ts
    interface SpriteOffsets {
      shadowOffsetY: number;
      bodyOffset: { x: number; y: number };
      headOffset: { x: number; y: number };
    }
    ```
  - Dans `extractPokemon()`, après le parsing, écrire `offsets.json` dans `outputPath/`
  - Exemple de sortie attendue pour Bulbasaur : `{ "shadowOffsetY": -8, "bodyOffset": { "x": 0, "y": -12 }, "headOffset": { "x": 0, "y": -28 } }`
  - Lancer `pnpm extract-sprites` pour générer les fichiers pour les 12 Pokemon
  - Vérifier visuellement que les valeurs semblent cohérentes (Geodude petit → offset proche de 0, Pidgey → offset plus négatif)

- [x] Étape5 — Charger `offsets.json` dans `SpriteLoader.ts`
  - Dans `preloadPokemonAssets()`, ajouter `scene.load.json(\`${definitionId}-offsets\`, \`${basePath}/offsets.json\`)` pour chaque Pokemon
  - Créer une fonction `getSpriteOffsets(scene: Phaser.Scene, definitionId: string): SpriteOffsets` qui lit le cache JSON et retourne les offsets, avec fallback sur les valeurs par défaut si absent
  - Exporter l'interface `SpriteOffsets` depuis `SpriteLoader.ts`

- [x] Étape6 — Appliquer les offsets dans `PokemonSprite.ts`
  - Dans le constructeur, appeler `getSpriteOffsets(scene, definitionId)` et stocker le résultat dans `private readonly spriteOffsets: SpriteOffsets`
  - Remplacer le `POKEMON_SPRITE_OFFSET_Y` global (valeur 0) par `this.spriteOffsets.shadowOffsetY` dans `updatePosition()` et `animateMoveTo()`
  - Dans `drawHpBar()`, remplacer le hardcodé `-32` par `this.spriteOffsets.bodyOffset.y`
  - Dans `updateStatus()`, remplacer le hardcodé `-32` par `this.spriteOffsets.headOffset.y`
  - Dans `showDamageEstimate()`, même remplacement

- [x] Étape7 — Ajouter l'ombre sous chaque sprite
  - Dans `PokemonSprite`, ajouter un `shadowSprite: Phaser.GameObjects.Image | null` et un `shadowCircle: Phaser.GameObjects.Graphics | null`
  - Si `shadow.png` est chargé (via `scene.load.image(\`${definitionId}-shadow\`, ...)`), créer `shadowSprite` avec scale et alpha 0.5, positionné à `y = 0` (au niveau du sol de la tile, avant l'offsetY)
  - Sinon, dessiner une ellipse noire semi-transparente (largeur `TILE_WIDTH * 0.4`, hauteur `TILE_HEIGHT * 0.3`, alpha 0.3) comme fallback
  - Ajouter le shadow en **premier** dans les `children` du container (rendu sous le sprite)
  - Masquer l'ombre sur `darkenSprite()` (Pokemon KO)
  - Ajouter le chargement de `shadow.png` dans `preloadPokemonAssets()` avec gestion d'absence

## Critères de complétion

- `pnpm extract-sprites` génère `shadow.png`, `offsets.png` et `offsets.json` pour les 12 Pokemon
- Chaque Pokemon est visuellement posé sur sa tile (pas flottant, pas enfoncé dans le sol)
- La HP bar et l'icône de statut suivent la taille réelle du sprite (haute pour Pidgey, basse pour Geodude)
- Une ombre est visible sous chaque sprite vivant, disparaît sur KO
- Aucune régression visuelle sur les autres éléments (timeline, info panel, AoE preview, damage estimate)
- `pnpm build` passe sans erreurs TypeScript
- Test visuel : combat hot-seat complet, tous les sprites OK

## Risques / Questions

- Shadow.png et Offsets.png PMDCollab : format non documenté officiellement — le parsing par couleur de pixel est la convention observée dans les outils tiers (SpriteBot). Valider sur 2-3 Pokemon manuellement avant de générer les 12.
- `Offsets.png` contient potentiellement plusieurs frames (une par direction ou animation) — si c'est le cas, lire uniquement la frame 0 (direction South, frame Idle).
- `POKEMON_SPRITE_SCALE` est actuellement à 1 — les offsets PNG sont en pixels natifs et s'appliquent directement sans multiplication.
- `scene.load.json()` est synchrone au preload mais `scene.cache.json.get()` peut retourner `null` si le fichier est absent — le fallback est obligatoire.
- Certains Pokemon PMDCollab n'ont pas de `Shadow.png` (ex: Gastly qui est un spectre) — prévoir un fallback ellipse généré pour tous les cas d'absence.

## Dépendances

- **Avant** : Plan 020 terminé (done) — `POKEMON_SPRITE_OFFSET_Y` existant dans `constants.ts`, sprites PMDCollab en place pour les 12 Pokemon
- **Débloque** : Plan 022 (refonte timeline) — pas de dépendance directe, peuvent avancer en parallèle
