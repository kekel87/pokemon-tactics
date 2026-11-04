# Spawns et parti pris tactique

À lire par `level-designer` pour une carte neuve, ou dès qu'on touche aux spawns ou à la taille de la carte.

## Spawns — 5 objectgroups séparés (v4, décision #276)

**Un objectgroup par format**. Le `teamCount` est déduit du **nom du layer**, pas d'une propriété de l'objet :

| Layer        | teamCount déduit |
|--------------|------------------|
| `spawns_1v1` | 2                |
| `spawns_3p`  | 3                |
| `spawns_4p`  | 4                |
| `spawns_6p`  | 6                |
| `spawns_12p` | 12               |

Chaque objet d'un de ces layers peut être un **Point**, un **Rectangle** ou un **Polygon** Tiled, avec la seule propriété :

| Propriété | Type | Exemple |
|-----------|------|---------|
| `teamIndex` | int | `0`, `1`, ... (`< teamCount` déduit du nom du layer) |

**Rect/Polygon recommandés** : le parser rasterise la forme — toutes les tiles couvertes (Rectangle : bounding box ; Polygon : centres inclus par point-in-polygon) sont enrôlées dans la zone. Pour couvrir 15 tiles d'une zone 1v1, dessiner 1 rectangle ou 1 polygone prend 2 clics — largement préférable à 15 Points. Les Points restent utiles pour les tiles isolées (spawn FFA 12-teams).

Une **zone** = un ensemble d'objets avec le même `teamIndex` dans un même layer. Le parser déduplique les tiles partagées entre deux objets de la même équipe (ex. deux rectangles qui se chevauchent comptent une seule fois). Chaque zone doit avoir assez de positions valides (terrain passable, dans les bornes, connectées aux autres zones) pour couvrir le format.

Le loader (`parse-spawns-layer.ts` → `parseSpawnsLayers`) dérive `maxPokemonPerTeam = min(positions dans la zone la plus riche, floor(12 / teamCount))`. Donc **une zone riche couvre automatiquement tous les sous-formats de ce teamCount** (ex : zone de 6 positions en `spawns_1v1` couvre 1v1 jusqu'à 6v6).

**Aide Tiled** : 12 Object Classes `spawn_team_0..spawn_team_11` sont **inlinées sous `propertyTypes` dans `pokemon-tactics.tiled-project`** (chacune colorée + `teamIndex` pré-rempli). Depuis Tiled 1.10, seul `propertyTypes` inline est lu — `propertyTypesFile` est ignoré (vérifié sur `project.cpp` 1.12.1). Ouvrir `pokemon-tactics.tiled-project` via `File > Open File or Project`, ouvrir le panneau `View > Views and Toolbars > Project`, puis assigner la classe appropriée aux objets spawn (Point / Rectangle / Polygon) via le champ `Class` — la couleur et `teamIndex` sont automatiques.

**Compat legacy** : le layer `spawns` unique (avec `teamIndex + formatTeamCount` sur chaque objet) est encore accepté par le parser (`parseLegacySpawnsLayer`) mais **ne plus en produire** — c'est réservé aux 22 maps `dev/` pré-pivot. Les maps du roster racine utilisent les 5 layers séparés.

## Règle dure — **toutes les maps sont multi-format**

> **Chaque `.tmj` doit déclarer les 5 objectgroups** `spawns_1v1`, `spawns_3p`, `spawns_4p`, `spawns_6p`, `spawns_12p`. Chacun peut être vide (gabarit) mais doit exister. Pour qu'une map soit jouable dans un format, l'objectgroup correspondant doit être peuplé avec au moins `teamCount` zones (une par `teamIndex` 0..teamCount-1) comptant chacune ≥ `floor(12 / teamCount)` positions.

Contraintes indicatives par format (cibles raisonnables, pas de barème imposé — l'humain remplit à la main maintenant, v4 décision #276) :

| Layer | teamCount | Pokemon/équipe | Zones | Cible positions/zone |
|-------|-----------|----------------|-------|----------------------|
| `spawns_1v1` | 2  | 6 | 2  | ≥ 6 |
| `spawns_3p`  | 3  | 4 | 3  | ≥ 4 |
| `spawns_4p`  | 4  | 3 | 4  | ≥ 3 |
| `spawns_6p`  | 6  | 2 | 6  | ≥ 2 |
| `spawns_12p` | 12 | 1 | 12 | ≥ 1 |

Les positions peuvent se superposer d'un format à l'autre (tile A peut être dans `spawns_1v1` ET dans `spawns_6p` — permis). À l'intérieur d'un même layer, chaque position doit avoir un seul `teamIndex`.

**Règles de placement — pense en topologie, pas en algorithme.**

Tu dois **penser les spawns comme une fonction de la topologie de la map**. Identifie d'abord les axes de lecture de ta map (rivière E-O, plateau central, anneau extérieur, canyon N-S…). Chaque format se pose ensuite sur ces axes de façon cohérente, pas en plaquant un pattern géométrique abstrait.

Règles par format (lignes directrices, à adapter à la topologie) :

- **tc=2** : axial le long d'un axe de la map. Équipes **face à face** avec un espace tactique entre elles (chokepoint, plateau, rivière). N/S par défaut sur maps rectangulaires plates ; E/O si la géométrie l'impose ; axe diagonal autorisé si c'est *l'axe* de la map.
- **tc=3** : triangulaire autour d'un centre. Chaque sommet sur un **secteur cohérent** avec la topologie (ex : 1 plateau nord + 2 vallées sud, pas « au milieu d'un mur »).
- **tc=4** : carré ou losange autour d'un centre. Même logique de secteurs cohérents.
- **tc=6** : hexagone / couronne. Privilégier le périmètre intérieur jouable.
- **tc=12** : couronne sur le périmètre extérieur, distribution régulière. `Point` unique suffit par zone.

**Contraintes dures — non-négociables** :

1. **Zones = blocs 4-connexes contigus.** Chaque zone est un bloc où tu peux aller d'une tile à n'importe quelle autre en te déplaçant uniquement N/S/E/W de tile en tile **à l'intérieur de la zone**. Deux objets Rectangle distincts avec le même `teamIndex` **ne forment pas une zone contiguë s'ils sont séparés par du terrain non-zone**, même si les deux rectangles sont individuellement contigus.

   ```
   ❌ Violation (2 objets Rectangle même teamIndex mais séparés) :
      row N   : [0 0]  . . .  [0 0]      ← les 4 tiles team 0 ne sont pas 4-connexes entre elles
      row N+1 : [0 0]  . . .  [0 0]

   ✅ Zone contiguë (1 bloc unique) :
      row N   : [0 0 0 0 0 0]             ← 6 tiles 4-connexes, OK
      row N+1 : [0 0 0 0 0 0]
   ```

   Seule exception : tc=12 où chaque zone = 1 Point (1 tile, trivialement contigu).
2. Map **≥ 10×10**. Sweet spot 12×12 à 14×14.
3. **Aucun spawn adjacent à `obstacle`, `deep_water`, `lava`.** `magma` et `swamp` OK.
4. **Connectivité** : il doit exister un chemin passable entre chaque paire de zones d'un même layer (l'humain valide après ton Write).
5. **Cohérence inter-format** : si tc=2 est N/S, tc=3 doit avoir un sommet côté N ou côté S (pas une orientation aléatoire). Le joueur doit sentir une *identité* de la map qui persiste à travers les 5 formats. **Cohérence de terrain sous les spawns** : les 5 formats devraient privilégier le même type de terrain sous les zones (ex : si tc=4 place ses spawns sur `normal`, les autres formats le font aussi). Sauf contre-indication explicite du brief (ex : map forestière où la moitié des spawns vit dans les `tall_grass`, à justifier).
6. **Orientation initiale FFA** (décision #273, appliquée au runtime — pas ton problème) : chaque Pokemon pointera vers sa zone voisine la plus proche. Tu n'as aucune propriété à poser — pense juste à placer les zones de façon à ce que ce calcul donne un résultat lisible (pas deux zones qui se font dos à dos artificiellement).

**Si la topologie casse un format** (ex : map très asymétrique qui ne peut pas loger 12 zones équilibrées) → **stop, lève la main**, propose 2-3 options à l'humain. Ne PAS itérer silencieusement.

Conseil pratique : avant d'écrire le `.tmj`, écris dans ton résumé les **5 layouts de spawns en ASCII** (un par format) pour vérifier que tu as pensé les 5. Si deux formats partagent le même layout, c'est un signal qu'un des deux est mal pensé.

## Règles tactiques — partis pris

Une map doit avoir **un parti pris lisible en une phrase**. Sans ça, elle est fade.

- **High-ground control** : plateau central en hauteur, rampes d'accès asymétriques, choke points.
- **Tall-grass heavy** : patchs de `tall_grass` (évasion +1) qui créent des corridors d'embuscade.
- **Water maze** : zones d'eau large (`water`, ralentit) traversées par des ponts étroits ; `deep_water` bloquant les contournements.
- **Cramped** : 6×6 ou 8×8, beaucoup de murs (`obstacle`), combat serré, peu de déplacement.
- **Lava hazard** : patchs de `lava` (impassable + tile voisine `magma` qui brûle au passage quand ce sera implémenté).
- **LoS fragmenté** : piliers surélevés dispersés (height 1.0-1.5) qui coupent les lignes de tir.

### Équilibre des spawns

- Même nombre de tiles accessibles à même distance de la map pour chaque équipe.
- Pas un spawn sur plateau et l'autre en plaine. Dénivelés initiaux symétriques.
- Distance minimale entre spawns adverses ≈ 1/2 diagonale de la map (pas de rush immédiat).
- Pas de spawn adjacent à du `lava`, `deep_water` ou `obstacle`.

### Taille — contrainte multi-format

Vu que **toute map supporte les 5 formats** ({2, 3, 4, 6, 12} teams), la taille est contrainte par le pire cas : placer 12 zones disjointes et équilibrées.

| Usage | Taille recommandée |
|-------|--------------------|
| Minimum viable (petit duel + grand FFA serré) | 10×10 |
| Sweet spot (lisibilité + respiration 12 teams) | 12×12 à 14×14 |
| Grand format (Civ-like 12 joueurs confortable) | 16×16 à 20×20 |

L'humain préfère les **formats 1v1 et 1v1v1** (2 et 3 teams × 1 pokemon) — la map doit donc être particulièrement soignée pour ces usages, sans sacrifier les formats supérieurs.
