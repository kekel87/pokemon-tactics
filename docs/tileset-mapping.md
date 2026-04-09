# Tileset Mapping — ICON Isometric Pack (Jao)

Référence des tiles du tileset `icon-tileset.png` (22 colonnes, 24 lignes, 528 tiles).
Les IDs sont 0-indexés. En Tiled, GID = tile_id + firstgid (firstgid=1).

## Pattern commun

Chaque type de terrain suit le même pattern relatif à sa tile de base B :

| Élément | Offset | IDs (Herbe, B=22) |
|---------|--------|--------------------|
| Escalier E | B-22 | 0 |
| Escalier S | B-21 | 1 |
| Pente N | B-20 | 2 |
| Pente W | B-19 | 3 |
| Variante 1 | B-18 | 4 |
| Variante 2 | B-17 | 5 |
| Variante 3 | B-16 | 6 |
| Variante 4 | B-15 | 7 |
| Variante 5 | B-14 | 8 |
| **Base (tile pleine)** | **B** | **22** |
| Demi-tile | B+1 | 23 |
| Pente E | B+2 | 24 |
| Pente S | B+3 | 25 |
| Escalier angle SE | B+22 | 44 |

## Types de terrain

### Sol

| Terrain | Tile de base (B) | Demi-tile | Demi-tile variante | Pattern complet |
|---------|-----------------|-----------|---------------------|-----------------|
| Herbe | 22 | 23 | — | Oui |
| Roche | 114 | 115 | **159** | Oui |
| Brique | 202 | 203 | — | Oui |
| Sable | 290 | 291 | — | Oui |
| Pavé | 378 | 379 | — | Oui |

**Attention** : le tileset ICON a **deux tiles de demi-bloc roche** (id 115 et id 159). Les deux doivent avoir `height: 0.5, terrain: normal`. Si vous utilisez id 159 sans propriétés définies, il sera traité comme `height: 0` (bug courant).

### Liquides (pas de pentes/escaliers, juste base + demi-tile)

| Terrain | Tile de base (B) | Demi-tile |
|---------|-----------------|-----------|
| Eau | 198 | 199 |
| Lave | 286 | 287 |
| Poison | 462 | 463 |

## Hauteurs par tile

| Tile | Hauteur | Usage |
|------|---------|-------|
| Base (B) | Entière (0, 1, 2, 3...) | Plateau, sol plat |
| Demi-tile (B+1) | +0.5 par rapport au sol adjacent | Colline douce |
| Pente (N/W/E/S) | Transition entre deux niveaux | Rampe d'accès |
| Escalier (E/S) | Transition entre deux niveaux | Escalier d'accès |

La hauteur absolue dépend du contexte de la carte (propriété `height` du tile dans Tiled).

## Règle de remplissage vertical (stacking)

Quand une tile est surélevée (height > 0), le renderer empile des copies de la **tile de base du même type de terrain** en dessous pour combler le vide visuel. Si la tile du sommet est de la roche (id 114), les colonnes en dessous sont en roche. Si c'est de l'herbe (id 22), c'est de l'herbe.

Le lookup se fait via `IsometricGrid.getFillFrame()` qui identifie le terrain à partir du tile ID et retourne la tile de base correspondante.
