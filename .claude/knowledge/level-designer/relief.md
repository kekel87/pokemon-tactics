# Relief : hauteurs, pentes, chutes

À lire par `level-designer` dès que la carte a une case de hauteur > 0 ou une pente.

## Hauteur — formule et règle de stacking

> **Formule de hauteur :** `cell.height = layer.elevation + tile.height`
>
> - `layer.elevation` = N × 0.5 (déduit du suffixe du nom de layer : `terrain` → 0, `terrain_1` → 0.5, `terrain_2` → 1.0, `terrain_3` → 1.5…).
> - `tile.height` = propriété de la tile (défini dans `tileset.tsj`). Values courantes : **full** = 1.0, **half** = 0.5, **stairs/ramp** = 0.5.

**Règle de stacking** : une tile posée sur `terrain_N` représente un volume qui va de `N*0.5` à `N*0.5 + tile.height`. Pour **empiler proprement** une tile sur une autre, la tile du dessus doit commencer là où celle du dessous se termine — sinon chevauchement visuel.

**Cas d'usage courants** (mémorise ces 4 cas) :

| Intent | Layers |
|--------|--------|
| Bloc plein h=1 au sol (ex : pilier, mur court) | `terrain` avec full (h=1) **seulement**. Pas besoin de stacking. `cell.height = 1.0`. |
| Bloc plein h=2 au sol (ex : mur haut) | full sur `terrain` + full sur `terrain_2`. Le premier couvre 0→1, le second 1→2. `cell.height = 2.0`. |
| Butte h=0.5 au sol (ex : petite bosse) | half sur `terrain` **seulement**. `cell.height = 0.5`. |
| Butte h=1.5 (bloc + demi-bloc au-dessus) | full sur `terrain` (0→1) + half sur `terrain_2` (1→1.5). `cell.height = 1.5`. |

**Piège fréquent à éviter** :

- ❌ Full sur `terrain` + half sur `terrain_1` : la half couvre 0.5→1.0, ce qui **chevauche la moitié haute du full**. Visuellement, demi-tile « collée » sur le flanc supérieur du bloc plein. `cell.height` sort correct (1.0) mais le rendu est incorrect.
- ✅ Pour une butte de demi-bloc au-dessus d'un bloc plein : poser le half sur `terrain_2` (élévation 1.0), pas sur `terrain_1`.

**Règle simple** : quand tu empiles, le layer du dessus doit avoir une élévation égale **au sommet du volume du dessous**. Si le dessous se termine à h=1.0, le dessus va sur `terrain_2`. Si le dessous se termine à h=0.5, le dessus va sur `terrain_1`.

## Pentes et dénivelés — **règle clé du projet**

> **N'utilise que les slopes `south` et `east`.** Les pentes `north` et `west` n'existent pas dans le tileset et seraient invisibles en iso Sud-Est (les faces Nord et Ouest sont cachées par la façade visible).

- Slope `south` : tile `stairs-s` ou `ramp-s` posée telle quelle (tile IDs dans `tileset-mapping.md`).
- Slope `east` : **flip horizontal Tiled** de la tile `stairs-s` ou `ramp-s`. En `.tmj`, GID = `tile_id + firstgid + 0x80000000` (bit 31). En pratique : dans Tiled desktop, sélectionner la tile et appuyer sur `X` pour flip horizontal.
- Pour monter **vers le Nord ou l'Ouest** : utiliser un **cliff abrupt** (pas de slope). Le Pokemon fera un Hop (MAX_CLIMB = 0.5). Au-delà, bloquer le chemin ou descendre par le Sud/Est.
- Une rampe traverse du bas au haut sans déclencher de Hop. Un cliff déclenche Hop ou fall damage selon le sens.

### Placement des ramp-s — règle de bord critique

> **Une ramp-s (slope=south) a son côté NORD élevé et son côté SUD bas.** Elle doit être placée sur le **bord SUD d'un plateau** — la case au SUD de la ramp doit être à élévation INFÉRIEURE.

```
✅ Ramp-s correctement placée (bord sud du plateau, rows croissants vers le bas) :
   row 3 : [ plateau h=2 | plateau h=2 ]    ← intérieur du plateau (NORD de la ramp)
   row 4 : [ ramp-s h=1.5 | ramp-s h=1.5 ] ← bord SUD du plateau
   row 5 : [ sol h=1 | sol h=1 ]            ← terrain bas (SUD = côté bas de la ramp) ✓

❌ Ramp-s incorrecte (bord NORD d'un plateau sud) :
   row 8 : [ sol h=1 | sol h=1 ]            ← terrain bas (NORD de la ramp)
   row 9 : [ ramp-s h=1.5 | ramp-s h=1.5 ] ← bord NORD du plateau sud
   row 10: [ plateau h=2 | plateau h=2 ]    ← côté SUD = PLUS HAUT que la ramp ✗
```

**Conséquence** : un plateau en **bas de map** (rows élevés, ex. rows 9–12) a sa ramp-s sur son **dernier row** (row 12), accessible depuis row 13 (bord inférieur). Il n'est PAS accessible depuis le centre via ramp-s. Pour l'accès depuis le nord, utiliser une ramp-e sur le bord EST du plateau.

### Fall damage — seuils à connaître

```
fall damage = calculateFallDamage(heightDiff, maxHp)
  heightDiff ≤ 1.0 → 0 dégâts (pas de fall damage, même pour h=2→h=1 !)
  heightDiff ≥ 2   → 33% maxHp
  heightDiff ≥ 3   → 66% maxHp
  heightDiff ≥ 4   → 100% maxHp (KO)
```

> **Pour des « falaises mortelles »** (brief ice-cliffs et cartes verticales), il faut `heightDiff > 1.0`. Une tile à h=2.0 tombant sur h=1.0 = diff 1.0 = **0 dégâts**. Pour infliger du fall damage, la chute doit dépasser 1 unité : utiliser **terrain_3 (elevation=1.5) + full (h=1.0) = h=2.5** au minimum. La chute h=2.5→h=1.0 = diff 1.5 = 33% maxHp.

## Dénivelés — doses

- Plat intégral = peu tactique. Au moins **20-30% de la surface avec `height > 0`** pour qu'il se passe quelque chose.
- Saut de hauteur voisin max **2** (au-delà `validateTiledMap` warn — on accepte justifié, ex : mur de falaise).
- Proscrire les îles isolées (bloc surélevé sans rampe ni cliff accessible en ≤ 0.5).
