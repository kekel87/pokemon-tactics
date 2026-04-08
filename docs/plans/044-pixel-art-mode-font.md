# Plan 044 — Mode pixelArt global + police Pokemon Emerald Pro

**Statut** : done
**Créé** : 2026-04-08
**Contexte** : Phase 3 — Terrain & Tactics. Le tileset isométrique est en place (plan 043). On uniformise le rendu pixel art et on remplace la police monospace système par une vraie police Pokemon.

## Objectif

- Activer `pixelArt: true` dans la config Phaser (NEAREST global, roundPixels)
- Supprimer les `POKEMON_SPRITE_SCALE=2` et `TILE_SPRITE_SCALE=2` — rattraper via zoom caméra ou taille de base
- Appliquer `setFilterMode(LINEAR)` sur les portraits pour garder leur définition
- Intégrer la police **Pokemon Emerald Pro** (.ttf) comme police principale du jeu
- Supprimer les appels manuels `setFilter(NEAREST)` devenus redondants

## Analyse de l'existant

### Scales x2 actuels
- `POKEMON_SPRITE_SCALE = 2` (constants.ts:33) → utilisé dans PokemonSprite.ts:109
- `TILE_SPRITE_SCALE = 2` (constants.ts:316) → utilisé dans IsometricGrid.ts
- Les sprites PMDCollab sont ~48x48px natifs, affichés à 96x96
- Les tiles sont 32x32 natifs (spritesheet), affichés à 64x64

### Filtrage NEAREST actuel (sera redondant avec pixelArt: true)
- `PokemonSprite.ts:106` — `texture.setFilter(Phaser.Textures.NEAREST)` sur les atlas Pokemon
- `BattleScene.ts:90` — `tilesetTexture.setFilter(Phaser.Textures.FilterMode.NEAREST)` sur le tileset

### Portraits (doivent rester en LINEAR)
- `SpriteLoader.ts:32` — chargés via `scene.load.image('{id}-portrait', '...portrait-normal.png')`
- `SpriteLoader.ts:45` — idem dans `preloadPokemonAssets`
- Affichés dans : InfoPanel, TurnTimeline, TeamSelectScene, PlacementRosterPanel
- Taille native ~40x40px, souvent redimensionnés via `setDisplaySize()` ou `setScale()`

### Police actuelle
- **100% monospace système** partout dans le renderer (~30+ text objects)
- Tailles : 9px à 36px
- Pas de bitmap font

## Étapes

### Étape 1 — Activer pixelArt: true + supprimer les scales manuels

**Config Phaser** (`main.ts`) :
```typescript
const config: Phaser.Types.Core.GameConfig = {
  // ...existant...
  pixelArt: true,  // ← NEAREST global + roundPixels
};
```

**Supprimer les setFilter manuels devenus redondants** :
- `PokemonSprite.ts:106` — supprimer `texture.setFilter(Phaser.Textures.NEAREST)`
- `BattleScene.ts:90` — supprimer `tilesetTexture.setFilter(Phaser.Textures.FilterMode.NEAREST)`

**Supprimer les constantes de scale** :
- `POKEMON_SPRITE_SCALE = 2` → remplacer par `1`
- `TILE_SPRITE_SCALE = 2` → remplacer par `1`

**Compenser la perte de taille** :
- Les sprites et tiles seront 2x plus petits à l'écran
- Doubler le zoom par défaut de la caméra : `ZOOM_LEVELS` passe de `[2.0, 1.3, 0.85]` à `[4.0, 2.6, 1.7]`
- Ajuster `CAMERA_BOUNDS_MARGIN` si nécessaire

**Ajuster les éléments attachés au sprite** (`PokemonSprite.ts`) :

Tous ces éléments sont dans le même container que le sprite. En passant scale 2→1, le sprite fait 2x plus petit en pixels monde, mais la caméra compense (zoom 2x). Cependant les offsets qui multiplient par `POKEMON_SPRITE_SCALE` doivent être corrigés :

| Élément | Code actuel | Impact |
|---------|-------------|--------|
| `uiOffsetY` | `headOffsetY * POKEMON_SPRITE_SCALE - 26` (L94) | Le `* POKEMON_SPRITE_SCALE` disparaît (=1). Le `-26` magic number doit être ajusté (~`-13`) car le sprite est 2x plus petit. |
| Sprite scale | `setScale(POKEMON_SPRITE_SCALE)` (L109) | Passe à 1 automatiquement |
| Ombre ellipse | `footOffsetY * POKEMON_SPRITE_SCALE` (L337) | Le `* POKEMON_SPRITE_SCALE` disparaît (=1). Taille ombre `TILE_WIDTH * 0.4` reste proportionnelle. |
| HP bar | `HP_BAR_WIDTH=36`, `HP_BAR_HEIGHT=5` (constants) | En pixels monde — visuellement 2x plus petit mais zoom compense. Garder tel quel ou réduire de moitié si le rendu semble trop gros. |
| Status icon | positionné à `uiOffsetY + HP_BAR_HEIGHT/2` (L201) | Suit `uiOffsetY`, OK |
| Damage estimate | dessiné à `uiOffsetY` (L400-436) | Suit `uiOffsetY`, OK |
| Damage text | positionné à `uiOffsetY - 10` (L452, 475) | Le `-10` pourrait devenir `-5` |

**Approche** : ajuster `uiOffsetY` et les magic numbers, puis vérifier visuellement. Le gros du travail est dans PokemonSprite.ts — le reste (container position, depth, tween targets) ne change pas.

### Étape 2 — Portraits en LINEAR

Après le chargement des portraits, appliquer le filtre LINEAR pour contrer le pixelArt global :

**Dans `SpriteLoader.ts`** — créer une fonction `applyPortraitFilter` appelée après le load :
```typescript
export function applyPortraitFilters(scene: Phaser.Scene, definitionIds: Iterable<string>): void {
  for (const definitionId of definitionIds) {
    const texture = scene.textures.get(getPortraitKey(definitionId));
    if (texture && texture.key !== '__MISSING') {
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}
```

**Appeler cette fonction** dans :
- `BattleScene.create()` — après le preload des assets Pokemon
- `TeamSelectScene.create()` — après le preload des portraits

### Étape 3 — Intégrer la police Pokemon Emerald Pro

**Asset** :
- Télécharger `pokemon-emerald-pro.ttf` depuis FontStruct
- Placer dans `public/assets/fonts/pokemon-emerald-pro.ttf`

**Chargement CSS** (@font-face dans `index.html` ou un fichier CSS) :
```css
@font-face {
  font-family: 'PokemonEmeraldPro';
  src: url('/assets/fonts/pokemon-emerald-pro.ttf') format('truetype');
  font-display: swap;
}
```

**Constante** dans `constants.ts` :
```typescript
export const FONT_FAMILY = '"PokemonEmeraldPro", monospace';
```

**Remplacement** : remplacer tous les `fontFamily: "monospace"` par `fontFamily: FONT_FAMILY` dans :
- ActionMenu.ts (~6 occurrences)
- InfoPanel.ts (~3)
- BattleLogPanel.ts (~5)
- BattleText.ts (~1)
- BattleUI.ts (~1)
- TurnTimeline.ts (~1)
- PlacementRosterPanel.ts (~3)
- MoveTooltip.ts (~1)
- PokemonSprite.ts (~2)
- MainMenuScene.ts (~4)
- BattleModeScene.ts (~3)
- SettingsScene.ts (~6)
- CreditsScene.ts (~5)
- TeamSelectScene.ts (à vérifier)

**Ajustement des tailles** :
- La police Pokemon Emerald Pro est conçue pour des petites tailles pixel (8-16px natifs)
- Les tailles actuelles (9-36px) devront peut-être être ajustées car le rendu sera différent
- Tester visuellement et ajuster si nécessaire

### Étape 4 — Vérification visuelle + ajustements

- Lancer le jeu, vérifier chaque écran : menu, team select, placement, combat, settings, credits
- Vérifier les portraits (pas pixelisés)
- Vérifier les sprites et tiles (pixel art net)
- Vérifier la police (lisible, pas floue, accents FR corrects)
- Vérifier les tailles de texte (ajuster si la police rend trop gros/petit)
- Vérifier le zoom caméra (3 niveaux)
- Lancer `visual-tester`

## Risques

- **Police non chargée au premier frame** : le fallback `monospace` prend le relais, pas bloquant. Le `font-display: swap` gère ça.
- **Tailles de texte** : la police pixel peut rendre différemment des tailles système. Ajustements manuels probables.
- **Portraits flous même avec LINEAR** : si Phaser applique roundPixels globalement après le filtre, les portraits pourraient quand même être arrondi aux pixels. À tester — fallback : utiliser une scène overlay UI sans pixelArt (mais c'est déjà le cas pour BattleUIScene).

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `main.ts` | Ajout `pixelArt: true` |
| `constants.ts` | POKEMON_SPRITE_SCALE→1, TILE_SPRITE_SCALE→1, ZOOM_LEVELS doublés, FONT_FAMILY |
| `PokemonSprite.ts` | Supprimer setFilter, scale→1 |
| `BattleScene.ts` | Supprimer setFilter tileset, appeler applyPortraitFilters |
| `SpriteLoader.ts` | Nouvelle fonction applyPortraitFilters |
| `IsometricGrid.ts` | TILE_SPRITE_SCALE→1 |
| `TeamSelectScene.ts` | Appeler applyPortraitFilters |
| `index.html` | @font-face Pokemon Emerald Pro |
| `public/assets/fonts/` | Nouveau fichier TTF |
| ~15 fichiers UI | fontFamily → FONT_FAMILY |
